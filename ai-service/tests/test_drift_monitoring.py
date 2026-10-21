import os
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app

from app.monitoring.drift_detector import (
    compute_psi,
    compute_feature_drift,
    compute_data_quality_report,
    compute_prediction_drift,
    compute_delayed_performance,
)
from app.preprocessing.pipeline import generate_synthetic_data, NUMERICAL_COLS, CATEGORICAL_COLS

AUTH_HEADERS = {"Authorization": f"Bearer {os.getenv('AI_SERVICE_TOKEN', 'test-token-not-a-placeholder')}"}
client = TestClient(app)


def test_psi_identical_distributions_is_near_zero():
    rng = np.random.default_rng(42)
    baseline = rng.normal(0, 1, size=500).tolist()
    target = rng.normal(0, 1, size=500).tolist()
    res = compute_psi(baseline, target, bins=10)
    assert res["psi"] < 0.10
    assert res["status"] == "STABLE"


def test_psi_shifted_distribution_detects_severe_drift():
    rng = np.random.default_rng(42)
    baseline = rng.normal(0, 1, size=500).tolist()
    target = rng.normal(2.5, 1, size=500).tolist()  # Significant mean shift
    res = compute_psi(baseline, target, bins=10)
    assert res["psi"] >= 0.25
    assert res["status"] == "SEVERE_DRIFT"


def test_feature_drift_detects_distributional_divergence():
    df_base = generate_synthetic_data(200)
    df_current = generate_synthetic_data(200)

    # Induce drift in overtime_hours and salary
    df_current["overtime_hours"] = df_current["overtime_hours"] * 2.5
    df_current["salary"] = df_current["salary"] * 0.70

    report = compute_feature_drift(
        baseline_df=df_base,
        current_df=df_current,
        numerical_cols=["salary", "overtime_hours", "age", "tenure_months"],
        categorical_cols=CATEGORICAL_COLS[:2],
    )
    assert report["driftedFeatureCount"] > 0
    assert "overtime_hours" in report["driftedFeatures"]


def test_data_quality_report_detects_anomalies():
    df = generate_synthetic_data(50)
    df.loc[0, "salary"] = -1000
    df.loc[1, "age"] = 140

    dq = compute_data_quality_report(df)
    assert len(dq["rangeAnomalies"]) >= 2
    assert dq["qualityHealthScore"] < 1.0


def test_prediction_drift_monitors_risk_distribution_shift():
    rng = np.random.default_rng(42)
    b_scores = rng.beta(2, 5, size=200).tolist()
    c_scores = rng.beta(5, 2, size=200).tolist()  # Skewed towards high risk

    p_drift = compute_prediction_drift(b_scores, c_scores, high_risk_threshold=0.5)
    assert p_drift["currentHighRiskRate"] > p_drift["baselineHighRiskRate"]
    assert p_drift["investigationRecommended"] is True


def test_delayed_performance_evaluation():
    y_true = [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1]
    y_prob = [0.85, 0.12, 0.78, 0.35, 0.90, 0.20, 0.15, 0.65, 0.30, 0.10, 0.70, 0.25, 0.40, 0.05, 0.88]

    res = compute_delayed_performance(y_true, y_prob, threshold=0.5)
    assert res["status"] == "COMPUTED"
    assert "prAuc" in res["metrics"]
    assert "brierScore" in res["metrics"]
    assert res["metrics"]["accuracy"] >= 0.70


def test_monitoring_prediction_drift_api_endpoint():
    payload = {
        "baselineScores": [0.2, 0.25, 0.3, 0.15, 0.4, 0.35],
        "currentScores": [0.6, 0.65, 0.7, 0.55, 0.8, 0.75],
        "highRiskThreshold": 0.5,
    }
    res = client.post("/monitoring/prediction-drift", json=payload, headers=AUTH_HEADERS)
    assert res.status_code == 200
    assert "psi" in res.json()
    assert "currentHighRiskRate" in res.json()


def test_monitoring_demo_api_endpoint():
    res = client.get("/monitoring/demo?drift_level=severe", headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["isDemonstration"] is True
    assert "dataQuality" in data
    assert "featureDrift" in data
    assert "predictionDrift" in data
