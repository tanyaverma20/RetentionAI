import os
import datetime
import glob
from bson import ObjectId
import pandas as pd
from app.preprocessing.pipeline import transform_inference
from app.preprocessing.enrichment import enrich_employee_doc
from app.training.trainer import load_model_bundle
from app.utils.database import get_db

class ModelNotLoadedException(Exception):
    pass


def _safe_object_id(value):
    """Casts a Mongo id-like value to a real ObjectId, or returns None if it
    isn't one — used so predictionHistory/predictions writes match Node's
    Mongoose ObjectId schema instead of storing plain strings."""
    if value is None:
        return None
    if isinstance(value, ObjectId):
        return value
    try:
        return ObjectId(str(value))
    except Exception:
        return None


class PredictionService:
    def __init__(self):
        self.model_bundle = None
        self.model_filepath = None

    def load_active_model(self):
        """
        Loads the active model bundle from MODEL_ARTIFACT_PATH.
        """
        artifact_dir = os.getenv("MODEL_ARTIFACT_PATH", "../models/active")
        print(f"Searching for active model in: {artifact_dir}")
        
        # Look for attrition_model.joblib first, then fallback to any .joblib file
        target_path = os.path.join(artifact_dir, "attrition_model.joblib")
        if os.path.exists(target_path):
            self.model_filepath = target_path
        else:
            joblib_files = glob.glob(os.path.join(artifact_dir, "*.joblib"))
            if joblib_files:
                # Use the latest modified joblib file
                self.model_filepath = max(joblib_files, key=os.path.getmtime)
            else:
                self.model_filepath = None
                
        if self.model_filepath and os.path.exists(self.model_filepath):
            try:
                self.model_bundle = load_model_bundle(self.model_filepath)
                print(f"Successfully loaded model bundle: {self.model_filepath} (Model: {self.model_bundle['model_name']})")
            except Exception as e:
                print(f"Error loading model bundle from {self.model_filepath}: {e}")
                self.model_bundle = None
        else:
            print("No active model bundle found.")
            self.model_bundle = None

    def get_model_info(self):
        if not self.model_bundle:
            raise ModelNotLoadedException("No active model is loaded.")
        return {
            "version": self.model_bundle.get("version", "v1.0"),
            "algorithm": self.model_bundle.get("model_name", "Unknown"),
            "featureKeys": self.model_bundle.get("feature_metadata", {}).get("feature_cols", []),
            "trainedAt": self.model_bundle.get("trained_at", "Unknown"),
            "status": "APPROVED"
        }

    def get_model_metrics(self):
        if not self.model_bundle:
            raise ModelNotLoadedException("No active model is loaded.")
        return {
            "algorithm": self.model_bundle.get("model_name", "Unknown"),
            "metrics": self.model_bundle.get("metrics", {})
        }

    async def predict_single(self, employee_doc: dict, run_id: str = "single_run") -> dict:
        """
        Runs prediction for a single employee, stores history and current status in MongoDB,
        and returns the prediction result.
        """
        if not self.model_bundle:
            raise ModelNotLoadedException("No active model is loaded. Please train a model first.")

        # 1. Enrich with real Attendance/Performance/PromotionHistory/TrainingHistory/
        # Survey/EmployeeFeedback/NLP-insight signals (see _enrich_employee_doc) before
        # parsing — falls back to the caller's own employee_doc unchanged if no DB
        # connection is available (e.g. isolated unit tests).
        db_for_enrichment = get_db()
        if db_for_enrichment is not None:
            try:
                employee_doc = await enrich_employee_doc(employee_doc, db_for_enrichment)
            except Exception as e:
                print(f"Employee feature enrichment failed, using raw employee_doc: {e}")

        # 2. Parse and format employee data
        df = pd.DataFrame([employee_doc])

        # 4. Transform features
        scaler = self.model_bundle["scaler"]
        encoders = self.model_bundle["encoders"]
        X_processed = transform_inference(df, scaler, encoders)

        # 5. Predict probability (already calibrated — see Phase 6, the model
        # in the bundle is a CalibratedClassifierCV wrapping the tuned best model).
        model = self.model_bundle["model"]
        if hasattr(model, "predict_proba"):
            risk_score = float(model.predict_proba(X_processed)[0, 1])
        else:
            risk_score = float(model.predict(X_processed)[0])

        # 6. Risk level bucketing, anchored on the Phase 7 recall-optimized
        # decision threshold (never assumed to be 0.5 — see
        # app/training/trainer.py's optimize_threshold()) instead of a fixed
        # 0.34/0.64 split that was never derived from any evaluation.
        # HIGH starts at the optimized threshold; MEDIUM starts at 60% of it.
        threshold = self.model_bundle.get("threshold", 0.5)
        medium_cutoff = threshold * 0.6
        if risk_score < medium_cutoff:
            risk_level = "LOW"
        elif risk_score < threshold:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

        # 7. Compute confidence: probability of the predicted class (ranges from 0.5 to 1.0)
        confidence = risk_score if risk_score > 0.5 else (1.0 - risk_score)

        predicted_at = datetime.datetime.now(datetime.timezone.utc)
        model_version = self.model_bundle.get("version", "v1.0")

        # 8. Save logs to MongoDB
        # employeeId/organizationId must be real BSON ObjectIds, not strings —
        # Node's Prediction/PredictionHistory Mongoose schemas declare both as
        # ObjectId, and Node reads these same documents directly (rather than
        # writing its own copy). Writing them as plain strings (the JSON form
        # employee_doc arrives in) made every Node-side Mongoose lookup on
        # these collections — Prediction.findOne({employeeId}), the merged AI
        # Insights endpoint, explainService's predictionId join, Dashboard
        # $lookup aggregations — silently match nothing, since MongoDB does
        # strict BSON type comparison (an ObjectId query never equals a
        # string-typed stored value).
        db = db_for_enrichment
        history_id = None

        if db is not None:
            try:
                employee_oid = _safe_object_id(employee_doc.get("_id"))
                org_oid = _safe_object_id(employee_doc.get("organizationId"))

                # Insert into predictionHistory
                history_doc = {
                    "organizationId": org_oid,
                    "employeeId": employee_oid,
                    "modelId": model_version,
                    "riskScore": risk_score,
                    "riskLevel": risk_level,
                    "confidence": confidence,
                    "predictedAt": predicted_at,
                    "runId": run_id,
                    "status": "SUCCESS"
                }
                # "predictionhistories" — matches Node's Mongoose default
                # pluralization of the PredictionHistory model (previously
                # wrote to "predictionHistory", a distinct, disjoint
                # collection Node's schema never read from).
                res = await db["predictionhistories"].insert_one(history_doc)
                history_id = res.inserted_id

                # Upsert into predictions
                pred_doc = {
                    "organizationId": org_oid,
                    "employeeId": employee_oid,
                    "modelId": model_version,
                    "latestHistoryId": history_id,
                    "riskScore": risk_score,
                    "riskLevel": risk_level,
                    "confidence": confidence,
                    "predictedAt": predicted_at,
                    "status": "SUCCESS"
                }
                await db["predictions"].update_one(
                    {"employeeId": employee_oid},
                    {"$set": pred_doc},
                    upsert=True
                )
            except Exception as e:
                print(f"Failed to log prediction to MongoDB: {e}")
                
        return {
            "employeeId": str(employee_doc.get("_id")),
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "confidence": confidence,
            "predictedAt": predicted_at,
            "modelVersion": model_version,
            "status": "SUCCESS"
        }

prediction_service = PredictionService()
