"""
tests/test_drift_rigor.py
=========================
Rigorously tests drift detection algorithms:
1. False-alarm testing: Two identical/stable distributions must report PSI < 0.10 and STABLE.
2. Sensitivity testing: A shifted distribution (+1.5 std or higher) must trigger SEVERE_DRIFT.
3. Categorical frequency shifts: New categories or shifted department proportions must be caught.
4. Prediction drift monitoring: Shifted risk distributions and alert recommendations.
5. Delayed-label performance degradation: Correctly measures accuracy/AUC/Brier drops.
"""

import pytest
import numpy as np
import pandas as pd
from app.monitoring.drift_detector import (
    compute_psi,
    compute_feature_drift,
    compute_data_quality_report,
    compute_prediction_drift,
    compute_delayed_performance,
)


def test_psi_identical_distributions_no_false_alerts():
    """
    Two independent random samples from the exact same N(0, 1) distribution
    must yield PSI < 0.10 and status 'STABLE' (no false alarms).
    """
    np.random.seed(42)
    sample_a = np.random.normal(50.0, 10.0, size=2000).tolist()
    sample_b = np.random.normal(50.0, 10.0, size=2000).tolist()

    result = compute_psi(sample_a, sample_b, bins=10)
    assert result["status"] == "STABLE"
    assert result["psi"] < 0.08  # Typically < 0.02 for identical distributions


def test_psi_shifted_distribution_triggers_severe_drift():
    """
    A distribution shifted by 1.5 standard deviations must reliably
    yield PSI >= 0.25 and status 'SEVERE_DRIFT'.
    """
    np.random.seed(42)
    sample_baseline = np.random.normal(50.0, 10.0, size=1500).tolist()
    # Shifted by 15.0 (1.5 sigma)
    sample_shifted = np.random.normal(65.0, 10.0, size=1500).tolist()

    result = compute_psi(sample_baseline, sample_shifted, bins=10)
    assert result["status"] == "SEVERE_DRIFT"
    assert result["psi"] >= 0.25


def test_psi_handles_small_sample_gracefully():
    """
    If either baseline or target has fewer than 5 observations,
    PSI returns STABLE with a diagnostic note, avoiding division by zero or crashing.
    """
    res = compute_psi([1.0, 2.0], [1.0, 2.0, 3.0])
    assert res["status"] == "STABLE"
    assert "Insufficient sample size" in res["note"]


def test_feature_drift_detects_numerical_and_categorical_shifts():
    """
    Feature drift correctly isolates the shifted columns from unchanged columns.
    """
    np.random.seed(42)
    n = 1000

    # Baseline data
    baseline_df = pd.DataFrame({
        "salary": np.random.normal(80000, 15000, size=n),
        "age": np.random.normal(35, 8, size=n),
        "department": np.random.choice(["Engineering", "Sales", "Support"], size=n, p=[0.5, 0.3, 0.2]),
    })

    # Current data: salary unchanged, age shifted by +10 years, department shifted heavily to Support
    current_df = pd.DataFrame({
        "salary": np.random.normal(80000, 15000, size=n),
        "age": np.random.normal(45, 8, size=n),  # +10 yrs shift
        "department": np.random.choice(["Engineering", "Sales", "Support"], size=n, p=[0.1, 0.1, 0.8]),
    })

    report = compute_feature_drift(
        baseline_df=baseline_df,
        current_df=current_df,
        numerical_cols=["salary", "age"],
        categorical_cols=["department"],
    )

    assert report["overallStatus"] in ["ACTION_RECOMMENDED", "MONITORING"]
    assert "age" in report["driftedFeatures"]
    assert "department" in report["driftedFeatures"]
    assert "salary" not in report["driftedFeatures"]

    # Age status should be severe drift
    assert report["featureReports"]["age"]["status"] == "SEVERE_DRIFT"
    assert report["featureReports"]["salary"]["status"] == "STABLE"


def test_prediction_drift_detects_risk_distribution_inflation():
    """
    If model prediction scores jump from 15% high-risk to 60% high-risk,
    prediction drift must flag this for operational investigation.
    """
    np.random.seed(42)
    # Baseline: beta distribution skewed low (mostly low attrition risk)
    baseline_scores = np.random.beta(2, 8, size=1000).tolist()
    # Current: shifted high (sudden wave of high risk predictions)
    current_scores = np.random.beta(6, 4, size=1000).tolist()

    res = compute_prediction_drift(baseline_scores, current_scores, high_risk_threshold=0.5)

    assert res["status"] in ["MODERATE_DRIFT", "SEVERE_DRIFT"]
    assert res["investigationRecommended"] is True
    assert res["currentMeanRisk"] > res["baselineMeanRisk"]
    assert res["currentHighRiskRate"] > res["baselineHighRiskRate"]


def test_delayed_label_performance_evaluates_accuracy_and_brier():
    """
    When delayed attrition outcomes arrive, delayed performance tracking
    computes accurate degradation metrics against predictions.
    """
    np.random.seed(42)
    ground_truth = [0] * 80 + [1] * 20
    # Good predictions
    predicted_probs = [0.1] * 75 + [0.7] * 5 + [0.85] * 18 + [0.2] * 2

    res = compute_delayed_performance(ground_truth, predicted_probs, threshold=0.5)

    assert res["status"] == "COMPUTED"
    assert res["evaluatedOutcomes"] == 100
    metrics = res["metrics"]
    assert "accuracy" in metrics
    assert "brierScore" in metrics
    assert "rocAuc" in metrics
    assert metrics["accuracy"] >= 0.85
    assert metrics["brierScore"] < 0.15
