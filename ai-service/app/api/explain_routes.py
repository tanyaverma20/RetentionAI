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
from typing import Optional

import numpy as np
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status, Query

from app.api.explain_schemas import ExplainRequest, ExplainBatchRequest
from app.preprocessing.enrichment import enrich_employee_doc
from app.explainability.shap_explainer import shap_cache
from app.explainability.local_explainer import explain_employee
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
    summary="Local SHAP explanations for a batch of employees (DB lookup)",
    dependencies=[Depends(verify_auth_token)],
)
async def explain_batch(request: ExplainBatchRequest):
    """
    Explains either an explicit list of employees, all employees of one
    department, or (when neither filter is given) every ACTIVE employee.
    Mirrors the filtering behaviour of POST /predict/batch in routes.py.

    Individual failures do not abort the batch — they are counted and skipped
    so one bad record can't block explanations for the rest of the workforce.
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

    employees = [emp async for emp in db["employees"].find(query)]

    explanations = []
    failed_count = 0
    for emp in employees:
        try:
            serialized = _serialize(emp)
            serialized = await enrich_employee_doc(serialized, db)
            explanations.append(explain_employee(serialized))
        except Exception as exc:
            print(f"Failed to explain employee {emp.get('_id')}: {exc}")
            failed_count += 1

    return {
        "success": True,
        "data": {
            "explanations": explanations,
            "totalCount": len(employees),
            "successCount": len(explanations),
            "failedCount": failed_count,
        },
    }


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
