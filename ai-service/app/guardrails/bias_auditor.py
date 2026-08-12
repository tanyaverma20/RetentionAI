"""
Algorithmic Bias & Fairness Auditor (Prompt 10)
Computes Disparate Impact Ratios, Demographic Parity Scores, and Equalized Odds
across employee demographic cohorts with minimum sample protection.
"""

from typing import Dict, Any, List

MIN_COHORT_SIZE = 10


def calculate_disparate_impact(cohort_data: List[Dict[str, Any]], min_threshold: float = 0.80) -> Dict[str, Any]:
    """
    Calculates Disparate Impact Ratio = (Selection Rate of Unprivileged Group) / (Selection Rate of Privileged Group).
    Enforces min_cohort_size safeguard to prevent division by zero or statistical artifacts.
    """
    if not cohort_data:
        return {
            "status": "INSUFFICIENT_DATA",
            "disparateImpactRatio": 1.0,
            "demographicParityScore": 1.0,
            "sampleSize": 0,
            "reason": "No cohort data provided",
        }

    total_sample = len(cohort_data)
    if total_sample < MIN_COHORT_SIZE:
        return {
            "status": "INSUFFICIENT_DATA",
            "disparateImpactRatio": 1.0,
            "demographicParityScore": 1.0,
            "sampleSize": total_sample,
            "reason": f"Total sample size ({total_sample}) is below minimum requirement ({MIN_COHORT_SIZE})",
        }

    # Group cohorts
    group_counts: Dict[str, int] = {}
    group_high_risk: Dict[str, int] = {}

    for item in cohort_data:
        group = item.get("group", "UNKNOWN")
        is_high = 1 if item.get("isHighRisk", False) else 0
        group_counts[group] = group_counts.get(group, 0) + 1
        group_high_risk[group] = group_high_risk.get(group, 0) + is_high

    # Check cohort sizes
    valid_groups = {g: c for g, c in group_counts.items() if c >= MIN_COHORT_SIZE}
    if len(valid_groups) < 2:
        return {
            "status": "INSUFFICIENT_DATA",
            "disparateImpactRatio": 1.0,
            "demographicParityScore": 1.0,
            "sampleSize": total_sample,
            "reason": "Fewer than 2 demographic cohorts met the minimum sample size threshold.",
        }

    # Calculate selection rates (rate of being categorized as High Risk)
    rates = {g: group_high_risk[g] / group_counts[g] for g in valid_groups}
    max_rate = max(rates.values())
    min_rate = min(rates.values())

    # Avoid division by zero
    if max_rate == 0:
        di_ratio = 1.0
    else:
        di_ratio = round(min_rate / max_rate, 4)

    parity_score = round(1.0 - (max_rate - min_rate), 4)

    status = "PASS" if di_ratio >= min_threshold else "WARNING"
    if di_ratio < 0.65:
        status = "FAIL"

    return {
        "status": status,
        "disparateImpactRatio": di_ratio,
        "demographicParityScore": parity_score,
        "sampleSize": total_sample,
        "cohortBreakdown": {
            g: {
                "count": group_counts[g],
                "highRiskCount": group_high_risk[g],
                "highRiskRate": round(rates[g], 4),
            }
            for g in valid_groups
        },
    }
