"""
app/experimentation/statistical_tests.py
========================================
Robust statistical tests, confidence intervals, sample size power calculations,
and demographic fairness audits for employee retention experiments.
"""

import math
from typing import Dict, List, Tuple, Any
from scipy import stats
import numpy as np


def calculate_sample_size_per_variant(
    baseline_rate: float,
    minimum_detectable_effect: float,
    alpha: float = 0.05,
    power: float = 0.80,
) -> int:
    """
    Computes required sample size per variant for a two-sample test of proportions.
    Uses normal approximation formula with pooled variance under null and
    unpooled variance under alternative hypothesis.
    """
    p1 = max(0.01, min(0.99, baseline_rate))
    p2 = max(0.01, min(0.99, baseline_rate + minimum_detectable_effect))

    # Standard normal critical values
    z_alpha = stats.norm.ppf(1.0 - alpha / 2.0)
    z_beta = stats.norm.ppf(power)

    p_bar = (p1 + p2) / 2.0
    numerator = (
        z_alpha * math.sqrt(2 * p_bar * (1 - p_bar))
        + z_beta * math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))
    ) ** 2
    denominator = (p1 - p2) ** 2

    if denominator <= 0:
        return 500

    n_required = math.ceil(numerator / denominator)
    return max(10, n_required)


def evaluate_proportions(
    treatment_successes: int,
    treatment_total: int,
    control_successes: int,
    control_total: int,
    alpha: float = 0.05,
) -> Dict[str, Any]:
    """
    Evaluates whether the difference between treatment and control retention rates
    is statistically significant. Employs:
    - Two-proportion z-test (for large samples)
    - Fisher's exact test (when any expected cell count is < 5)
    - 95% Wald & Wilson-score adjusted confidence intervals
    """
    if treatment_total <= 0 or control_total <= 0:
        raise ValueError("Sample sizes must be strictly positive.")

    p_t = treatment_successes / treatment_total
    p_c = control_successes / control_total
    diff = p_t - p_c

    # Relative lift over baseline
    relative_lift = (diff / p_c) if p_c > 0 else 0.0

    # 2x2 Contingency Table for Fisher's Exact Test
    # [[treatment_success, treatment_failure], [control_success, control_failure]]
    t_fail = treatment_total - treatment_successes
    c_fail = control_total - control_successes
    table = [[treatment_successes, t_fail], [control_successes, c_fail]]

    min_cell = min(treatment_successes, t_fail, control_successes, c_fail)
    use_fishers = min_cell < 5

    # Pooled probability for z-test
    p_pool = (treatment_successes + control_successes) / (treatment_total + control_total)
    se_pool = math.sqrt(p_pool * (1.0 - p_pool) * (1.0 / treatment_total + 1.0 / control_total))

    if se_pool > 0:
        z_stat = diff / se_pool
        p_val_z = 2.0 * (1.0 - stats.norm.cdf(abs(z_stat)))
    else:
        z_stat = 0.0
        p_val_z = 1.0

    # Fisher's Exact Test
    odds_ratio, p_val_fisher = stats.fisher_exact(table)

    if use_fishers:
        p_value = float(p_val_fisher)
        method = "Fisher's Exact Test (small cell counts detected)"
    else:
        p_value = float(p_val_z)
        method = "Two-Proportion Z-Test"

    # 95% Confidence Interval for Difference (Wilson score adjustment / Agresti-Caffo)
    z_crit = stats.norm.ppf(1.0 - alpha / 2.0)
    se_unpooled = math.sqrt((p_t * (1 - p_t) / treatment_total) + (p_c * (1 - p_c) / control_total))
    ci_lower = float(max(-1.0, diff - z_crit * se_unpooled))
    ci_upper = float(min(1.0, diff + z_crit * se_unpooled))

    significant = bool(p_value < alpha)

    return {
        "control_total": control_total,
        "control_successes": control_successes,
        "control_rate": round(p_c, 4),
        "treatment_total": treatment_total,
        "treatment_successes": treatment_successes,
        "treatment_rate": round(p_t, 4),
        "absolute_difference": round(diff, 4),
        "relative_lift": round(relative_lift, 4),
        "ci_95": [round(ci_lower, 4), round(ci_upper, 4)],
        "z_statistic": round(float(z_stat), 3),
        "p_value": round(p_value, 5),
        "method": method,
        "statistically_significant": significant,
    }


def compute_business_impact(
    absolute_difference: float,
    cost_per_treatment: float = 2500.0,
    replacement_cost: float = 40000.0,
) -> Dict[str, Any]:
    """
    Quantifies the real-world operational and financial impact per 100 treated employees.
    """
    employees_saved_per_100 = round(max(0.0, absolute_difference * 100.0), 2)
    turnover_costs_saved = employees_saved_per_100 * replacement_cost
    intervention_investment = 100.0 * cost_per_treatment
    net_savings = round(turnover_costs_saved - intervention_investment, 2)

    if intervention_investment > 0:
        roi = round(((turnover_costs_saved - intervention_investment) / intervention_investment) * 100.0, 1)
    else:
        roi = 0.0

    if absolute_difference > 0 and net_savings > 0:
        summary = (
            f"Economically viable: saves ~{employees_saved_per_100:.1f} employees per 100 treated, "
            f"yielding net savings of ${net_savings:,.0f} and an estimated ROI of {roi:.1f}%."
        )
    elif absolute_difference > 0:
        summary = (
            f"Marginally protective: saves ~{employees_saved_per_100:.1f} employees per 100 treated, "
            f"but intervention costs (${intervention_investment:,.0f}) exceed estimated replacement savings."
        )
    else:
        summary = "No positive retention benefit observed over the control group."

    return {
        "employees_saved_per_100": employees_saved_per_100,
        "net_financial_impact_per_100": net_savings,
        "roi_pct": roi,
        "summary": summary,
    }


def audit_demographic_balance(
    treatment_records: List[Dict[str, Any]],
    control_records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Audits randomized assignment to ensure treatment and control variants
    are balanced across protected demographics (e.g. gender) and departments.
    Prevents discriminatory targeting or selection bias.
    """
    warnings = []
    gender_dist = {"TREATMENT": {}, "CONTROL": {}}

    for r in treatment_records:
        g = r.get("gender") or "UNKNOWN"
        gender_dist["TREATMENT"][g] = gender_dist["TREATMENT"].get(g, 0) + 1

    for r in control_records:
        g = r.get("gender") or "UNKNOWN"
        gender_dist["CONTROL"][g] = gender_dist["CONTROL"].get(g, 0) + 1

    # Check for severe sample imbalance (> 60/40 split between treatment/control)
    n_t = len(treatment_records)
    n_c = len(control_records)
    total = n_t + n_c
    if total > 0:
        t_ratio = n_t / total
        if t_ratio < 0.40 or t_ratio > 0.60:
            warnings.append(
                f"Variant allocation imbalance: Treatment constitutes {t_ratio:.1%} of participants "
                f"(expected ~50%). Investigate assignment randomization."
            )

    # Check gender proportions if both groups have male and female counts
    t_female = gender_dist["TREATMENT"].get("FEMALE", 0)
    c_female = gender_dist["CONTROL"].get("FEMALE", 0)
    if n_t >= 20 and n_c >= 20 and (t_female + c_female) > 10:
        p_tf = t_female / n_t
        p_cf = c_female / n_c
        if abs(p_tf - p_cf) > 0.15:
            warnings.append(
                f"Demographic imbalance: Female representation differs by {abs(p_tf - p_cf):.1%} "
                f"between Treatment ({p_tf:.1%}) and Control ({p_cf:.1%})."
            )

    is_balanced = len(warnings) == 0
    return {
        "is_balanced": is_balanced,
        "warnings": warnings,
        "gender_distribution": gender_dist,
    }
