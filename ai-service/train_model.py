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

import argparse
from app.preprocessing.pipeline import (
    load_data_from_db,
    load_ibm_attrition_csv,
    generate_synthetic_data,
    fit_transform_pipeline,
    fit_transform_split,
)
import shutil
from app.training.trainer import train_and_select_best_model, save_model_bundle
from app.training.reports import generate_all_reports
from app.prediction.prediction_service import prediction_service
from app.explainability.shap_explainer import shap_cache
from app.registry.model_registry import package_model_artifact, safe_load_model_bundle, evaluate_promotion_gate
from app.registry.experiment_tracker import experiment_tracker

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "retentionai")
MODEL_ARTIFACT_PATH = os.getenv("MODEL_ARTIFACT_PATH", "../models/active")
IBM_DATASET_CSV_PATH = os.getenv("IBM_DATASET_CSV_PATH")

def train_model(seed: int = 42, samples: int = 5000, test_size: float = 0.15, val_size: float = 0.15):
    print("=" * 50)
    print(f"Starting Model Training Pipeline (Seed: {seed}, Test: {test_size}, Val: {val_size})")
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

        status_col = df.get("status", pd.Series(dtype=object))
        terminated_count = (status_col == "TERMINATED").sum() if not df.empty else 0
        if df.empty or len(df) < 20 or status_col.nunique() < 2 or terminated_count < 5:
            print(f"WARNING: MongoDB contains {len(df)} records but only {terminated_count} TERMINATED records (needs >= 5).")
            print(f"Falling back to generating {samples} realistic synthetic employee records for training...")
            df = generate_synthetic_data(samples)
        else:
            print(f"Loaded {len(df)} employee records from MongoDB ({terminated_count} terminated).")
        
    # 2. Run Preprocessing Pipeline with 3-Way Split (Train/Val/Test)
    print("Preprocessing and engineering features with strict 3-way split...")
    X_train, X_val, X_test, y_train, y_val, y_test, scaler, encoders, feature_metadata = fit_transform_split(
        df, test_size=test_size, val_size=val_size, random_state=seed
    )

    # 3. Benchmark 5 model families, tune winner, calibrate, optimize threshold on Val partition
    print("Benchmarking Logistic Regression, Random Forest, XGBoost, LightGBM, and CatBoost...")
    bundle = train_and_select_best_model(
        X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata,
        X_val=X_val, y_val=y_val,
        evaluation_config={"seed": seed, "val_size": val_size, "test_size": test_size}
    )

    # 4. Save candidate model bundle to staging and evaluate promotion gate
    os.makedirs(MODEL_ARTIFACT_PATH, exist_ok=True)
    staging_dir = os.path.join(MODEL_ARTIFACT_PATH, "_staging")
    backup_dir = os.path.join(MODEL_ARTIFACT_PATH, "_backup_champion")
    os.makedirs(staging_dir, exist_ok=True)

    manifest = package_model_artifact(bundle, version=bundle.get("version", "v2.0"), output_dir=staging_dir)
    print(f"Packaged candidate model artifact in staging (SHA256: {manifest['sha256Checksum'][:12]}...)")

    # Evaluate promotion gate against current active champion (if exists)
    active_joblib = os.path.join(MODEL_ARTIFACT_PATH, "attrition_model.joblib")
    active_manifest_path = os.path.join(MODEL_ARTIFACT_PATH, "manifest.json")
    active_metrics = None
    if os.path.exists(active_joblib) and os.path.exists(active_manifest_path):
        try:
            active_bundle = safe_load_model_bundle(active_joblib, active_manifest_path)
            active_metrics = active_bundle.get("metrics")
        except Exception as e:
            print(f"Notice: Could not load prior active metrics ({e}). Proceeding as initial promotion.")

    approved, reason = evaluate_promotion_gate(bundle["metrics"], active_metrics)
    print(f"[Promotion Gate] {reason}")

    if not approved:
        print("WARNING: Candidate model did not satisfy promotion criteria. Preserving current active champion.")
        shutil.rmtree(staging_dir, ignore_errors=True)
        return

    # Backup current champion before atomic replacement
    if os.path.exists(active_joblib):
        os.makedirs(backup_dir, exist_ok=True)
        shutil.copy2(active_joblib, os.path.join(backup_dir, "attrition_model.joblib"))
        if os.path.exists(active_manifest_path):
            shutil.copy2(active_manifest_path, os.path.join(backup_dir, "manifest.json"))

    # Atomically promote candidate files to active directory
    shutil.copy2(os.path.join(staging_dir, "attrition_model.joblib"), active_joblib)
    shutil.copy2(os.path.join(staging_dir, "manifest.json"), active_manifest_path)
    shutil.rmtree(staging_dir, ignore_errors=True)

    # 4a. Log experiment run into local ExperimentTracker
    run_id = experiment_tracker.log_run(
        experiment_name="attrition_prediction_prod",
        model_name=bundle["model_name"],
        parameters={
            "seed": seed,
            "threshold": bundle["threshold"],
            "best_params": bundle["best_params"],
            "calibration_method": bundle["calibration_method"],
            "split_strategy": bundle.get("data_splits", {}).get("split_strategy"),
        },
        metrics=bundle["metrics"],
        validation_metrics=bundle.get("validation_metrics"),
        baseline_metrics=bundle.get("baseline_metrics"),
        candidate_benchmarks=bundle.get("all_model_metrics"),
        dataset_fingerprint=bundle.get("dataset_fingerprint", "untracked"),
        artifact_path=active_joblib,
        artifact_sha256=manifest["sha256Checksum"],
        is_champion=True,
    )
    print(f"Logged experiment run to ExperimentTracker: {run_id}")

    # 4b. Reload the freshly saved bundle into the running process with rollback protection
    try:
        prediction_service.load_active_model()
        if prediction_service.model_bundle is not None:
            shap_cache.initialise(prediction_service.model_bundle)
            print("Reloaded newly trained model into the running service (predictions + SHAP).")
        else:
            raise RuntimeError("Model bundle was None after loading.")
    except Exception as e:
        print(f"CRITICAL: Failed to load promoted champion into service ({e}). Rolling back to prior champion...")
        if os.path.exists(backup_dir):
            shutil.copy2(os.path.join(backup_dir, "attrition_model.joblib"), active_joblib)
            if os.path.exists(os.path.join(backup_dir, "manifest.json")):
                shutil.copy2(os.path.join(backup_dir, "manifest.json"), active_manifest_path)
            prediction_service.load_active_model()
            print("Rollback complete: Active champion preserved.")

    # 4c. Generate benchmark/calibration/threshold reports (JSON + Markdown) and plots
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
            "organizationId": ObjectId("60d5ec388832a828f8000000"),
            "version": bundle["version"],
            "runId": run_id,
            "algorithm": bundle["model_name"],
            "selectionReason": bundle.get("selection_reason", ""),
            "featureKeys": bundle["feature_metadata"]["feature_cols"],
            "metrics": {
                "f1": bundle["metrics"]["f1"],
                "recall": bundle["metrics"]["recall"],
                "rocAuc": bundle["metrics"]["rocAuc"],
                "prAuc": bundle["metrics"]["prAuc"],
                "prAucCvMean": bundle["metrics"].get("prAucCvMean", bundle["metrics"]["prAuc"]),
                "prAucCvStdErr": bundle["metrics"].get("prAucCvStdErr", 0.0),
                "accuracy": bundle["metrics"]["accuracy"],
                "precision": bundle["metrics"]["precision"],
                "brierScore": bundle["metrics"].get("brierScore", 0.0),
            },
            "validationMetrics": bundle.get("validation_metrics", bundle["metrics"]),
            "baselineMetrics": bundle.get("baseline_metrics", {}),
            "benchmark": bundle.get("all_model_metrics", {}),
            "threshold": bundle["threshold"],
            "calibrationMethod": bundle["calibration_method"],
            "artifactUri": "models/active/attrition_model.joblib",
            "artifactChecksum": manifest["sha256Checksum"],
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
    return bundle

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RetentionAI Model Training Pipeline")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--samples", type=int, default=5000, help="Number of synthetic records to generate if DB empty")
    parser.add_argument("--test-size", type=float, default=0.15, help="Proportion for holdout test set")
    parser.add_argument("--val-size", type=float, default=0.15, help="Proportion for validation partition")
    args = parser.parse_args()

    train_model(seed=args.seed, samples=args.samples, test_size=args.test_size, val_size=args.val_size)
