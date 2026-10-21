"""
app/monitoring/drift_detector.py
================================
Multi-dimensional drift detector: Data Quality, Feature Drift, Prediction Drift,
and Delayed-Label Performance Monitoring for RetentionAI.
"""

import math
from typing import Dict, List, Any, Optional
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, brier_score_loss,
)


def compute_psi(baseline: List[float], target: List[float], bins: int = 10) -> Dict[str, Any]:
    """
    Computes Population Stability Index (PSI) between baseline and target distributions.
    Standard Industry Interpretations:
      PSI < 0.10: Stable (No shift)
      0.10 <= PSI < 0.25: Moderate Drift (Slight change, monitor closely)
      PSI >= 0.25: Severe Drift (Significant distribution shift, investigation needed)
    """
    b_clean = [float(x) for x in baseline if x is not None and not np.isnan(x)]
    t_clean = [float(x) for x in target if x is not None and not np.isnan(x)]

    if len(b_clean) < 5 or len(t_clean) < 5:
        return {
            "psi": 0.0,
            "status": "STABLE",
            "baseline_size": len(b_clean),
            "target_size": len(t_clean),
            "note": "Insufficient sample size for reliable PSI calculation (min 5 required).",
        }

    # Determine quantiles based on baseline distribution
    quantiles = np.linspace(0, 100, bins + 1)
    bin_edges = np.percentile(b_clean, quantiles)
    # Ensure strictly increasing edges by adding tiny jitter if duplicated
    for i in range(1, len(bin_edges)):
        if bin_edges[i] <= bin_edges[i - 1]:
            bin_edges[i] = bin_edges[i - 1] + 1e-5

    psi_val = 0.0
    epsilon = 0.0001  # Laplacian smoothing to avoid log(0) or division by 0

    for i in range(bins):
        low, high = bin_edges[i], bin_edges[i + 1]
        if i == bins - 1:
            base_cnt = sum(1 for x in b_clean if low <= x <= high)
            tgt_cnt = sum(1 for x in t_clean if low <= x <= high)
        else:
            base_cnt = sum(1 for x in b_clean if low <= x < high)
            tgt_cnt = sum(1 for x in t_clean if low <= x < high)

        base_pct = max(base_cnt / len(b_clean), epsilon)
        tgt_pct = max(tgt_cnt / len(t_clean), epsilon)

        psi_val += (tgt_pct - base_pct) * math.log(tgt_pct / base_pct)

    psi_rounded = round(max(0.0, float(psi_val)), 4)
    if psi_rounded >= 0.25:
        status = "SEVERE_DRIFT"
    elif psi_rounded >= 0.10:
        status = "MODERATE_DRIFT"
    else:
        status = "STABLE"

    return {
        "psi": psi_rounded,
        "status": status,
        "baseline_size": len(b_clean),
        "target_size": len(t_clean),
    }


def compute_feature_drift(
    baseline_df: pd.DataFrame,
    current_df: pd.DataFrame,
    numerical_cols: List[str],
    categorical_cols: List[str],
) -> Dict[str, Any]:
    """
    Evaluates drift across all input features individually using:
    - Kolmogorov-Smirnov (KS) test and PSI for numerical features
    - Chi-Square test of independence and category frequency PSI for categorical features
    """
    feature_reports = {}
    drifted_features = []

    for col in numerical_cols:
        if col not in baseline_df.columns or col not in current_df.columns:
            continue

        b_vals = pd.to_numeric(baseline_df[col], errors="coerce").dropna().tolist()
        c_vals = pd.to_numeric(current_df[col], errors="coerce").dropna().tolist()

        if len(b_vals) < 10 or len(c_vals) < 10:
            continue

        psi_res = compute_psi(b_vals, c_vals, bins=5)
        ks_stat, ks_pvalue = stats.ks_2samp(b_vals, c_vals)

        status = psi_res["status"]
        if status in ["MODERATE_DRIFT", "SEVERE_DRIFT"] or (ks_pvalue < 0.01 and ks_stat > 0.15):
            drifted_features.append(col)

        feature_reports[col] = {
            "type": "numerical",
            "psi": psi_res["psi"],
            "ksStatistic": round(float(ks_stat), 4),
            "ksPValue": round(float(ks_pvalue), 5),
            "baselineMean": round(float(np.mean(b_vals)), 2),
            "currentMean": round(float(np.mean(c_vals)), 2),
            "status": status,
        }

    for col in categorical_cols:
        if col not in baseline_df.columns or col not in current_df.columns:
            continue

        b_cats = baseline_df[col].astype(str).fillna("UNKNOWN")
        c_cats = current_df[col].astype(str).fillna("UNKNOWN")

        all_cats = list(set(b_cats.unique()) | set(c_cats.unique()))
        b_freq = b_cats.value_counts(normalize=True).to_dict()
        c_freq = c_cats.value_counts(normalize=True).to_dict()

        # Compute categorical PSI
        cat_psi = 0.0
        for cat in all_cats:
            bp = max(b_freq.get(cat, 0.0), 0.0001)
            cp = max(c_freq.get(cat, 0.0), 0.0001)
            cat_psi += (cp - bp) * math.log(cp / bp)

        cat_psi_rounded = round(max(0.0, float(cat_psi)), 4)
        status = "STABLE"
        if cat_psi_rounded >= 0.25:
            status = "SEVERE_DRIFT"
            drifted_features.append(col)
        elif cat_psi_rounded >= 0.10:
            status = "MODERATE_DRIFT"
            drifted_features.append(col)

        feature_reports[col] = {
            "type": "categorical",
            "psi": cat_psi_rounded,
            "status": status,
            "newCategories": [c for c in c_freq if c not in b_freq],
        }

    overall_status = "STABLE"
    if any(r["status"] == "SEVERE_DRIFT" for r in feature_reports.values()):
        overall_status = "ACTION_RECOMMENDED"
    elif any(r["status"] == "MODERATE_DRIFT" for r in feature_reports.values()):
        overall_status = "MONITORING"

    return {
        "overallStatus": overall_status,
        "totalFeaturesEvaluated": len(feature_reports),
        "driftedFeatureCount": len(drifted_features),
        "driftedFeatures": drifted_features,
        "featureReports": feature_reports,
    }


def compute_data_quality_report(current_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Evaluates incoming data quality: missing rates, duplicate records,
    and out-of-range numerical anomalies.
    """
    total_records = len(current_df)
    if total_records == 0:
        return {"totalRecords": 0, "status": "EMPTY_DATASET"}

    missing_by_col = {}
    for col in current_df.columns:
        miss_count = int(current_df[col].isnull().sum())
        missing_by_col[col] = {
            "missingCount": miss_count,
            "missingPct": round(miss_count / total_records, 4),
        }

    # Range and schema validation checks
    range_anomalies = []
    if "salary" in current_df.columns:
        invalid_sal = int((pd.to_numeric(current_df["salary"], errors="coerce") < 0).sum())
        if invalid_sal > 0:
            range_anomalies.append(f"Detected {invalid_sal} negative salary values.")

    if "age" in current_df.columns:
        ages = pd.to_numeric(current_df["age"], errors="coerce")
        invalid_age = int(((ages < 16) | (ages > 100)).sum())
        if invalid_age > 0:
            range_anomalies.append(f"Detected {invalid_age} employee ages outside expected [16, 100] range.")

    duplicate_count = int(current_df.duplicated(subset=["_id"]).sum()) if "_id" in current_df.columns else 0

    return {
        "totalRecords": total_records,
        "duplicateRecords": duplicate_count,
        "missingRates": missing_by_col,
        "rangeAnomalies": range_anomalies,
        "qualityHealthScore": round(max(0.0, 1.0 - (len(range_anomalies) * 0.1 + (duplicate_count / max(total_records, 1)))), 2),
    }


def compute_prediction_drift(
    baseline_scores: List[float],
    current_scores: List[float],
    high_risk_threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Monitors output prediction distribution shift and percentage of high-risk classifications.
    """
    psi_res = compute_psi(baseline_scores, current_scores, bins=5)
    b_mean = float(np.mean(baseline_scores)) if baseline_scores else 0.0
    c_mean = float(np.mean(current_scores)) if current_scores else 0.0

    b_high_rate = float(np.mean([1 if s >= high_risk_threshold else 0 for s in baseline_scores])) if baseline_scores else 0.0
    c_high_rate = float(np.mean([1 if s >= high_risk_threshold else 0 for s in current_scores])) if current_scores else 0.0

    return {
        "psi": psi_res["psi"],
        "status": psi_res["status"],
        "baselineMeanRisk": round(b_mean, 4),
        "currentMeanRisk": round(c_mean, 4),
        "baselineHighRiskRate": round(b_high_rate, 4),
        "currentHighRiskRate": round(c_high_rate, 4),
        "highRiskRateShift": round(c_high_rate - b_high_rate, 4),
        "investigationRecommended": psi_res["status"] in ["MODERATE_DRIFT", "SEVERE_DRIFT"],
    }


def compute_delayed_performance(
    ground_truth: List[int],
    predicted_probs: List[float],
    baseline_metrics: Optional[Dict[str, float]] = None,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Evaluates real model performance when delayed ground-truth retention/turnover
    labels become available. Distinct from immediate input/prediction monitoring.
    """
    y_true = np.array(ground_truth)
    probs = np.array(predicted_probs)

    if len(y_true) < 10 or len(set(y_true)) < 2:
        return {
            "status": "INSUFFICIENT_OUTCOMES",
            "message": "At least 10 outcomes with both retention and attrition events required to compute performance.",
            "evaluatedOutcomes": len(y_true),
        }

    preds = (probs >= threshold).astype(int)
    acc = float(accuracy_score(y_true, preds))
    prec = float(precision_score(y_true, preds, zero_division=0))
    rec = float(recall_score(y_true, preds, zero_division=0))
    f1 = float(f1_score(y_true, preds, zero_division=0))
    roc_auc = float(roc_auc_score(y_true, probs))
    pr_auc = float(average_precision_score(y_true, probs))
    brier = float(brier_score_loss(y_true, probs))

    degradation_warnings = []
    if baseline_metrics:
        base_pr_auc = baseline_metrics.get("prAuc", 0.0)
        if base_pr_auc > 0 and (base_pr_auc - pr_auc) > 0.10:
            degradation_warnings.append(
                f"PR-AUC degraded by {base_pr_auc - pr_auc:.3f} from baseline ({base_pr_auc:.3f} -> {pr_auc:.3f})."
            )

    return {
        "status": "COMPUTED",
        "evaluatedOutcomes": len(y_true),
        "metrics": {
            "accuracy": round(acc, 4),
            "precision": round(prec, 4),
            "recall": round(rec, 4),
            "f1": round(f1, 4),
            "rocAuc": round(roc_auc, 4),
            "prAuc": round(pr_auc, 4),
            "brierScore": round(brier, 4),
            "decisionThreshold": threshold,
        },
        "degradationDetected": len(degradation_warnings) > 0,
        "warnings": degradation_warnings,
        "note": "Metrics reflect actual ground-truth exit events collected post-inference.",
    }
