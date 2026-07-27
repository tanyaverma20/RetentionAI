"""
local_explainer.py
==================
Employee-level (local) SHAP explanations.

Why this file exists
--------------------
Takes a single employee document, transforms it through the same preprocessing
pipeline used at training time, runs SHAP, and returns a structured payload
ready for the API response and React dashboard.

Outputs
-------
- Top-N positive contributors  (features that increase attrition risk)
- Top-N negative contributors  (features that decrease attrition risk)
- Full SHAP value array        (for custom visualisations)
- Base value                   (model's average prediction on training data)
- Plain-English narrative      (generated from templates, no LLM/NLP)
"""

from __future__ import annotations

import datetime
from typing import Any

import numpy as np
import pandas as pd

from app.explainability.shap_explainer import shap_cache
from app.preprocessing.pipeline import transform_inference


# ---------------------------------------------------------------------------
# Human-readable value formatters for each feature
# ---------------------------------------------------------------------------

def _fmt(key: str, raw_val: Any) -> str:
    """Return a human-readable string for a raw feature value."""
    try:
        if key == "salary":
            return f"${float(raw_val):,.0f}/yr"
        if key == "age":
            return f"{float(raw_val):.0f} years old"
        if key == "tenure_months":
            months = float(raw_val)
            return f"{months:.0f} months ({months / 12:.1f} yrs)"
        if key == "salary_per_tenure":
            return f"${float(raw_val):,.0f}/month of tenure"
        if key == "age_at_joining":
            return f"joined at age {float(raw_val):.0f}"
    except (TypeError, ValueError):
        pass
    return str(raw_val)


# ---------------------------------------------------------------------------
# Narrative builder — pure templates, zero NLP
# ---------------------------------------------------------------------------

_RISK_INTROS = {
    "LOW":    "This employee has a low attrition risk.",
    "MEDIUM": "This employee has a moderate attrition risk that warrants attention.",
    "HIGH":   "This employee is at high risk of leaving and requires prompt intervention.",
}

_DIRECTION_PHRASES = {
    True:  "significantly increases",
    False: "meaningfully reduces",
}


def build_narrative(
    top_positive: list[dict],
    top_negative: list[dict],
    risk_level: str,
    risk_score: float,
) -> str:
    """
    Compose a plain-English explanation from the top SHAP contributors.

    Parameters
    ----------
    top_positive : features pushing risk UP   (sorted by |shap|, descending)
    top_negative : features pushing risk DOWN  (sorted by |shap|, descending)
    risk_level   : 'LOW' | 'MEDIUM' | 'HIGH'
    risk_score   : float 0–1
    """
    parts: list[str] = [_RISK_INTROS.get(risk_level, "")]
    parts.append(
        f"The model assigns an attrition probability of {risk_score:.1%}."
    )

    if top_positive:
        driver = top_positive[0]
        parts.append(
            f"The primary risk driver is {driver['displayName']} "
            f"({driver['formattedValue']}), which "
            f"{_DIRECTION_PHRASES[True]} the likelihood of leaving."
        )
    if len(top_positive) > 1:
        others = ", ".join(c["displayName"] for c in top_positive[1:3])
        parts.append(f"Other contributing risk factors include: {others}.")

    if top_negative:
        protector = top_negative[0]
        parts.append(
            f"On the other hand, {protector['displayName']} "
            f"({protector['formattedValue']}) "
            f"{_DIRECTION_PHRASES[False]} the risk."
        )

    if risk_level == "HIGH":
        parts.append(
            "HR should consider a career-development discussion and a "
            "workload or compensation review as a priority."
        )
    elif risk_level == "MEDIUM":
        parts.append(
            "Proactive engagement such as a check-in or targeted survey "
            "is recommended to understand the employee's concerns."
        )
    else:
        parts.append(
            "No immediate intervention is required; standard retention "
            "practices should be maintained."
        )

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Main local explanation function
# ---------------------------------------------------------------------------

def explain_employee(employee_doc: dict, top_n: int = 10) -> dict:
    """
    Generate a local SHAP explanation for one employee.

    Parameters
    ----------
    employee_doc : raw employee dict (same schema as MongoDB document / API body)
    top_n        : number of top contributors to return in each direction

    Returns
    -------
    dict with keys:
        employeeId, riskScore, riskLevel, confidence,
        baseValue, shapValues (list),
        topPositiveContributors, topNegativeContributors,
        allFeatures,
        narrative, generatedAt
    """
    if not shap_cache.is_ready:
        raise RuntimeError("SHAP explainer is not initialised. Call shap_cache.initialise() first.")

    from app.prediction.prediction_service import prediction_service, ModelNotLoadedException

    bundle = prediction_service.model_bundle
    if bundle is None:
        raise ModelNotLoadedException("No active model bundle loaded.")

    # 1. Transform employee features
    df = pd.DataFrame([employee_doc])
    scaler = bundle["scaler"]
    encoders = bundle["encoders"]
    X = transform_inference(df, scaler, encoders)  # shape (1, 10)

    # 2. Predict probability
    model = bundle["model"]
    if hasattr(model, "predict_proba"):
        risk_score = float(model.predict_proba(X)[0, 1])
    else:
        risk_score = float(model.predict(X)[0])

    # 3. Risk level & confidence
    if risk_score <= 0.34:
        risk_level = "LOW"
    elif risk_score <= 0.64:
        risk_level = "MEDIUM"
    else:
        risk_level = "HIGH"

    confidence = risk_score if risk_score > 0.5 else (1.0 - risk_score)

    # 4. SHAP values
    shap_vals = shap_cache.compute_shap_values(X)[0]  # shape (10,)
    base_value = shap_cache.get_expected_value()

    # 5. Build per-feature dicts
    feature_keys = shap_cache.feature_names
    display_names = shap_cache.display_names

    # Recover raw feature values from the transformed df (pre-scale)
    # We rebuild from the original employee_doc for interpretability
    raw_values: dict[str, Any] = {
        "salary":           employee_doc.get("salary", 0),
        "age":              (
            (pd.Timestamp("2026-07-27") - pd.to_datetime(employee_doc.get("dateOfBirth", "1990-01-01")).tz_localize(None)).days / 365.25
            if employee_doc.get("dateOfBirth") else "N/A"
        ),
        "tenure_months":    (
            (pd.Timestamp("2026-07-27") - pd.to_datetime(employee_doc.get("joiningDate", "2020-01-01")).tz_localize(None)).days / 30.43
            if employee_doc.get("joiningDate") else "N/A"
        ),
        "salary_per_tenure": (
            employee_doc.get("salary", 0) / (
                max(
                    (pd.Timestamp("2026-07-27") - pd.to_datetime(employee_doc.get("joiningDate", "2020-01-01")).tz_localize(None)).days / 30.43,
                    1,
                )
            )
            if employee_doc.get("joiningDate") else "N/A"
        ),
        "age_at_joining":   "N/A",
        "gender":           employee_doc.get("gender", "N/A"),
        "employmentType":   employee_doc.get("employmentType", "N/A"),
        "workLocation":     employee_doc.get("workLocation", "N/A"),
        "designation":      employee_doc.get("designation", "N/A"),
        "departmentId":     str(employee_doc.get("departmentId", "N/A")),
    }

    all_features = []
    for key, display, sv in zip(feature_keys, display_names, shap_vals):
        raw = raw_values.get(key, "N/A")
        all_features.append({
            "featureKey":     key,
            "displayName":    display,
            "shapValue":      float(sv),
            "absShapValue":   float(abs(sv)),
            "direction":      "INCREASES_RISK" if sv > 0 else "REDUCES_RISK",
            "rawValue":       raw,
            "formattedValue": _fmt(key, raw),
        })

    # Sort by |shap| descending
    sorted_feats = sorted(all_features, key=lambda f: f["absShapValue"], reverse=True)

    top_positive = [f for f in sorted_feats if f["shapValue"] > 0][:top_n]
    top_negative = [f for f in sorted_feats if f["shapValue"] < 0][:top_n]
    top_10       = sorted_feats[:10]

    # 6. Build narrative
    narrative = build_narrative(top_positive, top_negative, risk_level, risk_score)

    return {
        "employeeId":              str(employee_doc.get("_id", "")),
        "riskScore":               round(risk_score, 4),
        "riskLevel":               risk_level,
        "confidence":              round(confidence, 4),
        "baseValue":               round(base_value, 4),
        "shapValues":              [round(float(v), 6) for v in shap_vals],
        "topPositiveContributors": top_positive,
        "topNegativeContributors": top_negative,
        "top10Features":           top_10,
        "allFeatures":             all_features,
        "narrative":               narrative,
        "generatedAt":             datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
