import os
import datetime
import glob
from bson import ObjectId
import pandas as pd
from app.preprocessing.pipeline import transform_inference
from app.training.trainer import load_model_bundle
from app.utils.database import get_db

class ModelNotLoadedException(Exception):
    pass

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

        # 1. Parse and format employee data
        df = pd.DataFrame([employee_doc])
        
        # 2. Transform features
        scaler = self.model_bundle["scaler"]
        encoders = self.model_bundle["encoders"]
        X_processed = transform_inference(df, scaler, encoders)
        
        # 3. Predict probability
        model = self.model_bundle["model"]
        if hasattr(model, "predict_proba"):
            risk_score = float(model.predict_proba(X_processed)[0, 1])
        else:
            risk_score = float(model.predict(X_processed)[0])
            
        # 4. Calibrate risk level based on database spec thresholds
        # LOW <= 0.34, MEDIUM <= 0.64, HIGH > 0.64
        if risk_score <= 0.34:
            risk_level = "LOW"
        elif risk_score <= 0.64:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"
            
        # 5. Compute confidence: probability of the predicted class (ranges from 0.5 to 1.0)
        confidence = risk_score if risk_score > 0.5 else (1.0 - risk_score)
        
        predicted_at = datetime.datetime.now(datetime.timezone.utc)
        model_version = self.model_bundle.get("version", "v1.0")
        
        # 6. Save logs to MongoDB
        db = get_db()
        history_id = None
        
        if db is not None:
            try:
                # Insert into predictionHistory
                history_doc = {
                    "organizationId": employee_doc.get("organizationId"),
                    "employeeId": employee_doc.get("_id"),
                    "modelId": model_version,
                    "riskScore": risk_score,
                    "riskLevel": risk_level,
                    "confidence": confidence,
                    "predictedAt": predicted_at,
                    "runId": run_id,
                    "status": "SUCCESS"
                }
                res = await db["predictionHistory"].insert_one(history_doc)
                history_id = res.inserted_id
                
                # Upsert into predictions
                pred_doc = {
                    "organizationId": employee_doc.get("organizationId"),
                    "employeeId": employee_doc.get("_id"),
                    "modelId": model_version,
                    "latestHistoryId": history_id,
                    "riskScore": risk_score,
                    "riskLevel": risk_level,
                    "predictedAt": predicted_at,
                    "status": "SUCCESS"
                }
                await db["predictions"].update_one(
                    {"employeeId": employee_doc.get("_id")},
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
