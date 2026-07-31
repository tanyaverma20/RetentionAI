import os
import datetime
from dotenv import load_dotenv

# Loaded before any app.* import — some modules (e.g. app.training.reports)
# resolve MODEL_ARTIFACT_PATH-based paths at import time, so .env must be
# loaded first or they'll silently fall back to a wrong default path.
load_dotenv()

import pandas as pd
from bson import ObjectId
from pymongo import MongoClient

from app.preprocessing.pipeline import (
    load_data_from_db,
    load_ibm_attrition_csv,
    generate_synthetic_data,
    fit_transform_pipeline,
)
from app.training.trainer import train_and_select_best_model, save_model_bundle
from app.training.reports import generate_all_reports
from app.prediction.prediction_service import prediction_service
from app.explainability.shap_explainer import shap_cache

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "retentionai")
MODEL_ARTIFACT_PATH = os.getenv("MODEL_ARTIFACT_PATH", "../models/active")
# Optional: path to the public IBM HR Analytics Employee Attrition & Performance
# CSV (e.g. WA_Fn-UseC_-HR-Employee-Attrition.csv). When set and the file exists,
# training uses it instead of MongoDB/synthetic data.
IBM_DATASET_CSV_PATH = os.getenv("IBM_DATASET_CSV_PATH")

def train_model():
    print("=" * 50)
    print("Starting Model Training Pipeline")
    print("=" * 50)

    # 1. Load data — priority: IBM CSV dataset > MongoDB > synthetic fallback
    df = pd.DataFrame()
    if IBM_DATASET_CSV_PATH and os.path.exists(IBM_DATASET_CSV_PATH):
        print(f"Loading IBM HR Attrition dataset from: {IBM_DATASET_CSV_PATH}...")
        df = load_ibm_attrition_csv(IBM_DATASET_CSV_PATH)
        print(f"Loaded {len(df)} records from IBM HR Attrition dataset.")
    else:
        if IBM_DATASET_CSV_PATH:
            print(f"WARNING: IBM_DATASET_CSV_PATH is set but file not found: {IBM_DATASET_CSV_PATH}")
        print(f"Connecting to MongoDB: {MONGODB_URI}...")
        df = load_data_from_db(MONGODB_URI, MONGODB_DB_NAME)

        if df.empty or len(df) < 20:
            print("WARNING: Insufficient or no employee data found in MongoDB.")
            print("Falling back to generating 5,000 synthetic employee records for training...")
            df = generate_synthetic_data(5000)
        else:
            print(f"Loaded {len(df)} employee records from MongoDB.")
        
    # 2. Run Preprocessing Pipeline (split happens before scaler/encoder fitting
    # — see pipeline.py's fit_transform_pipeline for why)
    print("Preprocessing and engineering features...")
    X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata = fit_transform_pipeline(df)

    # 3. Benchmark 5 model families, tune the winner, calibrate, optimize threshold
    print("Benchmarking Logistic Regression, Random Forest, XGBoost, LightGBM, and CatBoost...")
    bundle = train_and_select_best_model(X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata)

    # 4. Save model bundle locally
    os.makedirs(MODEL_ARTIFACT_PATH, exist_ok=True)
    target_filepath = os.path.join(MODEL_ARTIFACT_PATH, "attrition_model.joblib")
    save_model_bundle(bundle, target_filepath)

    # 4a. Reload the freshly saved bundle into the RUNNING process. Without
    # this, /train writes a new model to disk but the live prediction_service/
    # shap_cache singletons keep serving whatever was loaded at process
    # startup — the new model would only ever take effect after a manual
    # FastAPI restart, silently. Mirrors app/main.py's own startup sequence.
    prediction_service.load_active_model()
    if prediction_service.model_bundle is not None:
        shap_cache.initialise(prediction_service.model_bundle)
        print("Reloaded newly trained model into the running service (predictions + SHAP).")
    else:
        print("WARNING: Failed to reload newly trained model bundle after training.")

    # 4b. Generate benchmark/calibration/threshold/feature-importance reports
    # and confusion matrix / ROC / PR / calibration curve plots.
    try:
        report_paths = generate_all_reports(bundle, X_test, y_test)
        print(f"Training reports generated: {report_paths}")
    except Exception as e:
        print(f"Failed to generate training reports: {e}")

    # 5. Save model metadata to MongoDB modelMetadata collection
    try:
        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB_NAME]
        
        # Deactivate previous active models
        db["modelMetadata"].update_many(
            {"status": "APPROVED"},
            {"$set": {"status": "RETIRED"}}
        )
        
        model_metadata_doc = {
            "organizationId": ObjectId("60d5ec388832a828f8000000"), # Standard demo org
            "version": bundle["version"],
            "algorithm": bundle["model_name"],
            "featureKeys": bundle["feature_metadata"]["feature_cols"],
            "metrics": {
                "f1": bundle["metrics"]["f1"],
                "recall": bundle["metrics"]["recall"],
                "rocAuc": bundle["metrics"]["rocAuc"],
                "prAuc": bundle["metrics"]["prAuc"],
                "accuracy": bundle["metrics"]["accuracy"],
                "precision": bundle["metrics"]["precision"]
            },
            "threshold": bundle["threshold"],
            "calibrationMethod": bundle["calibration_method"],
            "artifactUri": "models/active/attrition_model.joblib",
            "status": "APPROVED",
            "trainedAt": datetime.datetime.now(),
            "approvedBy": None
        }
        
        db["modelMetadata"].insert_one(model_metadata_doc)
        print("Model metadata successfully registered in MongoDB!")
    except Exception as e:
        print(f"Failed to register model metadata in MongoDB: {e}")
        
    print("=" * 50)
    print("Model Training Pipeline Completed Successfully!")
    print("=" * 50)

if __name__ == "__main__":
    train_model()
