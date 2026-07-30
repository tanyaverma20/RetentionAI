"""
main.py
=======
FastAPI application entry point for the RetentionAI AI Service.

Startup sequence
----------------
1. Load environment variables.
2. Connect to MongoDB (async Motor).
3. Load the active Joblib model bundle (prediction_service).
4. Initialise the SHAP explainer cache (shap_cache) — expensive, done once.
5. Register all API routers.

Shutdown sequence
-----------------
1. Close MongoDB connection.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from dotenv import load_dotenv

from app.api.routes import router as prediction_router
from app.api.explain_routes import router as explain_router
from app.api.nlp_routes import router as nlp_router
from app.api.employee_intelligence_routes import router as employee_intelligence_router
from app.api.rag_routes import router as rag_router
from app.api.agent_routes import router as agent_router
from app.api.decision_routes import router as decision_router
from app.utils.database import connect_db, disconnect_db, get_db
from app.utils.migrations import migrate_prediction_history_collection
from app.prediction.prediction_service import prediction_service
from app.explainability.shap_explainer import shap_cache
from app.nlp.analyzer import get_emotion_classifier, get_zeroshot_classifier
from app.rag.vectorstore.chroma_store import get_vectorstore

# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────
    print("Starting up RetentionAI AI Service …")
    await connect_db()

    # One-time reconciliation of the predictionHistory/predictionhistories
    # collection-name mismatch with Node's Mongoose model (see
    # app/utils/migrations.py) — safe to run every startup, no-op once done.
    try:
        await migrate_prediction_history_collection(get_db())
    except Exception as exc:
        print(f"Prediction history migration check failed: {exc}")

    # Load trained model bundle
    try:
        prediction_service.load_active_model()
    except Exception as exc:
        print(f"Failed to load active model on startup: {exc}")

    # Initialise SHAP explainer (only if model was loaded successfully)
    if prediction_service.model_bundle is not None:
        try:
            shap_cache.initialise(prediction_service.model_bundle)
        except Exception as exc:
            print(f"Failed to initialise SHAP explainer: {exc}")
    else:
        print("Skipping SHAP initialisation — no model bundle available.")

    # Preload NLP Models to avoid latency on first API call
    print("Loading NLP models (Transformers & spaCy)...")
    try:
        get_emotion_classifier()
        get_zeroshot_classifier()
        print("NLP models loaded successfully.")
    except Exception as exc:
        print(f"Failed to load NLP models: {exc}")

    # Pre-connect to ChromaDB vectorstore (creates directory if new)
    print("Connecting to ChromaDB vectorstore...")
    try:
        get_vectorstore()
        print("ChromaDB vectorstore ready.")
    except Exception as exc:
        print(f"Failed to connect to ChromaDB: {exc}")

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────
    print("Shutting down RetentionAI AI Service …")
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
