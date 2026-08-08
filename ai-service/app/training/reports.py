"""
app/training/reports.py
=========================
Generates the Sprint 8 deliverable artifacts (confusion matrix, ROC curve,
PR curve, calibration curve, feature importance chart) from a trained model
bundle, plus a single markdown report tying them together with the
benchmark/calibration/threshold numbers. Read-only with respect to the
bundle — never mutates it.
"""

import os
import json

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import confusion_matrix, roc_curve, precision_recall_curve

def _base_dir() -> str:
    """
    Resolved lazily (not at import time) so it always reflects the real
    MODEL_ARTIFACT_PATH env var regardless of whether the caller's
    load_dotenv() ran before or after importing this module — a module-level
    constant here previously computed a wrong path in train_model.py's
    standalone script (which imports this module before calling
    load_dotenv()), silently writing reports one directory above the repo.
    """
    return os.path.join(
        os.getenv("MODEL_ARTIFACT_PATH", os.path.join(os.path.dirname(__file__), "../../../../models/active")),
        "plots", "training",
    )


def _ensure_dir() -> str:
    path = _base_dir()
    os.makedirs(path, exist_ok=True)
    return path


def _save(fig, name: str) -> str:
    path = os.path.join(_ensure_dir(), name)
    fig.savefig(path, bbox_inches="tight", dpi=120)
    plt.close(fig)
    return path


def plot_confusion_matrix(y_test, probs, threshold: float) -> str:
    preds = (probs >= threshold).astype(int)
    cm = confusion_matrix(y_test, preds)
    fig, ax = plt.subplots(figsize=(5, 4))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks([0, 1]); ax.set_xticklabels(["Predicted: Stay", "Predicted: Leave"])
    ax.set_yticks([0, 1]); ax.set_yticklabels(["Actual: Stay", "Actual: Leave"])
    for i in range(2):
        for j in range(2):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                     color="white" if cm[i, j] > cm.max() / 2 else "black", fontsize=14, fontweight="bold")
    ax.set_title(f"Confusion Matrix (threshold={threshold:.2f})")
    fig.colorbar(im, ax=ax)
    return _save(fig, "confusion_matrix.png")


def plot_roc_curve(y_test, probs, roc_auc: float) -> str:
    fpr, tpr, _ = roc_curve(y_test, probs)
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(fpr, tpr, label=f"ROC (AUC={roc_auc:.3f})", color="#4f46e5")
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Random baseline")
    ax.set_xlabel("False Positive Rate"); ax.set_ylabel("True Positive Rate")
    ax.set_title("ROC Curve"); ax.legend(loc="lower right")
    return _save(fig, "roc_curve.png")


def plot_pr_curve(y_test, probs, pr_auc: float) -> str:
    precision, recall, _ = precision_recall_curve(y_test, probs)
    baseline = float(np.mean(y_test))
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(recall, precision, label=f"PR (AUC={pr_auc:.3f})", color="#db2777")
    ax.axhline(baseline, linestyle="--", color="gray", label=f"Baseline (positive rate={baseline:.2f})")
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
    ax.set_title("Precision-Recall Curve"); ax.legend(loc="upper right")
    return _save(fig, "pr_curve.png")


def plot_calibration_curve(y_test, probs, n_bins: int = 10) -> str:
    """Reliability diagram: predicted probability vs. observed frequency per bin."""
    bins = np.linspace(0, 1, n_bins + 1)
    bin_ids = np.digitize(probs, bins) - 1
    bin_ids = np.clip(bin_ids, 0, n_bins - 1)
    mean_pred, mean_actual = [], []
    for b in range(n_bins):
        mask = bin_ids == b
        if mask.sum() > 0:
            mean_pred.append(probs[mask].mean())
            mean_actual.append(y_test[mask].mean())
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot([0, 1], [0, 1], linestyle="--", color="gray", label="Perfectly calibrated")
    ax.plot(mean_pred, mean_actual, marker="o", color="#059669", label="Model")
    ax.set_xlabel("Mean Predicted Probability"); ax.set_ylabel("Observed Attrition Rate")
    ax.set_title("Calibration Curve (Reliability Diagram)"); ax.legend(loc="upper left")
    return _save(fig, "calibration_curve.png")


def plot_feature_importance(importance_estimator, feature_names) -> str:
    if hasattr(importance_estimator, "feature_importances_"):
        importances = np.asarray(importance_estimator.feature_importances_)
    elif hasattr(importance_estimator, "coef_"):
        importances = np.abs(np.asarray(importance_estimator.coef_)).ravel()
    else:
        return ""

    order = np.argsort(importances)[::-1][:20]
    fig, ax = plt.subplots(figsize=(7, 6))
    ax.barh([feature_names[i] for i in order][::-1], importances[order][::-1], color="#4f46e5")
    ax.set_xlabel("Importance"); ax.set_title("Feature Importance (Top 20)")
    return _save(fig, "feature_importance.png")


def generate_all_reports(bundle: dict, X_test, y_test) -> dict:
    """
    Generates every Phase 10 plot artifact plus a consolidated JSON/markdown
    report, saved under models/active/plots/training/. Returns a dict of
    generated file paths.
    """
    model = bundle["model"]
    threshold = bundle["threshold"]
    probs = model.predict_proba(X_test)[:, 1]
    y_test = np.asarray(y_test)

    paths = {
        "confusion_matrix": plot_confusion_matrix(y_test, probs, threshold),
        "roc_curve": plot_roc_curve(y_test, probs, bundle["metrics"]["rocAuc"]),
        "pr_curve": plot_pr_curve(y_test, probs, bundle["metrics"]["prAuc"]),
        "calibration_curve": plot_calibration_curve(y_test, probs),
    }
    feature_names = bundle["feature_metadata"]["numerical_cols"] + bundle["feature_metadata"]["categorical_cols"]
    fi_path = plot_feature_importance(bundle.get("importance_estimator"), feature_names)
    if fi_path:
        paths["feature_importance"] = fi_path

    report = {
        "trainedAt": bundle["trained_at"],
        "selectedModel": bundle["model_name"],
        "selectionReason": bundle.get("selection_reason", ""),
        "version": bundle["version"],
        "benchmark": bundle["all_model_metrics"],
        "bestParams": bundle["best_params"],
        "calibrationMethod": bundle["calibration_method"],
        "threshold": bundle["threshold"],
        "finalMetrics": bundle["metrics"],
        "metricsAtDefaultThreshold": bundle["metrics_at_default_threshold"],
        "plots": {k: os.path.relpath(v, _ensure_dir()) for k, v in paths.items()},
    }
    report_path = os.path.join(_ensure_dir(), "model_report.json")
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    paths["report_json"] = report_path

    return paths
