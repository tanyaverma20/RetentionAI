"""
plot_generator.py
=================
Generates and persists SHAP visualisation plots as PNG files.

Why this file exists
--------------------
React dashboards need static image URLs for SHAP charts. This module writes
all plots to `models/active/plots/` and returns the file paths so the API
can serve them or return their paths for the frontend to request.

Plot types
----------
LOCAL (per employee):
  - Waterfall plot : shows contribution of each feature from the base value
  - Force plot     : horizontal stacked-bar view of feature contributions
  - Decision plot  : cumulative SHAP path from base value to final prediction

GLOBAL (population):
  - Summary / Beeswarm : distribution of SHAP values across all background rows
  - Bar plot            : mean |SHAP| ranked bar chart
  - Dependence plot     : SHAP value vs raw feature value for a chosen feature

Implementation notes
--------------------
- `matplotlib` uses the non-interactive `Agg` backend (safe for servers).
- All SHAP plot functions that render to a `matplotlib.pyplot` figure are
  captured with `plt.gcf()` and saved explicitly.
- Files are named deterministically so repeated calls overwrite the previous
  version (no unbounded disk growth).
"""

from __future__ import annotations

import os
import matplotlib
matplotlib.use("Agg")           # must be set BEFORE importing pyplot
import matplotlib.pyplot as plt
import numpy as np
import shap

from app.explainability.shap_explainer import shap_cache

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BASE_DIR = os.path.join(
    os.getenv("MODEL_ARTIFACT_PATH", os.path.join(os.path.dirname(__file__), "../../../../models/active")),
    "plots",
)


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def _local_dir(employee_id: str) -> str:
    return _ensure_dir(os.path.join(_BASE_DIR, "local", str(employee_id)))


def _global_dir() -> str:
    return _ensure_dir(os.path.join(_BASE_DIR, "global"))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_explanation(shap_vals_1d: np.ndarray) -> shap.Explanation:
    """Wrap raw SHAP values into a shap.Explanation object for plot functions."""
    return shap.Explanation(
        values=shap_vals_1d,
        base_values=shap_cache.get_expected_value(),
        data=shap_cache.background_data[0],          # representative sample row
        feature_names=shap_cache.display_names,
    )


def _build_explanation_matrix(shap_matrix: np.ndarray) -> shap.Explanation:
    """Wrap a SHAP matrix into a shap.Explanation object for global plots."""
    n = shap_matrix.shape[0]
    return shap.Explanation(
        values=shap_matrix,
        base_values=np.full(n, shap_cache.get_expected_value()),
        data=shap_cache.background_data[:n],
        feature_names=shap_cache.display_names,
    )


def _save_and_close(fig, path: str) -> str:
    """Save the current matplotlib figure and close it."""
    fig.savefig(path, bbox_inches="tight", dpi=120)
    plt.close(fig)
    return path


# ---------------------------------------------------------------------------
# LOCAL PLOTS
# ---------------------------------------------------------------------------

def generate_waterfall_plot(shap_vals_1d: np.ndarray, employee_id: str) -> str:
    """
    Waterfall plot: shows each feature's additive contribution starting from
    the base (expected) value up to the final prediction.

    Returns the file path of the saved PNG.
    """
    out_path = os.path.join(_local_dir(employee_id), "waterfall.png")
    exp = _build_explanation(shap_vals_1d)

    plt.figure(figsize=(10, 6))
    shap.plots.waterfall(exp, max_display=10, show=False)
    fig = plt.gcf()
    fig.suptitle(f"Waterfall Plot — Employee {employee_id}", fontsize=11, y=1.02)
    return _save_and_close(fig, out_path)


def generate_force_plot(shap_vals_1d: np.ndarray, employee_id: str) -> str:
    """
    Force plot: a horizontal view where features push the prediction left
    (risk-reducing) or right (risk-increasing) from the base value.

    Returns the file path of the saved PNG.
    """
    out_path = os.path.join(_local_dir(employee_id), "force.png")

    shap.initjs()
    fp = shap.force_plot(
        shap_cache.get_expected_value(),
        shap_vals_1d,
        features=shap_cache.background_data[0],
        feature_names=shap_cache.display_names,
        matplotlib=True,
        show=False,
    )
    fig = plt.gcf()
    fig.suptitle(f"Force Plot — Employee {employee_id}", fontsize=11)
    return _save_and_close(fig, out_path)


def generate_decision_plot(shap_vals_1d: np.ndarray, employee_id: str) -> str:
    """
    Decision plot: traces the cumulative SHAP value path from the model's
    base value to the final prediction for one employee.

    Returns the file path of the saved PNG.
    """
    out_path = os.path.join(_local_dir(employee_id), "decision.png")

    plt.figure(figsize=(8, 8))
    shap.decision_plot(
        shap_cache.get_expected_value(),
        shap_vals_1d,
        feature_names=shap_cache.display_names,
        show=False,
    )
    fig = plt.gcf()
    fig.suptitle(f"Decision Plot — Employee {employee_id}", fontsize=11)
    return _save_and_close(fig, out_path)


# ---------------------------------------------------------------------------
# GLOBAL PLOTS
# ---------------------------------------------------------------------------

def generate_summary_plot(shap_matrix: np.ndarray) -> str:
    """
    Beeswarm / summary plot: shows the distribution and direction of SHAP
    values for every feature across all background samples.

    Returns the file path of the saved PNG.
    """
    out_path = os.path.join(_global_dir(), "summary_beeswarm.png")
    exp = _build_explanation_matrix(shap_matrix)

    plt.figure(figsize=(10, 7))
    shap.plots.beeswarm(exp, max_display=10, show=False)
    fig = plt.gcf()
    fig.suptitle("Global SHAP Summary (Beeswarm)", fontsize=12)
    return _save_and_close(fig, out_path)


def generate_bar_plot(shap_matrix: np.ndarray) -> str:
    """
    Bar plot: mean absolute SHAP value per feature, ranked.

    Returns the file path of the saved PNG.
    """
    out_path = os.path.join(_global_dir(), "summary_bar.png")
    exp = _build_explanation_matrix(shap_matrix)

    plt.figure(figsize=(10, 6))
    shap.plots.bar(exp, max_display=10, show=False)
    fig = plt.gcf()
    fig.suptitle("Global Feature Importance (Mean |SHAP|)", fontsize=12)
    return _save_and_close(fig, out_path)


def generate_dependence_plot(shap_matrix: np.ndarray, feature_name: str) -> str:
    """
    Dependence plot: scatter of raw feature value vs SHAP value for one feature,
    coloured by the most interacting feature.

    Parameters
    ----------
    feature_name : display name or raw key of the feature (fuzzy-matched)

    Returns the file path of the saved PNG.
    """
    # Resolve feature index
    display_names_lower = [d.lower() for d in shap_cache.display_names]
    feature_keys_lower  = [k.lower() for k in shap_cache.feature_names]

    idx = None
    needle = feature_name.lower()
    for i, (d, k) in enumerate(zip(display_names_lower, feature_keys_lower)):
        if needle in d or needle == k:
            idx = i
            break
    if idx is None:
        idx = 0  # fallback to first feature

    safe_name = feature_name.replace(" ", "_").replace("/", "-")
    out_path = os.path.join(_global_dir(), f"dependence_{safe_name}.png")

    n = shap_matrix.shape[0]
    bg = shap_cache.background_data[:n]

    plt.figure(figsize=(8, 6))
    shap.dependence_plot(
        idx,
        shap_matrix,
        bg,
        feature_names=shap_cache.display_names,
        show=False,
    )
    fig = plt.gcf()
    fig.suptitle(f"Dependence Plot — {shap_cache.display_names[idx]}", fontsize=12)
    return _save_and_close(fig, out_path)
