import math
from typing import List, Dict, Any

def compute_psi(baseline: List[float], target: List[float], bins: int = 5) -> Dict[str, Any]:
    """
    Computes Population Stability Index (PSI) between baseline and target distributions.
    PSI < 0.10: Stable
    0.10 <= PSI < 0.25: Moderate Drift
    PSI >= 0.25: Severe Drift
    """
    if not baseline or not target:
        return {"psi": 0.0, "status": "STABLE", "sample_size": 0}

    bin_width = 1.0 / bins
    psi_val = 0.0

    for i in range(bins):
        lower = i * bin_width
        upper = (i + 1) * bin_width

        # Count elements in bin
        if i == bins - 1:
            base_cnt = sum(1 for x in baseline if lower <= x <= upper)
            tgt_cnt = sum(1 for x in target if lower <= x <= upper)
        else:
            base_cnt = sum(1 for x in baseline if lower <= x < upper)
            tgt_cnt = sum(1 for x in target if lower <= x < upper)

        # Percentages with smoothing epsilon
        base_pct = max(base_cnt / len(baseline), 0.0001)
        tgt_pct = max(tgt_cnt / len(target), 0.0001)

        psi_val += (tgt_pct - base_pct) * math.log(tgt_pct / base_pct)

    psi_rounded = round(max(0.0, psi_val), 4)
    status = "STABLE"
    if psi_rounded >= 0.25:
        status = "SEVERE_DRIFT"
    elif psi_rounded >= 0.10:
        status = "MODERATE_DRIFT"

    return {
        "psi": psi_rounded,
        "status": status,
        "baseline_size": len(baseline),
        "target_size": len(target)
    }
