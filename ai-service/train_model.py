import os
import datetime
from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

from app.preprocessing.pipeline import load_data_from_db, generate_synthetic_data, fit_transform_pipeline
from app.training.trainer import train_and_select_best_model, save_model_bundle

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "retentionai")
MODEL_ARTIFACT_PATH = os.getenv("MODEL_ARTIFACT_PATH", "../models/active")

def train_model():
    print("=" * 50)
    print("Starting Model Training Pipeline")
    print("=" * 50)
    
    # 1. Load data
    print(f"Connecting to MongoDB: {MONGODB_URI}...")
    df = load_data_from_db(MONGODB_URI, MONGODB_DB_NAME)
    
    if df.empty or len(df) < 20:
        print("WARNING: Insufficient or no employee data found in MongoDB.")
        print("Falling back to generating 1,000 synthetic employee records for training...")
        df = generate_synthetic_data(1000)
    else:
        print(f"Loaded {len(df)} employee records from MongoDB.")
        
    # 2. Run Preprocessing Pipeline
    print("Preprocessing and engineering features...")
    X, y, scaler, encoders, feature_metadata = fit_transform_pipeline(df)
    
    # 3. Train & Select Best Model
    print("Training models (Logistic Regression, Random Forest, XGBoost) and selecting the best...")
    bundle = train_and_select_best_model(X, y, scaler, encoders, feature_metadata)
    
    # 4. Save model bundle locally
    os.makedirs(MODEL_ARTIFACT_PATH, exist_ok=True)
    target_filepath = os.path.join(MODEL_ARTIFACT_PATH, "attrition_model.joblib")
    save_model_bundle(bundle, target_filepath)
    
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
                "accuracy": bundle["metrics"]["accuracy"],
                "precision": bundle["metrics"]["precision"]
            },
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
