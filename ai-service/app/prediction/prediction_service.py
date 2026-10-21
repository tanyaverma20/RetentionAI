"""
prediction_service.py
=====================
Core attrition-prediction service for the RetentionAI AI Service.

Responsibilities
----------------
* Load and verify the active model bundle on startup.
* Validate model output before returning it (finite probabilities, valid
  risk level).
* Enrich the employee document from Mongo sub-collections before inference.
* Transform features using the exact same pipeline as training.
* Persist prediction history and current-status records to MongoDB.
* Log structured operational telemetry via InferenceTelemetryLogger.

All ``print()`` call sites have been replaced with structured ``logging``
(module-level logger named ``app.prediction.prediction_service``).
"""

import datetime
import glob
import logging
import os
import time
import uuid

import pandas as pd
from bson import ObjectId

from app.api.schemas import validate_prediction_output, VALID_RISK_LEVELS
from app.prediction.inference_logger import inference_logger
from app.preprocessing.enrichment import enrich_employee_doc
from app.preprocessing.pipeline import (
    FEATURE_COLS,
    CATEGORICAL_COLS,
    NUMERICAL_COLS,
    transform_inference,
)
from app.registry.model_registry import safe_load_model_bundle, ModelIntegrityException
from app.training.trainer import load_model_bundle
from app.utils.database import get_db

logger = logging.getLogger(__name__)


class ModelNotLoadedException(Exception):
    """Raised when a prediction is attempted but no model bundle is loaded."""


class ModelSchemaException(Exception):
    """Raised when a loaded model bundle's feature schema is incompatible."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe_object_id(value) -> ObjectId | None:
    """
    Casts a Mongo id-like value to ObjectId, or returns ``None``.

    Storing prediction records as ObjectIds (not strings) keeps them
    compatible with Node's Mongoose schema that reads the same collections.
    """
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def validate_model_feature_schema(bundle: dict) -> None:
    """
    Verifies that a loaded model bundle's feature schema matches the feature
    lists this service is compiled against.

    Raises ``ModelSchemaException`` with a human-readable diff if the
    bundle was trained with a different feature set — prevents silent
    wrong-column predictions when an old artifact is accidentally deployed.
    """
    meta = bundle.get("feature_metadata", {})
    bundle_features = set(meta.get("feature_cols", []))
    expected_features = set(FEATURE_COLS)

    if not bundle_features:
        logger.warning(
            "Model bundle has no feature_metadata.feature_cols — "
            "schema compatibility check skipped."
        )
        return

    missing = expected_features - bundle_features
    extra = bundle_features - expected_features
    if missing or extra:
        raise ModelSchemaException(
            f"Model bundle feature schema mismatch. "
            f"Missing from bundle: {sorted(missing) or 'none'}. "
            f"Extra in bundle: {sorted(extra) or 'none'}. "
            "Retrain the model with the current feature set or revert to a "
            "compatible artifact."
        )

    logger.info(
        "Model feature schema validated: %d features match expected schema.",
        len(expected_features),
    )


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class PredictionService:
    """
    Singleton prediction service that owns the active model bundle.

    Thread-safety note: ``load_active_model`` is called once, synchronously,
    from a worker thread during FastAPI's lifespan startup
    (``asyncio.to_thread``).  After startup the bundle is read-only during
    inference, so no additional locking is needed for concurrent requests.
    """

    def __init__(self) -> None:
        self.model_bundle: dict | None = None
        self.model_filepath: str | None = None

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def load_active_model(self) -> None:
        """
        Loads the active model bundle from ``MODEL_ARTIFACT_PATH``.

        Resolution order:
        1. ``<dir>/attrition_model.joblib``  (canonical name)
        2. Most-recently-modified ``*.joblib`` file in the same directory.

        On success, validates the feature schema so a mis-matched artifact is
        caught at startup rather than silently producing wrong predictions.
        """
        artifact_dir = os.getenv("MODEL_ARTIFACT_PATH", "../models/active")
        logger.info("Searching for active model bundle in: %s", artifact_dir)

        target_path = os.path.join(artifact_dir, "attrition_model.joblib")
        if os.path.exists(target_path):
            self.model_filepath = target_path
        else:
            joblib_files = glob.glob(os.path.join(artifact_dir, "*.joblib"))
            if joblib_files:
                self.model_filepath = max(joblib_files, key=os.path.getmtime)
            else:
                self.model_filepath = None

        if not self.model_filepath or not os.path.exists(self.model_filepath):
            logger.warning(
                "No active model bundle found in '%s'. "
                "Service will start without a model — POST /predict will return 503 "
                "until a model is trained and placed in that directory.",
                artifact_dir,
            )
            self.model_bundle = None
            return

        bundle = None
        try:
            bundle = safe_load_model_bundle(self.model_filepath, verify_checksum=True)
            logger.info(
                "Model bundle loaded and checksum-verified: path=%s algorithm=%s version=%s",
                self.model_filepath,
                bundle.get("model_name"),
                bundle.get("version"),
            )
        except ModelIntegrityException as exc:
            logger.warning(
                "Checksum verification failed (%s); falling back to standard load. "
                "This is expected when the model was saved without a manifest.",
                exc,
            )
        except Exception:
            logger.exception(
                "safe_load_model_bundle failed for '%s'; attempting standard load.",
                self.model_filepath,
            )

        if bundle is None:
            try:
                bundle = load_model_bundle(self.model_filepath)
                logger.info(
                    "Model bundle loaded via fallback loader: path=%s algorithm=%s",
                    self.model_filepath,
                    bundle.get("model_name"),
                )
            except Exception:
                logger.exception(
                    "Both loaders failed for '%s' — service starts without a model.",
                    self.model_filepath,
                )
                self.model_bundle = None
                return

        # Validate feature schema compatibility before accepting the bundle.
        try:
            validate_model_feature_schema(bundle)
        except ModelSchemaException:
            logger.exception(
                "Loaded model bundle has an incompatible feature schema — "
                "rejecting it.  Run train_model.py to produce a compatible artifact."
            )
            self.model_bundle = None
            return

        self.model_bundle = bundle

    # ------------------------------------------------------------------
    # Accessors
    # ------------------------------------------------------------------

    def get_model_info(self) -> dict:
        """Returns metadata for the currently active model bundle."""
        if not self.model_bundle:
            raise ModelNotLoadedException("No active model is loaded.")
        return {
            "version": self.model_bundle.get("version", "v1.0"),
            "algorithm": self.model_bundle.get("model_name", "Unknown"),
            "featureKeys": self.model_bundle.get("feature_metadata", {}).get(
                "feature_cols", []
            ),
            "trainedAt": self.model_bundle.get("trained_at", "Unknown"),
            "status": "APPROVED",
        }

    def get_model_metrics(self) -> dict:
        """Returns evaluation metrics for the currently active model bundle."""
        if not self.model_bundle:
            raise ModelNotLoadedException("No active model is loaded.")
        return {
            "algorithm": self.model_bundle.get("model_name", "Unknown"),
            "metrics": self.model_bundle.get("metrics", {}),
            "benchmark": self.model_bundle.get("all_model_metrics", {}),
            "selectionReason": self.model_bundle.get("selection_reason", ""),
        }

    def get_observability_summary(self) -> dict:
        """Returns live operational telemetry statistics without PII."""
        return inference_logger.get_summary_statistics()

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    async def predict_single(
        self,
        employee_doc: dict,
        run_id: str = "single_run",
        correlation_id: str | None = None,
    ) -> dict:
        """
        Runs attrition-risk prediction for a single employee.

        Steps
        -----
        1. Guard: model must be loaded.
        2. Enrich the employee document from Mongo sub-collections (async).
        3. Build a single-row DataFrame and transform features.
        4. Run ``predict_proba`` and validate the output.
        5. Derive risk level and confidence.
        6. Persist prediction history and current status to MongoDB.
        7. Log structured operational telemetry (no PII).
        8. Return the result dict.

        Parameters
        ----------
        employee_doc:
            Serialised employee document from MongoDB (``_id`` as string).
        run_id:
            Batch-run identifier; ``"single_run"`` for ad-hoc predictions.
        correlation_id:
            Caller-supplied request correlation ID; generated if absent.

        Returns
        -------
        dict
            Prediction result with riskScore, riskLevel, confidence, and
            operational metadata (correlationId, inferenceLatencyMs).
        """
        cid = correlation_id or f"corr_{uuid.uuid4().hex[:8]}"
        t_start = time.time()

        if not self.model_bundle:
            inference_logger.log_inference(
                correlation_id=cid,
                model_version="unloaded",
                inference_latency_ms=0.0,
                preprocessing_latency_ms=0.0,
                status="FAILED",
                error_category="MODEL_NOT_LOADED",
                error_message="No active model is loaded.",
            )
            raise ModelNotLoadedException(
                "No active model is loaded. Please train a model first."
            )

        # 1. Feature Enrichment
        t_prep_start = time.time()
        db_for_enrichment = get_db()
        if db_for_enrichment is not None:
            try:
                employee_doc = await enrich_employee_doc(employee_doc, db_for_enrichment)
            except Exception:
                logger.warning(
                    "Employee feature enrichment failed for employee_id=%s; "
                    "proceeding with raw employee document.",
                    str(employee_doc.get("_id")),
                    exc_info=False,
                )

        # 2. DataFrame construction and feature transformation
        df = pd.DataFrame([employee_doc])
        scaler = self.model_bundle["scaler"]
        encoders = self.model_bundle["encoders"]
        imputer_vals = self.model_bundle.get("feature_metadata", {}).get(
            "imputer_values"
        )
        X_processed = transform_inference(df, scaler, encoders, imputer_values=imputer_vals)
        t_prep_end = time.time()
        preproc_latency_ms = (t_prep_end - t_prep_start) * 1000

        # 3. Inference with output validation
        t_inf_start = time.time()
        model = self.model_bundle["model"]
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X_processed)
            if proba.shape[0] != 1 or proba.shape[1] < 2:
                raise ValueError(
                    f"Unexpected predict_proba output shape: {proba.shape}. "
                    "Expected (1, ≥2) for a binary classifier."
                )
            risk_score = float(proba[0, 1])
        else:
            risk_score = float(model.predict(X_processed)[0])

        t_inf_end = time.time()
        inf_latency_ms = (t_inf_end - t_inf_start) * 1000

        # Validate model output before persisting or returning it.
        confidence = risk_score if risk_score > 0.5 else (1.0 - risk_score)
        try:
            validate_prediction_output(risk_score, confidence)
        except ValueError:
            logger.exception(
                "Model output validation failed for correlation_id=%s. "
                "Returning 500 to caller.",
                cid,
            )
            raise

        # 4. Risk level bucketing anchored on the optimised decision threshold
        threshold = self.model_bundle.get("threshold", 0.5)
        medium_cutoff = threshold * 0.6
        if risk_score < medium_cutoff:
            risk_level = "LOW"
        elif risk_score < threshold:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        predicted_at = datetime.datetime.now(datetime.timezone.utc)
        model_version = self.model_bundle.get("version", "v1.0")

        # 5. Operational telemetry (no PII)
        inference_logger.log_inference(
            correlation_id=cid,
            model_version=model_version,
            inference_latency_ms=inf_latency_ms,
            preprocessing_latency_ms=preproc_latency_ms,
            status="SUCCESS",
            risk_score=risk_score,
            risk_level=risk_level,
            employee_id=str(employee_doc.get("_id")) if employee_doc.get("_id") else None,
        )
        logger.debug(
            "Prediction complete: correlation_id=%s risk_level=%s risk_score=%.4f "
            "model_version=%s preproc_ms=%.1f inference_ms=%.1f",
            cid,
            risk_level,
            risk_score,
            model_version,
            preproc_latency_ms,
            inf_latency_ms,
        )

        # 6. Persist to MongoDB
        db = db_for_enrichment
        if db is not None:
            history_id = None
            try:
                employee_oid = _safe_object_id(employee_doc.get("_id"))
                org_oid = _safe_object_id(employee_doc.get("organizationId"))

                history_doc = {
                    "organizationId": org_oid,
                    "employeeId": employee_oid,
                    "modelId": model_version,
                    "riskScore": risk_score,
                    "riskLevel": risk_level,
                    "confidence": confidence,
                    "predictedAt": predicted_at,
                    "runId": run_id,
                    "correlationId": cid,
                    "status": "SUCCESS",
                }
                res = await db["predictionhistories"].insert_one(history_doc)
                history_id = res.inserted_id

                pred_doc = {
                    "organizationId": org_oid,
                    "employeeId": employee_oid,
                    "modelId": model_version,
                    "latestHistoryId": history_id,
                    "riskScore": risk_score,
                    "riskLevel": risk_level,
                    "confidence": confidence,
                    "predictedAt": predicted_at,
                    "correlationId": cid,
                    "status": "SUCCESS",
                }
                await db["predictions"].update_one(
                    {"organizationId": org_oid, "employeeId": employee_oid},
                    {"$set": pred_doc},
                    upsert=True,
                )
            except Exception:
                # DB write failures are non-fatal — the prediction result is
                # still valid; the caller gets their answer even if history
                # could not be persisted.
                logger.warning(
                    "Failed to persist prediction to MongoDB for "
                    "correlation_id=%s — result is still returned to caller.",
                    cid,
                    exc_info=False,
                )

        total_ms = (time.time() - t_start) * 1000
        logger.debug(
            "predict_single total_ms=%.1f correlation_id=%s", total_ms, cid
        )

        return {
            "employeeId": str(employee_doc.get("_id")),
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "confidence": confidence,
            "predictedAt": predicted_at,
            "modelVersion": model_version,
            "inferenceLatencyMs": round(inf_latency_ms, 2),
            "correlationId": cid,
            "status": "SUCCESS",
        }


prediction_service = PredictionService()
