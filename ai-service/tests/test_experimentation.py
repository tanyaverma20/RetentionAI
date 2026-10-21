"""
tests/test_experimentation.py
=============================
Tests for A/B testing statistical calculations, sample size planning,
demographic fairness balance, and experiment API endpoints.
"""

import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

from app.experimentation.statistical_tests import (
    calculate_sample_size_per_variant,
    evaluate_proportions,
    compute_business_impact,
    audit_demographic_balance,
)
from app.experimentation.experiment_service import (
    assign_employee_to_variant,
    evaluate_experiment_outcomes,
    generate_synthetic_experiment_demo,
)
from app.experimentation.schemas import ExperimentEvaluateRequest, OutcomeRecord

AUTH_HEADERS = {"Authorization": f"Bearer {os.getenv('AI_SERVICE_TOKEN', 'test-token-not-a-placeholder')}"}
client = TestClient(app)


def test_sample_size_calculator_positive_and_bounded():
    # Baseline retention 80%, target MDE 5%
    n = calculate_sample_size_per_variant(baseline_rate=0.80, minimum_detectable_effect=0.05, power=0.80, alpha=0.05)
    assert n > 50
    assert n < 5000


def test_evaluate_proportions_significant_lift():
    # Treatment: 90 / 100 retained (90%)
    # Control: 70 / 100 retained (70%)
    res = evaluate_proportions(
        treatment_successes=90,
        treatment_total=100,
        control_successes=70,
        control_total=100,
        alpha=0.05,
    )
    assert res["absolute_difference"] == 0.20
    assert res["relative_lift"] > 0.25
    assert res["statistically_significant"] is True
    assert res["p_value"] < 0.05
    assert res["ci_95"][0] > 0.0  # Entire 95% CI is strictly positive


def test_evaluate_proportions_null_effect():
    # Treatment: 80 / 100
    # Control: 80 / 100
    res = evaluate_proportions(
        treatment_successes=80,
        treatment_total=100,
        control_successes=80,
        control_total=100,
        alpha=0.05,
    )
    assert res["absolute_difference"] == 0.0
    assert res["statistically_significant"] is False
    assert res["p_value"] > 0.90


def test_evaluate_proportions_uses_fishers_exact_on_small_cells():
    # Small counts where expected frequency < 5
    res = evaluate_proportions(
        treatment_successes=3,
        treatment_total=10,
        control_successes=1,
        control_total=10,
        alpha=0.05,
    )
    assert "Fisher's" in res["method"]


def test_business_impact_computation():
    impact = compute_business_impact(absolute_difference=0.08, cost_per_treatment=1500.0, replacement_cost=50000.0)
    assert impact["employees_saved_per_100"] == 8.0
    # 8 * 50,000 = 400,000; cost = 100 * 1500 = 150,000; net savings = 250,000
    assert impact["net_financial_impact_per_100"] == 250000.0
    assert impact["roi_pct"] > 100.0


def test_demographic_balance_detects_severe_skew():
    treatment = [{"gender": "MALE"} for _ in range(50)]
    control = [{"gender": "FEMALE"} for _ in range(50)]
    audit = audit_demographic_balance(treatment, control)
    assert audit["is_balanced"] is False
    assert len(audit["warnings"]) > 0


def test_deterministic_variant_assignment_consistency():
    emp_id = "emp_9921_test"
    exp_id = "exp_comp_review_2026"
    v1 = assign_employee_to_variant(emp_id, exp_id)
    v2 = assign_employee_to_variant(emp_id, exp_id)
    assert v1 == v2
    assert v1 in ["TREATMENT", "CONTROL"]


def test_synthetic_experiment_demo_structure():
    demo = generate_synthetic_experiment_demo(n_samples=100, true_treatment_effect=0.08)
    assert demo["isSyntheticDemonstration"] is True
    assert "statistics" in demo
    assert "businessImpact" in demo
    assert "fairnessAudit" in demo


def test_experiment_plan_api_endpoint():
    res = client.get("/experiments/plan?baseline_rate=0.82&mde=0.04", headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["sampleSizeRequiredPerVariant"] > 0
    assert "totalSampleSizeRequired" in data


def test_experiment_assign_api_endpoint():
    payload = {"experimentId": "exp_test_1", "employeeId": "emp_123", "organizationId": "60d5ec388832a828f8000000"}
    res = client.post("/experiments/assign", json=payload, headers=AUTH_HEADERS)
    assert res.status_code == 200
    assert res.json()["variant"] in ["TREATMENT", "CONTROL"]


def test_experiment_evaluate_api_endpoint():
    outcomes = []
    for i in range(40):
        outcomes.append({"employeeId": f"t_{i}", "variant": "TREATMENT", "retained": True, "gender": "MALE"})
        outcomes.append({"employeeId": f"c_{i}", "variant": "CONTROL", "retained": bool(i % 2 == 0), "gender": "MALE"})

    payload = {
        "experimentId": "exp_eval_api",
        "organizationId": "60d5ec388832a828f8000000",
        "outcomes": outcomes,
    }
    res = client.post("/experiments/evaluate", json=payload, headers=AUTH_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert "statistics" in data
    assert "businessImpact" in data
    assert "causalDisclaimer" not in data or "disclaimer" in data
