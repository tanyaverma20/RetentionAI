"""
app/training/trainer.py
=========================
Model training pipeline: benchmarks 5 algorithm families on an identical
train/test split (Phase 4), tunes the winning family's hyperparameters
(Phase 5), calibrates its probabilities (Phase 6), and optimizes the
decision threshold for recall-priority HR use (Phase 7). See
app/training/reports.py for the plot/report artifacts generated from the
resulting bundle.
"""

import io
import time
import datetime

import numpy as np
import joblib
from sklearn.base import clone
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, cross_val_predict
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score,
    average_precision_score, fbeta_score,
)
import xgboost as xgb
import lightgbm as lgb
from catboost import CatBoostClassifier


# ---------------------------------------------------------------------------
# Phase 4 — Model Benchmarking
# ---------------------------------------------------------------------------

# Root cause of the production Train Model crash: this function's output is
# reused as tune_hyperparameters()'s base_estimator, wrapped in a
# RandomizedSearchCV that ALSO parallelizes (see _TRAIN_CV_JOBS below). With
# n_jobs=-1 on both the inner model AND the outer search, each of the
# outer's worker processes independently tries to spawn its own full set of
# inner workers — nested parallelism that multiplies, not adds. os.cpu_count()
# (what n_jobs=-1 sizes itself against) reflects the HOST's visible CPUs, not
# the container's actual memory ceiling, so this went unnoticed locally and
# then OOM-killed the process the first time it ran on the real, memory-
# constrained deployment. Inner models are single-threaded here; the outer
# CV wrappers (RandomizedSearchCV, cross_val_predict) are the only
# parallelism layer, and even those are capped rather than -1 — see
# _TRAIN_CV_JOBS.
def _candidate_models(pos_weight: float) -> dict:
    return {
        "LogisticRegression": LogisticRegression(max_iter=1000, random_state=42, class_weight="balanced"),
        "RandomForest": RandomForestClassifier(
            n_estimators=200, random_state=42, class_weight="balanced", n_jobs=1,
        ),
        "XGBoost": xgb.XGBClassifier(
            random_state=42, eval_metric="logloss", scale_pos_weight=pos_weight, n_jobs=1,
        ),
        "LightGBM": lgb.LGBMClassifier(
            random_state=42, class_weight="balanced", verbosity=-1, n_jobs=1,
        ),
        "CatBoost": CatBoostClassifier(
            random_state=42, verbose=False, auto_class_weights="Balanced",
        ),
    }


# Bounds the outer-layer parallelism (RandomizedSearchCV, cross_val_predict)
# instead of leaving it at n_jobs=-1. Each worker is a separate process that
# gets its own copy of the training data and a partially-fitted model —
# uncapped, that's up to os.cpu_count() processes (8 on the current
# deployment host, per psutil), which is itself enough to OOM a
# memory-constrained container even with the inner-model nesting above fixed.
# 2 keeps genuine wall-clock benefit from parallel CV folds without the
# process count scaling with however many CPUs the host happens to report.
_TRAIN_CV_JOBS = 2


def _model_size_bytes(model) -> int:
    buf = io.BytesIO()
    joblib.dump(model, buf)
    return buf.tell()


def evaluate_model(model, X_test, y_test, threshold: float = 0.5) -> dict:
    """Computes performance metrics for a fitted model at a given decision threshold."""
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_test)[:, 1]
    else:
        probs = model.predict(X_test)
    preds = (probs >= threshold).astype(int)

    return {
        "accuracy": float(accuracy_score(y_test, preds)),
        "precision": float(precision_score(y_test, preds, zero_division=0)),
        "recall": float(recall_score(y_test, preds, zero_division=0)),
        "f1": float(f1_score(y_test, preds, zero_division=0)),
        "rocAuc": float(roc_auc_score(y_test, probs)) if len(set(y_test)) > 1 else 0.5,
        "prAuc": float(average_precision_score(y_test, probs)) if len(set(y_test)) > 1 else 0.0,
        "threshold": float(threshold),
    }


def benchmark_models(X_train, y_train, X_test, y_test) -> dict:
    """
    Trains Logistic Regression, Random Forest, XGBoost, LightGBM, and
    CatBoost on the identical train/test split and compares them on
    accuracy/precision/recall/F1/ROC-AUC/PR-AUC/training time/inference
    time/model size. Returns {name: {model, metrics}}.
    """
    pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    candidates = _candidate_models(pos_weight)

    results = {}
    for name, model in candidates.items():
        start = time.time()
        model.fit(X_train, y_train)
        training_time = time.time() - start

        start = time.time()
        metrics = evaluate_model(model, X_test, y_test, threshold=0.5)
        inference_time = (time.time() - start) / max(len(X_test), 1)

        metrics["trainingTimeSec"] = float(training_time)
        metrics["inferenceTimeMsPerRecord"] = float(inference_time * 1000)
        metrics["modelSizeBytes"] = _model_size_bytes(model)

        results[name] = {"model": model, "metrics": metrics}
        print(f"[Benchmark] {name}: acc={metrics['accuracy']:.3f} prec={metrics['precision']:.3f} "
              f"recall={metrics['recall']:.3f} f1={metrics['f1']:.3f} rocAuc={metrics['rocAuc']:.3f} "
              f"prAuc={metrics['prAuc']:.3f} trainTime={training_time:.2f}s")

    return results


def select_best_model(results: dict) -> str:
    """Selects the best-performing candidate by F1 (ROC-AUC as tiebreaker)."""
    return max(results, key=lambda n: (round(results[n]["metrics"]["f1"], 4), results[n]["metrics"]["rocAuc"]))


# ---------------------------------------------------------------------------
# Phase 5 — Hyperparameter Optimization
# ---------------------------------------------------------------------------

_PARAM_GRIDS = {
    "XGBoost": {
        "n_estimators": [100, 200, 300, 400],
        "max_depth": [3, 4, 5, 6, 8],
        "learning_rate": [0.01, 0.03, 0.05, 0.1, 0.2],
        "min_child_weight": [1, 3, 5, 7],
        "subsample": [0.6, 0.7, 0.8, 0.9, 1.0],
        "colsample_bytree": [0.6, 0.7, 0.8, 0.9, 1.0],
        "reg_alpha": [0, 0.01, 0.1, 1],
        "reg_lambda": [0.5, 1, 1.5, 2],
    },
    "LightGBM": {
        "n_estimators": [100, 200, 300, 400],
        "max_depth": [-1, 4, 6, 8, 10],
        "learning_rate": [0.01, 0.03, 0.05, 0.1, 0.2],
        "min_child_weight": [1e-3, 1e-2, 1e-1, 1],
        "subsample": [0.6, 0.7, 0.8, 0.9, 1.0],
        "colsample_bytree": [0.6, 0.7, 0.8, 0.9, 1.0],
        "reg_alpha": [0, 0.01, 0.1, 1],
        "reg_lambda": [0.5, 1, 1.5, 2],
    },
    "CatBoost": {
        "iterations": [100, 200, 300, 400],
        "depth": [3, 4, 5, 6, 8],
        "learning_rate": [0.01, 0.03, 0.05, 0.1, 0.2],
        "l2_leaf_reg": [1, 3, 5, 7, 9],
        "subsample": [0.6, 0.7, 0.8, 0.9, 1.0],
        "bootstrap_type": ["Bernoulli"],
    },
    "RandomForest": {
        "n_estimators": [100, 200, 300, 400],
        "max_depth": [None, 5, 10, 15, 20],
        "min_samples_split": [2, 5, 10],
        "min_samples_leaf": [1, 2, 4],
        "max_features": ["sqrt", "log2", None],
    },
    "LogisticRegression": {
        "C": [0.01, 0.03, 0.1, 0.3, 1, 3, 10],
        "penalty": ["l2"],
        "solver": ["lbfgs"],
    },
}


def tune_hyperparameters(model_name: str, X_train, y_train, n_iter: int = 25):
    """
    Systematic randomized search over the winning model family's
    hyperparameters (learning_rate, max_depth, n_estimators,
    min_child_weight, subsample, colsample_bytree, regularization —
    per family, as applicable), scored on F1 via 5-fold stratified CV.
    Returns (best_unfitted_estimator, best_params).
    """
    pos_weight = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
    base_estimator = _candidate_models(pos_weight)[model_name]
    param_grid = _PARAM_GRIDS[model_name]

    search = RandomizedSearchCV(
        base_estimator,
        param_distributions=param_grid,
        n_iter=n_iter,
        scoring="f1",
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42),
        random_state=42,
        n_jobs=_TRAIN_CV_JOBS,
        refit=False,  # we only need the winning hyperparameters, not a fitted copy
    )
    search.fit(X_train, y_train)

    tuned_estimator = clone(base_estimator)
    tuned_estimator.set_params(**search.best_params_)
    print(f"[HPO] Best {model_name} params: {search.best_params_} (cv F1={search.best_score_:.4f})")
    return tuned_estimator, search.best_params_


# ---------------------------------------------------------------------------
# Phase 6 — Probability Calibration
# ---------------------------------------------------------------------------

def calibrate_model(tuned_estimator, X_train, y_train):
    """
    Wraps the tuned (unfitted) estimator in isotonic calibration, fit via
    5-fold internal cross-validation on the training set. The Decision
    Engine consumes riskScore as a probability directly, so predict_proba
    must be well-calibrated, not just well-ranked.
    """
    calibrated = CalibratedClassifierCV(clone(tuned_estimator), method="isotonic", cv=5)
    calibrated.fit(X_train, y_train)
    return calibrated


# ---------------------------------------------------------------------------
# Phase 7 — Threshold Optimization
# ---------------------------------------------------------------------------

def optimize_threshold(tuned_estimator, X_train, y_train, beta: float = 2.0, min_precision: float = 0.3):
    """
    Sweeps candidate thresholds using out-of-fold cross-validated
    predictions on the training set only (X_test is never touched here,
    keeping it a clean final hold-out) and selects the one maximizing
    F-beta (beta=2 weights recall twice as heavily as precision, matching
    "prioritize identifying employees likely to leave while maintaining
    reasonable precision"), subject to a minimum precision floor so the
    HR Action Queue doesn't drown in false positives. 0.5 is never assumed.

    Returns (best_threshold, sweep_records).
    """
    calibrated_for_oof = CalibratedClassifierCV(clone(tuned_estimator), method="isotonic", cv=5)
    oof_probs = cross_val_predict(
        calibrated_for_oof, X_train, y_train, cv=5, method="predict_proba", n_jobs=_TRAIN_CV_JOBS,
    )[:, 1]

    thresholds = np.linspace(0.05, 0.95, 91)
    best_threshold, best_score = 0.5, -1.0
    sweep = []
    for t in thresholds:
        preds = (oof_probs >= t).astype(int)
        prec = precision_score(y_train, preds, zero_division=0)
        rec = recall_score(y_train, preds, zero_division=0)
        f2 = fbeta_score(y_train, preds, beta=beta, zero_division=0)
        sweep.append({"threshold": float(t), "precision": float(prec), "recall": float(rec), "f2": float(f2)})
        if prec >= min_precision and f2 > best_score:
            best_score = f2
            best_threshold = float(t)

    print(f"[Threshold] Selected {best_threshold:.2f} (F2={best_score:.4f}, min_precision={min_precision})")
    return best_threshold, sweep


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def train_and_select_best_model(X_train, X_test, y_train, y_test, scaler, encoders, feature_metadata) -> dict:
    """
    Runs Phases 4-7 end to end: benchmark 5 models -> tune the winner's
    hyperparameters -> calibrate its probabilities -> optimize the decision
    threshold -> package everything (plus the full benchmark comparison,
    for the benchmark report) into a model bundle.
    """
    print("=" * 30, "Phase 4: Model Benchmarking", "=" * 30)
    benchmark_results = benchmark_models(X_train, y_train, X_test, y_test)
    best_name = select_best_model(benchmark_results)
    print(f"Selected best-performing family: {best_name}")

    print("=" * 30, "Phase 5: Hyperparameter Optimization", "=" * 30)
    tuned_estimator, best_params = tune_hyperparameters(best_name, X_train, y_train)

    print("=" * 30, "Phase 6: Probability Calibration", "=" * 30)
    calibrated_model = calibrate_model(tuned_estimator, X_train, y_train)

    print("=" * 30, "Phase 7: Threshold Optimization", "=" * 30)
    threshold, threshold_sweep = optimize_threshold(tuned_estimator, X_train, y_train)

    final_metrics = evaluate_model(calibrated_model, X_test, y_test, threshold=threshold)
    final_metrics_default_threshold = evaluate_model(calibrated_model, X_test, y_test, threshold=0.5)
    print(f"[Final] {best_name} (tuned+calibrated) @ threshold={threshold:.2f}: {final_metrics}")

    # Feature importance is read from the tuned (uncalibrated) estimator —
    # CalibratedClassifierCV's internal clones don't expose a single
    # unified .feature_importances_/.coef_, so we fit the tuned estimator
    # once more on the full training set purely for importance reporting
    # (does not affect the calibrated model actually shipped in the bundle).
    importance_estimator = clone(tuned_estimator)
    importance_estimator.fit(X_train, y_train)

    bundle = {
        "model_name": best_name,
        "model": calibrated_model,
        "importance_estimator": importance_estimator,
        "scaler": scaler,
        "encoders": encoders,
        "feature_metadata": feature_metadata,
        "metrics": final_metrics,
        "metrics_at_default_threshold": final_metrics_default_threshold,
        "threshold": threshold,
        "threshold_sweep": threshold_sweep,
        "best_params": best_params,
        "calibration_method": "isotonic",
        "all_model_metrics": {name: res["metrics"] for name, res in benchmark_results.items()},
        "trained_at": datetime.datetime.now().isoformat(),
        "version": "v2.0",
    }
    return bundle


def save_model_bundle(bundle: dict, filepath: str):
    print(f"Saving model bundle to: {filepath}")
    joblib.dump(bundle, filepath)
    print("Model bundle saved successfully!")


def load_model_bundle(filepath: str):
    print(f"Loading model bundle from: {filepath}")
    return joblib.load(filepath)
