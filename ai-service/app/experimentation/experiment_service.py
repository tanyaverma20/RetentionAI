"""
app/experimentation/experiment_service.py
========================================
Service for creating, managing, and evaluating retention intervention experiments.
"""

import hashlib
import datetime
from typing import Dict, List, Any
import numpy as np

from app.experimentation.statistical_tests import (
    calculate_sample_size_per_variant,
    evaluate_proportions,
    compute_business_impact,
    audit_demographic_balance,
)
from app.experimentation.schemas import (
    ExperimentCreateRequest,
    ExperimentEvaluateRequest,
    ExperimentEvaluationResponse,
    StatisticalMetrics,
    BusinessImpact,
    FairnessAudit,
)


def assign_employee_to_variant(employee_id: str, experiment_id: str, salt: str = "retentionai_salt_v1") -> str:
    """
    Deterministic assignment to 'TREATMENT' or 'CONTROL' based on SHA-256 hash.
    Ensures identical variant assignment across repeated checks without stateful storage.
    """
    token = f"{experiment_id}:{employee_id}:{salt}".encode("utf-8")
    hash_val = int(hashlib.sha256(token).hexdigest()[:8], 16)
    return "TREATMENT" if (hash_val % 100) < 50 else "CONTROL"


def evaluate_experiment_outcomes(
    request: ExperimentEvaluateRequest,
) -> ExperimentEvaluationResponse:
    """
    Evaluates observed experiment outcomes and produces statistical metrics,
    confidence intervals, business impact, and fairness checks.
    """
    treatment_records = [o.model_dump() for o in request.outcomes if o.variant == "TREATMENT"]
    control_records = [o.model_dump() for o in request.outcomes if o.variant == "CONTROL"]

    t_total = len(treatment_records)
    c_total = len(control_records)

    if t_total == 0 or c_total == 0:
        raise ValueError("Experiment outcomes must include at least one record in both Treatment and Control groups.")

    t_retained = sum(1 for r in treatment_records if r["retained"])
    c_retained = sum(1 for r in control_records if r["retained"])

    # 1. Statistical Proportions Test
    stats_res = evaluate_proportions(
        treatment_successes=t_retained,
        treatment_total=t_total,
        control_successes=c_retained,
        control_total=c_total,
        alpha=request.significanceLevel,
    )

    # 2. Business Impact Analysis
    business_res = compute_business_impact(
        absolute_difference=stats_res["absolute_difference"],
        cost_per_treatment=request.interventionCostPerEmployee,
        replacement_cost=request.averageCostOfReplacement,
    )

    # 3. Demographic Balance / Fairness Audit
    fairness_res = audit_demographic_balance(treatment_records, control_records)

    # Check sample size adequacy (rule of thumb: at least 30 per group for reliable testing)
    adequate = t_total >= 30 and c_total >= 30

    # Executive narrative synthesis
    is_sig = stats_res["statistically_significant"]
    lift = stats_res["absolute_difference"]

    if is_sig and lift > 0:
        status = "STATISTICALLY_SIGNIFICANT_IMPROVEMENT"
        summary = (
            f"The intervention demonstrated a statistically significant improvement (p = {stats_res['p_value']:.4f}). "
            f"Retention increased by {lift:.1%} (95% CI: [{stats_res['ci_95'][0]:.1%}, {stats_res['ci_95'][1]:.1%}]). "
            f"{business_res['summary']}"
        )
        rec = "Recommend rolling out this retention intervention to the broader target workforce."
    elif not is_sig and lift > 0:
        status = "INCONCLUSIVE_POSITIVE_TREND"
        summary = (
            f"The intervention observed a positive retention trend (+{lift:.1%}), but the effect did not reach "
            f"statistical significance (p = {stats_res['p_value']:.4f} >= {request.significanceLevel}). "
            f"Observed sample size ({t_total + c_total} total) may be underpowered to detect this effect size."
        )
        rec = "Continue gathering outcomes or expand sample size before committing capital."
    elif is_sig and lift < 0:
        status = "STATISTICALLY_SIGNIFICANT_NEGATIVE_EFFECT"
        summary = (
            f"Warning: The intervention was associated with lower retention ({lift:.1%}, p = {stats_res['p_value']:.4f}). "
            f"Treated employees left at a higher rate than the control group."
        )
        rec = "Halt intervention immediately and investigate potential adverse friction."
    else:
        status = "NO_OBSERVED_EFFECT"
        summary = (
            f"No statistically meaningful difference was detected between Treatment ({stats_res['treatment_rate']:.1%}) "
            f"and Control ({stats_res['control_rate']:.1%}) groups (p = {stats_res['p_value']:.4f})."
        )
        rec = "Consider pivoting to an alternative retention lever."

    return ExperimentEvaluationResponse(
        experimentId=request.experimentId,
        status=status,
        sampleSizeAdequate=adequate,
        statistics=StatisticalMetrics(
            controlCount=c_total,
            controlRetained=c_retained,
            controlRetentionRate=stats_res["control_rate"],
            treatmentCount=t_total,
            treatmentRetained=t_retained,
            treatmentRetentionRate=stats_res["treatment_rate"],
            absoluteRiskDifference=stats_res["absolute_difference"],
            relativeLift=stats_res["relative_lift"],
            confidenceInterval95=stats_res["ci_95"],
            zStatistic=stats_res["z_statistic"],
            pValue=stats_res["p_value"],
            statisticalMethod=stats_res["method"],
            statisticallySignificant=is_sig,
        ),
        businessImpact=BusinessImpact(
            estimatedEmployeesSavedPer100Treated=business_res["employees_saved_per_100"],
            netFinancialImpactPer100Treated=business_res["net_financial_impact_per_100"],
            returnOnInvestmentPct=business_res["roi_pct"],
            practicalSignificanceSummary=business_res["summary"],
        ),
        fairnessAudit=FairnessAudit(
            isBalanced=fairness_res["is_balanced"],
            warnings=fairness_res["warnings"],
            genderDistribution=fairness_res["gender_distribution"],
        ),
        executiveSummary=summary,
        recommendation=rec,
        evaluatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        disclaimer=(
            "Retention evaluation results reflect empirical observations under this experiment's protocol. "
            "Extrapolating findings to different business units or macroeconomic conditions requires caution."
        ),
    )


def generate_synthetic_experiment_demo(
    n_samples: int = 240,
    baseline_retention: float = 0.78,
    true_treatment_effect: float = 0.09,
    random_seed: int = 42,
) -> Dict[str, Any]:
    """
    Generates a reproducible, explicitly labeled synthetic experiment dataset
    for demonstration and evaluation benchmarking.
    """
    rng = np.random.default_rng(random_seed)
    outcomes = []
    genders = ["MALE", "FEMALE", "NON_BINARY"]
    departments = ["dept_engineering", "dept_product", "dept_sales", "dept_ops"]

    for i in range(n_samples):
        emp_id = f"demo_emp_{i:04d}"
        variant = "TREATMENT" if i % 2 == 0 else "CONTROL"
        retention_prob = (baseline_retention + true_treatment_effect) if variant == "TREATMENT" else baseline_retention
        retained = bool(rng.random() < retention_prob)

        outcomes.append({
            "employeeId": emp_id,
            "variant": variant,
            "retained": retained,
            "gender": rng.choice(genders, p=[0.50, 0.45, 0.05]),
            "departmentId": rng.choice(departments),
            "tenureMonths": round(float(rng.uniform(6, 60)), 1),
            "baselineRisk": round(float(rng.uniform(0.3, 0.8)), 3),
        })

    eval_req = ExperimentEvaluateRequest(
        experimentId="demo_comp_adjustment_q3",
        organizationId="demo_org_synthetic",
        outcomes=outcomes,
        significanceLevel=0.05,
        averageCostOfReplacement=45000.0,
        interventionCostPerEmployee=2000.0,
    )

    evaluation = evaluate_experiment_outcomes(eval_req)
    result = evaluation.model_dump()
    result["isSyntheticDemonstration"] = True
    result["syntheticMetadata"] = {
        "sampleSize": n_samples,
        "underlyingTrueEffect": true_treatment_effect,
        "baselineRetention": baseline_retention,
        "note": "SIMULATED OUTCOME DATA FOR DEMONSTRATION PURPOSES ONLY. Not derived from real HR events.",
    }
    return result
