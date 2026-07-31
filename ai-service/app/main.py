"""
main.py
=======
FastAPI application entry point for the RetentionAI AI Service.

Startup sequence
----------------
1. Load environment variables (and force ML-library offline mode — see below
   — before any of those libraries are imported).
2. Connect to MongoDB (async Motor).
3. Concurrently, each offloaded to a worker thread with a timeout so a slow
   or unreachable dependency can never block the event loop:
   a. Load the active Joblib model bundle + initialise the SHAP explainer.
   b. Preload the NLP transformer models (emotion + zero-shot classifiers).
   c. Connect to the ChromaDB vectorstore (loads the embedding model).
4. Register all API routers.

Shutdown sequence
-----------------
1. Close MongoDB connection.

Why startup used to hang indefinitely
--------------------------------------
`sentence-transformers` (via `SentenceTransformerEmbeddings` in
`embedding_manager.py`) and `transformers.pipeline(...)` (in `nlp/analyzer.py`)
both call out to huggingface.co on *every* load — even when the model is
already cached locally — to check for a newer revision, unless explicitly
told to run offline. That call has no timeout of its own. Every one of these
loads was previously invoked as a **plain synchronous call directly inside
this async `lifespan` function**, which runs on the event loop: a slow or
unreachable network turned "check for updates" into an indefinite block of
the *entire* event loop, so uvicorn never got to print "Application startup
complete" — see docs/TROUBLESHOOTING.md for the full writeup.
"""

import os
import time
import uuid
import logging
import asyncio
import psutil
from dotenv import load_dotenv

# Load .env FIRST, before anything below reads os.environ or imports a
# library that reads it at import time.
load_dotenv()

# Force offline mode for huggingface_hub/transformers/sentence-transformers
# BEFORE any of those libraries (or app.nlp.analyzer / app.rag.embeddings,
# which import them) are imported. This is the actual fix for startup never
# finishing: with these set, a cached model loads from disk only — no
# network call, no possibility of hanging on one. Set
# AI_MODELS_OFFLINE=false to opt back into online/auto-download mode for a
# genuinely first-time setup with no local cache yet.
if os.getenv("AI_MODELS_OFFLINE", "true").strip().lower() not in ("false", "0", "no"):
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request

from app.utils.logging_config import setup_logging

setup_logging(os.getenv("LOG_LEVEL", "info"))
logger = logging.getLogger(__name__)

from app.api.routes import router as prediction_router
from app.api.explain_routes import router as explain_router
from app.api.nlp_routes import router as nlp_router
from app.api.employee_intelligence_routes import router as employee_intelligence_router
from app.api.rag_routes import router as rag_router
from app.api.agent_routes import router as agent_router
from app.api.decision_routes import router as decision_router
from app.config import validate_startup_config
from app.utils.database import connect_db, disconnect_db, get_db, db_instance
from app.utils.metrics import metrics_middleware, get_metrics_snapshot
from app.utils.migrations import migrate_prediction_history_collection
from app.prediction.prediction_service import prediction_service
from app.explainability.shap_explainer import shap_cache
from app.nlp.analyzer import get_emotion_classifier, get_zeroshot_classifier
from app.rag.vectorstore.chroma_store import get_vectorstore

STARTUP_STEP_TIMEOUT_SECONDS = 60


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────
    logger.info("Starting up RetentionAI AI Service")

    # Fatal config errors (missing service token, missing LLM key in
    # production) intentionally are NOT wrapped in try/except like the
    # steps below — an unusable configuration should stop the process,
    # not boot into a silently-broken state.
    validate_startup_config()

    await connect_db()

    # One-time reconciliation of the predictionHistory/predictionhistories
    # collection-name mismatch with Node's Mongoose model (see
    # app/utils/migrations.py) — safe to run every startup, no-op once done.
    try:
        await migrate_prediction_history_collection(get_db())
    except Exception:
        logger.exception("Prediction history migration check failed")

    # ── The three heavy, independent startup chains ─────────────────────
    # Each is synchronous, CPU/IO-bound (and, for NLP/vectorstore, was the
    # source of the network-call hang described above) — every one is now
    # offloaded to a worker thread via asyncio.to_thread so it can never
    # block the event loop, run concurrently with the other two since none
    # depend on each other, and individually time-boxed so a genuinely
    # unreachable network still can't hang the process forever.

    def _load_model_and_shap():
        prediction_service.load_active_model()
        if prediction_service.model_bundle is not None:
            shap_cache.initialise(prediction_service.model_bundle)
        else:
            logger.warning("Skipping SHAP initialisation — no model bundle available.")

    def _load_nlp_models():
        get_emotion_classifier()
        get_zeroshot_classifier()

    def _load_vectorstore():
        get_vectorstore()

    async def _run_guarded(sync_fn, step_name):
        try:
            await asyncio.wait_for(asyncio.to_thread(sync_fn), timeout=STARTUP_STEP_TIMEOUT_SECONDS)
            logger.info(f"{step_name}: ready.")
        except asyncio.TimeoutError:
            logger.error(f"{step_name} timed out after {STARTUP_STEP_TIMEOUT_SECONDS}s — continuing startup in degraded mode.")
        except Exception:
            logger.exception(f"{step_name} failed")

    logger.info("Loading prediction model, SHAP explainer, NLP models, and vectorstore (concurrently)")
    await asyncio.gather(
        _run_guarded(_load_model_and_shap, "Prediction model + SHAP explainer"),
        _run_guarded(_load_nlp_models, "NLP models (Transformers)"),
        _run_guarded(_load_vectorstore, "ChromaDB vectorstore"),
    )

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────
    logger.info("Shutting down RetentionAI AI Service")
    await disconnect_db()


app = FastAPI(
    title="RetentionAI AI Service",
    description=(
        "Machine Learning Prediction Service and SHAP Explainability Engine "
        "for Employee Attrition Analysis"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.middleware("http")(metrics_middleware)

_process_started_at = time.time()


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Assigns/propagates a request ID and logs one structured line per request — mirrors requestId.js + requestLogging.js on the Node side."""
    request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers["X-Request-Id"] = request_id
    logger.info(
        f"http_request method={request.method} path={request.url.path} status={response.status_code} durationMs={duration_ms}",
        extra={"request_id": request_id},
    )
    return response


@app.get("/health")
async def health():
    """Fast liveness probe — no external calls. Used by Docker HEALTHCHECK."""
    return {"status": "OK", "uptimeSeconds": round(time.time() - _process_started_at)}


@app.get("/health/deep")
async def health_deep():
    """Deep health check — Mongo connectivity, model/NLP/vectorstore readiness, memory/CPU, pipeline latency."""
    mongo_status = {"status": "DOWN", "latencyMs": None}
    start = time.perf_counter()
    try:
        if db_instance.client is not None:
            await db_instance.client.admin.command("ping")
            mongo_status = {"status": "UP", "latencyMs": round((time.perf_counter() - start) * 1000, 1)}
    except Exception as exc:
        mongo_status = {"status": "DOWN", "latencyMs": None, "detail": str(exc)}

    process = psutil.Process()
    memory_info = process.memory_info()
    overall_status = "UP" if mongo_status["status"] == "UP" and prediction_service.model_bundle is not None else "DEGRADED"

    return {
        "status": overall_status,
        "uptimeSeconds": round(time.time() - _process_started_at),
        "dependencies": {"mongo": mongo_status},
        "modelStatus": {
            "predictionModelLoaded": prediction_service.model_bundle is not None,
            "shapExplainerReady": shap_cache.explainer is not None if hasattr(shap_cache, "explainer") else None,
        },
        "resources": {
            "memory": {
                "rssMb": round(memory_info.rss / 1024 / 1024, 1),
                "vmsMb": round(memory_info.vms / 1024 / 1024, 1),
            },
            "cpuPercent": process.cpu_percent(interval=0.1),
            "cpuCount": psutil.cpu_count(),
        },
        "pipelineLatency": get_metrics_snapshot(),
    }


# Register routers
app.include_router(prediction_router)
app.include_router(explain_router)
app.include_router(nlp_router)
app.include_router(employee_intelligence_router)
app.include_router(rag_router)
app.include_router(agent_router)
app.include_router(decision_router)


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("AI_SERVICE_PORT", 8000))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
