import time
import datetime
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import xgboost as xgb
import joblib

def evaluate_model(model, X_test, y_test, is_xgb=False):
    """
    Computes performance metrics for a model.
    """
    preds = model.predict(X_test)
    
    # Check if model supports predict_proba
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_test)[:, 1]
    else:
        probs = preds
        
    metrics = {
        "accuracy": float(accuracy_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds, zero_division=0)),
        "recall": float(recall_score(y_test, preds, zero_division=0)),
        "f1": float(f1_score(y_test, preds, zero_division=0)),
        "rocAuc": float(roc_auc_score(y_test, probs)) if len(set(y_test)) > 1 else 0.5
    }
    return metrics

def train_and_select_best_model(X, y, scaler, encoders, feature_metadata):
    """
    Splits data, trains Logistic Regression, Random Forest, and XGBoost models,
    compares them, and returns the best model packaged with all preprocessing artifacts.
    """
    # 1. Train/Test split
    # Handle case where we have too few samples or only one class
    if len(set(y)) < 2:
        # Fallback to train on all without stratified split if only one class present
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    else:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y, random_state=42)
        
    print(f"Training set size: {X_train.shape[0]}, Test set size: {X_test.shape[0]}")
    
    # 2. Initialize models
    models = {
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42),
        "RandomForest": RandomForestClassifier(n_estimators=100, random_state=42),
        "XGBoost": xgb.XGBClassifier(random_state=42, eval_metric='logloss')
    }
    
    results = {}
    
    # 3. Train and evaluate each model
    for name, model in models.items():
        start_time = time.time()
        model.fit(X_train, y_train)
        training_time = time.time() - start_time
        
        metrics = evaluate_model(model, X_test, y_test, is_xgb=(name == "XGBoost"))
        metrics["training_time_sec"] = float(training_time)
        results[name] = {
            "model": model,
            "metrics": metrics
        }
        
        print(f"Model: {name}")
        print(f"  Accuracy:  {metrics['accuracy']:.4f}")
        print(f"  Precision: {metrics['precision']:.4f}")
        print(f"  Recall:    {metrics['recall']:.4f}")
        print(f"  F1 Score:  {metrics['f1']:.4f}")
        print(f"  ROC-AUC:   {metrics['rocAuc']:.4f}")
        print(f"  Train Time:{metrics['training_time_sec']:.4f}s")
        print("-" * 30)
        
    # 4. Automatically choose the best model based on F1-score
    best_name = None
    best_f1 = -1.0
    
    for name, res in results.items():
        if res["metrics"]["f1"] > best_f1:
            best_f1 = res["metrics"]["f1"]
            best_name = name
            
    # Fallback to ROC-AUC if F1-scores are all 0
    if best_f1 == 0:
        best_auc = -1.0
        for name, res in results.items():
            if res["metrics"]["rocAuc"] > best_auc:
                best_auc = res["metrics"]["rocAuc"]
                best_name = name
                
    best_model_data = results[best_name]
    print(f"Selected Best Model: {best_name} (F1 Score: {best_model_data['metrics']['f1']:.4f})")
    
    # 5. Package model bundle
    bundle = {
        "model_name": best_name,
        "model": best_model_data["model"],
        "scaler": scaler,
        "encoders": encoders,
        "feature_metadata": feature_metadata,
        "metrics": best_model_data["metrics"],
        "all_model_metrics": {name: res["metrics"] for name, res in results.items()},
        "trained_at": datetime.datetime.now().isoformat(),
        "version": "v1.0"
    }
    
    return bundle

def save_model_bundle(bundle, filepath: str):
    """
    Saves the trained model bundle to the specified file path.
    """
    print(f"Saving model bundle to: {filepath}")
    joblib.dump(bundle, filepath)
    print("Model bundle saved successfully!")

def load_model_bundle(filepath: str):
    """
    Loads the trained model bundle from the specified file path.
    """
    print(f"Loading model bundle from: {filepath}")
    return joblib.load(filepath)
