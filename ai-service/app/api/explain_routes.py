"""
explain_routes.py
=================
FastAPI router for all XAI / SHAP explainability endpoints.

Endpoints
---------
GET  /explain/{employeeId}   — fetch employee from DB, run predict + explain
POST /explain                — ad-hoc explain from request body (no DB lookup)
GET  /feature-importance     — global feature importance ranking
GET  /plots/global           — generate all global plots, return file paths
GET  /plots/local/{employeeId} — generate local plots for one employee

Authentication
--------------
Same Bearer-token auth as prediction routes (shared `verify_auth_token`).
Token verification is bypassed when AI_SERVICE_TOKEN is unconfigured (dev mode).
"""

from __future__ import annotations

import os
import asyncio
import time
import uuid
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query
from fastapi.responses import FileResponse

from app.api.explain_schemas import ExplainRequest, ExplainBatchRequest
from app.preprocessing.enrichment import enrich_employee_doc
from app.explainability.shap_explainer import shap_cache
from app.explainability.local_explainer import explain_employee, explain_employees_batch
from app.explainability.global_explainer import compute_global_importance
from app.explainability.plot_generator import (
    generate_waterfall_plot,
    generate_force_plot,
    generate_decision_plot,
    generate_summary_plot,
    generate_bar_plot,
    generate_dependence_plot,
)
from app.preprocessing.pipeline import transform_inference
from app.utils.database import get_db

router = APIRouter(tags=["Explainability"])


# ---------------------------------------------------------------------------
# Auth (mirrors the auth in routes.py — shared helper)
# ---------------------------------------------------------------------------

async def verify_auth_token(authorization: Optional[str] = Header(None)):
    expected = os.getenv("AI_SERVICE_TOKEN")
    if not expected or expected == "replace-with-a-service-token":
        return True
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Authorization header format")
    if parts[1] != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _shap_not_ready():
    raise HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "SHAP explainer is not initialised. Please train a model first.",
    )


# ---------------------------------------------------------------------------
# Background job tracking for POST /explain/batch
# ---------------------------------------------------------------------------
#
# Root cause of the recurring "Batch SHAP explanation failed: 502" errors:
# this endpoint held one HTTP request open for the entire ~90-160s a full-
# workforce batch takes (fetch + enrich + vectorized SHAP). Every attempt to
# fix the *duration* (parallelizing per-employee enrichment, tuning
# concurrency to avoid connection-pool contention) measurably changed the
# timing but never made it reliable — three different configurations all
# landed in the same 90-166s failure zone against production. /train already
# solves this the right way: return immediately, do the work in the
# background. This endpoint now does the same. Express is the only caller,
# and it switches from one long POST to a POST-then-poll pattern — no
# frontend change needed, since the frontend<->Express leg already tolerates
# multi-minute waits (proven directly: a 123s through-Express call to the
# OLD synchronous endpoint succeeded before this change).
#
# In-memory, not a persistent queue: this service has no job-queue
# infrastructure (see aiPipelineService.js's docstring on the Express side
# for the same constraint), and a single-process FastAPI deployment is the
# only thing that needs to read this. A restart loses in-flight jobs, which
# is acceptable — Express's poll loop times out and the user can just click
# the button again, exactly as if the request itself had failed.
_EXPLAIN_JOBS: dict[str, dict] = {}

# Jobs older than this are evicted on each new job's creation so _EXPLAIN_JOBS
# can't grow without bound across a long-lived process.
_JOB_TTL_SECONDS = 30 * 60


def _prune_old_jobs() -> None:
    cutoff = time.time() - _JOB_TTL_SECONDS
    stale = [job_id for job_id, job in _EXPLAIN_JOBS.items() if job["startedAt"] < cutoff]
    for job_id in stale:
        del _EXPLAIN_JOBS[job_id]


async def _run_explain_batch_job(job_id: str, query: dict) -> None:
    """Does the actual fetch/enrich/SHAP work; stores the outcome in
    _EXPLAIN_JOBS instead of returning it directly to an HTTP caller."""
    try:
        db = get_db()
        employees = [emp async for emp in db["employees"].find(query)]

        semaphore = asyncio.Semaphore(12)

        async def _enrich_one(emp):
            async with semaphore:
                return await enrich_employee_doc(_serialize(emp), db)

        enrich_results = await asyncio.gather(*(_enrich_one(emp) for emp in employees), return_exceptions=True)

        enriched_docs = []
        failed_count = 0
        for emp, result in zip(employees, enrich_results):
            if isinstance(result, Exception):
                print(f"Failed to enrich employee {emp.get('_id')}: {result}")
                failed_count += 1
            else:
                enriched_docs.append(result)

        explanations = await asyncio.to_thread(explain_employees_batch, enriched_docs)

        _EXPLAIN_JOBS[job_id] = {
            "status": "completed",
            "startedAt": _EXPLAIN_JOBS[job_id]["startedAt"],
            "result": {
                "explanations": explanations,
                "totalCount": len(employees),
                "successCount": len(explanations),
                "failedCount": failed_count,
            },
        }
    except Exception as exc:
        print(f"Batch explain job {job_id} failed: {exc}")
        _EXPLAIN_JOBS[job_id] = {
            "status": "failed",
            "startedAt": _EXPLAIN_JOBS[job_id]["startedAt"],
            "error": str(exc),
        }


def _serialize(doc: dict) -> dict:
    """Convert ObjectId / datetime fields for JSON serialisation."""
    import datetime
    result = {}
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
        elif isinstance(v, datetime.datetime):
            result[k] = v.isoformat()
        else:
            result[k] = v
    return result


# ---------------------------------------------------------------------------
# GET /explain/{employeeId}
# ---------------------------------------------------------------------------

@router.get(
    "/explain/{employeeId}",
    response_model=dict,
    summary="Local SHAP explanation for an employee (DB lookup)",
    dependencies=[Depends(verify_auth_token)],
)
async def explain_employee_by_id(employeeId: str):
    """
    Fetches the employee document from MongoDB, runs prediction, then generates
    a full local SHAP explanation including top contributors and narrative.
    """
    if not shap_cache.is_ready:
        _shap_not_ready()

    db = get_db()
    if db is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable")

    try:
        obj_id = ObjectId(employeeId)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid employeeId: {employeeId}")

    emp = await db["employees"].find_one({"_id": obj_id, "isDeleted": {"$ne": True}})
    if not emp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Employee {employeeId} not found")

    serialized = _serialize(emp)
    # Same real Attendance/Performance/PromotionHistory/TrainingHistory/Survey/
    # NLP enrichment predict_single() applies — without it, SHAP would explain
    # a different (mostly-default) feature vector than what the model
    # actually saw for this employee's real prediction.
    serialized = await enrich_employee_doc(serialized, db)

    try:
        explanation = explain_employee(serialized)
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    return {"success": True, "data": explanation}


# ---------------------------------------------------------------------------
# POST /explain
# ---------------------------------------------------------------------------

@router.post(
    "/explain",
    response_model=dict,
    summary="Ad-hoc local SHAP explanation from request body",
    dependencies=[Depends(verify_auth_token)],
)
async def explain_adhoc(request: ExplainRequest):
    """
    Accepts raw employee feature values in the request body and returns a
    full local SHAP explanation. No database lookup performed.

    Useful for what-if analysis on the React dashboard (e.g. slider UI).
    """
    if not shap_cache.is_ready:
        _shap_not_ready()

    employee_doc = request.model_dump(exclude_none=False)
    if employee_doc.get("employeeId"):
        employee_doc["_id"] = employee_doc.pop("employeeId")
    else:
        employee_doc["_id"] = "adhoc"

    try:
        explanation = explain_employee(employee_doc)
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    return {"success": True, "data": explanation}


# ---------------------------------------------------------------------------
# POST /explain/batch
# ---------------------------------------------------------------------------

@router.post(
    "/explain/batch",
    response_model=dict,
    summary="Start a background batch SHAP explanation job for a set of employees",
    dependencies=[Depends(verify_auth_token)],
)
async def explain_batch(request: ExplainBatchRequest):
    """
    Starts a background job explaining either an explicit list of employees,
    all employees of one department, or (when neither filter is given)
    every ACTIVE employee. Mirrors the filtering behaviour of
    POST /predict/batch in routes.py. Returns a jobId immediately — the
    caller (Express) polls GET /explain/batch/status/{jobId} for the result.

    This used to compute synchronously and return the full result in one
    response. A full-workforce batch (~1470 employees) takes ~90-160s even
    after enrichment was parallelized and its concurrency tuned — three
    different configurations all still landed in the 90-166s zone against
    production, well past whatever the deployment platform tolerates for a
    single held-open request. Returning immediately and polling sidesteps
    that entirely, the same way POST /train already does.
    """
    if not shap_cache.is_ready:
        _shap_not_ready()

    db = get_db()
    if db is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable")

    query: dict = {"isDeleted": {"$ne": True}}
    if request.employeeIds:
        try:
            query["_id"] = {"$in": [ObjectId(eid) for eid in request.employeeIds]}
        except Exception:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more employee IDs are invalid ObjectIds")
    elif request.departmentId:
        try:
            query["departmentId"] = ObjectId(request.departmentId)
        except Exception:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid departmentId format: {request.departmentId}")
    else:
        query["status"] = "ACTIVE"

    _prune_old_jobs()
    job_id = str(uuid.uuid4())
    _EXPLAIN_JOBS[job_id] = {"status": "running", "startedAt": time.time()}
    asyncio.create_task(_run_explain_batch_job(job_id, query))

    return {"success": True, "jobId": job_id, "message": "Batch explanation started in the background."}


@router.get(
    "/explain/batch/status/{jobId}",
    response_model=dict,
    summary="Poll the status/result of a batch SHAP explanation job",
    dependencies=[Depends(verify_auth_token)],
)
async def explain_batch_status(jobId: str):
    job = _EXPLAIN_JOBS.get(jobId)
    if job is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No such job (it may have completed and been pruned, or the service restarted). Start a new batch.",
        )

    if job["status"] == "running":
        return {"success": True, "status": "running"}
    if job["status"] == "failed":
        return {"success": True, "status": "failed", "error": job["error"]}
    return {"success": True, "status": "completed", "data": job["result"]}


# ---------------------------------------------------------------------------
# GET /feature-importance
# ---------------------------------------------------------------------------

@router.get(
    "/feature-importance",
    response_model=dict,
    summary="Global SHAP feature importance ranking",
    dependencies=[Depends(verify_auth_token)],
)
async def get_feature_importance(n_samples: int = Query(100, ge=10, le=500)):
    """
    Returns global feature importance as ranked by mean absolute SHAP value
    over a background sample.  Ready for consumption by a React bar chart.
    """
    if not shap_cache.is_ready:
        _shap_not_ready()

    try:
        result = compute_global_importance(n_samples=n_samples)
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    return {"success": True, "data": result}


# ---------------------------------------------------------------------------
# GET /plots/global
# ---------------------------------------------------------------------------

@router.get(
    "/plots/global",
    response_model=dict,
    summary="Generate (or regenerate) all global SHAP plots",
    dependencies=[Depends(verify_auth_token)],
)
async def get_global_plots(
    feature: str = Query("salary", description="Feature name for dependence plot"),
    n_samples: int = Query(100, ge=10, le=500),
):
    """
    Runs SHAP over the background sample and saves:
      - Beeswarm summary plot
      - Bar (mean |SHAP|) plot
      - Dependence plot for the requested feature

    Returns a dict of plotType → absolute file path.
    """
    if not shap_cache.is_ready:
        _shap_not_ready()

    try:
        shap_matrix = shap_cache.compute_shap_values(
            shap_cache.background_data[: min(n_samples, len(shap_cache.background_data))]
        )
        paths = {
            "summaryBeeswarm": generate_summary_plot(shap_matrix),
            "summaryBar":      generate_bar_plot(shap_matrix),
            "dependence":      generate_dependence_plot(shap_matrix, feature),
        }
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    return {"success": True, "data": paths}


# ---------------------------------------------------------------------------
# GET /plots/global/{plot_type}/image
# ---------------------------------------------------------------------------

@router.get(
    "/plots/global/{plot_type}/image",
    summary="Stream a generated global SHAP plot as a PNG",
    dependencies=[Depends(verify_auth_token)],
    response_class=FileResponse,
)
async def get_global_plot_image(
    plot_type: str,
    feature: str = Query("salary", description="Feature name for dependence plot"),
    n_samples: int = Query(100, ge=10, le=500),
):
    """
    Returns the PNG bytes rather than a filesystem path.

    /plots/global reports absolute paths, which only works for a caller that
    shares this container's filesystem. The Node API runs as a separate
    service and was calling response.sendFile() on a path that does not exist
    on its own disk — unservable by construction once the two are deployed
    apart. This endpoint closes that gap by streaming the file itself.
    """
    if not shap_cache.is_ready:
        _shap_not_ready()

    generators = {
        "summaryBeeswarm": lambda m: generate_summary_plot(m),
        "summaryBar": lambda m: generate_bar_plot(m),
        "dependence": lambda m: generate_dependence_plot(m, feature),
    }
    if plot_type not in generators:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Unknown plot type '{plot_type}'. Expected one of: {', '.join(generators)}",
        )

    try:
        shap_matrix = shap_cache.compute_shap_values(
            shap_cache.background_data[: min(n_samples, len(shap_cache.background_data))]
        )
        path = generators[plot_type](shap_matrix)
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    if not os.path.isfile(path):
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            f"Plot was generated but no file exists at {path}",
        )

    return FileResponse(path, media_type="image/png", filename=f"{plot_type}.png")


# ---------------------------------------------------------------------------
# GET /plots/local/{employeeId}
# ---------------------------------------------------------------------------

@router.get(
    "/plots/local/{employeeId}",
    response_model=dict,
    summary="Generate local SHAP plots for one employee",
    dependencies=[Depends(verify_auth_token)],
)
async def get_local_plots(employeeId: str):
    """
    Fetches the employee from MongoDB, computes SHAP values, and generates:
      - Waterfall plot
      - Force plot
      - Decision plot

    Returns a dict of plotType → absolute file path.
    """
    if not shap_cache.is_ready:
        _shap_not_ready()

    db = get_db()
    if db is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable")

    try:
        obj_id = ObjectId(employeeId)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid employeeId: {employeeId}")

    emp = await db["employees"].find_one({"_id": obj_id, "isDeleted": {"$ne": True}})
    if not emp:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Employee {employeeId} not found")

    from app.prediction.prediction_service import prediction_service
    bundle = prediction_service.model_bundle
    if bundle is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No model bundle loaded")

    import pandas as pd
    serialized = _serialize(emp)
    serialized = await enrich_employee_doc(serialized, db)
    df = pd.DataFrame([serialized])
    X = transform_inference(df, bundle["scaler"], bundle["encoders"])
    shap_vals_1d = shap_cache.compute_shap_values(X)[0]

    try:
        paths = {
            "waterfall": generate_waterfall_plot(shap_vals_1d, employeeId),
            "force":     generate_force_plot(shap_vals_1d, employeeId),
            "decision":  generate_decision_plot(shap_vals_1d, employeeId),
        }
    except Exception as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc))

    return {"success": True, "data": paths}
