"""
global_explainer.py
===================
Global (population-level) SHAP feature importance.

Why this file exists
--------------------
Local explanations answer "why is THIS employee high risk?".
Global explanations answer "what features drive attrition across ALL employees?"

This module runs SHAP over the background dataset (100 samples) and aggregates
the results to produce:
  - Mean absolute SHAP per feature (global importance ranking)
  - Raw SHAP matrix for plot generation (beeswarm, bar, dependence)

Results are cached on the `shap_cache` singleton to avoid recomputation.
"""

from __future__ import annotations

import datetime

import numpy as np

from app.explainability.shap_explainer import shap_cache


def compute_global_importance(n_samples: int = 100) -> dict:
    """
    Compute mean |SHAP| across a background sample.

    Parameters
    ----------
    n_samples : how many background rows to explain (max = len(background_data))

    Returns
    -------
    dict with keys:
        features        : list of dicts with featureKey, displayName, meanAbsShap, rank
        shapMatrix      : list[list[float]] shape (n_samples, 10) — for plots
        baseValue       : float
        computedAt      : ISO timestamp
        modelName       : str
    """
    if not shap_cache.is_ready:
        raise RuntimeError("SHAP explainer is not initialised.")

    bg = shap_cache.background_data
    n = min(n_samples, len(bg))
    X_sample = bg[:n]

    # Compute SHAP over the background sample
    shap_matrix = shap_cache.compute_shap_values(X_sample)  # (n, 10)

    mean_abs = np.mean(np.abs(shap_matrix), axis=0)  # (10,)

    # Sort by importance descending
    order = np.argsort(mean_abs)[::-1]
    features = []
    for rank, idx in enumerate(order, start=1):
        features.append({
            "featureKey":   shap_cache.feature_names[idx],
            "displayName":  shap_cache.display_names[idx],
            "meanAbsShap":  round(float(mean_abs[idx]), 6),
            "rank":         rank,
        })

    return {
        "features":    features,
        "shapMatrix":  shap_matrix.tolist(),
        "baseValue":   round(shap_cache.get_expected_value(), 6),
        "computedAt":  datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "modelName":   shap_cache.model_name or "Unknown",
    }
