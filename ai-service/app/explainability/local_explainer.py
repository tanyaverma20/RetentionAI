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

import pandas as pd

from app.explainability.shap_explainer import shap_cache
from app.preprocessing.pipeline import transform_inference


# ---------------------------------------------------------------------------
# Human-readable value formatters for each feature
#
# Only the fields with an HR-meaningful unit get a bespoke format; every
# other numerical feature (including ones added to the pipeline after this
# was written) falls through to a generic one-decimal number, and every
# categorical feature is shown as-is. Nothing here depends on a fixed/known
# feature list — see explain_employee() below for how the actual key set is
# obtained from shap_cache.feature_names (derived from the trained model
# bundle), not hardcoded.
# ---------------------------------------------------------------------------

_UNIT_FORMATTERS = {
    "salary": lambda v: f"${float(v):,.0f}/yr",
    "age": lambda v: f"{float(v):.0f} years old",
    "tenure_months": lambda v: f"{float(v):.0f} months ({float(v) / 12:.1f} yrs)",
    "attendance_percentage": lambda v: f"{float(v):.1f}%",
    "avg_survey_score": lambda v: f"{float(v):.1f} / 5",
}


def _fmt(key: str, raw_val: Any, is_categorical: bool) -> str:
    """Return a human-readable string for a raw feature value."""
    if is_categorical:
        return str(raw_val)
    formatter = _UNIT_FORMATTERS.get(key)
    try:
        if formatter:
            return formatter(raw_val)
        return f"{float(raw_val):,.1f}"
    except (TypeError, ValueError):
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

def _build_explanation(
    employee_doc: dict,
    risk_score: float,
    risk_level: str,
    confidence: float,
    shap_vals,
    base_value: float,
    top_n: int = 10,
) -> dict:
    """
    Builds the full explanation payload (feature breakdown + narrative) from
    an already-computed risk score / SHAP row. Split out of explain_employee()
    so the same per-employee formatting logic can be reused by the batch path
    below without duplicating it — the model/SHAP computation itself (the
    expensive part) is what differs between the two callers, not this.
    """
    feature_keys = shap_cache.feature_names
    display_names = shap_cache.display_names
    categorical_keys = shap_cache.categorical_keys

    # Recover raw feature values from the original employee_doc for
    # interpretability. Only 'age'/'tenure_months' need special-case date
    # math (mirroring the exact same derivation pipeline.py itself applies
    # when the column isn't already present) — every other feature is read
    # generically by key, with the same fallback the model actually saw at
    # inference time (0 for missing numerical, 'UNKNOWN' for missing
    # categorical — see transform_inference), so what's displayed always
    # matches what was fed into the model. This works for any feature key
    # the trained pipeline reports, not just a fixed hardcoded set.
    current_date = pd.Timestamp.now()

    def _derived_age() -> float:
        dob = employee_doc.get("dateOfBirth")
        if not dob:
            return 0.0
        return (current_date - pd.to_datetime(dob).tz_localize(None)).days / 365.25

    def _derived_tenure_months() -> float:
        joining = employee_doc.get("joiningDate")
        if not joining:
            return 0.0
        return (current_date - pd.to_datetime(joining).tz_localize(None)).days / 30.43

    raw_values: dict[str, Any] = {}
    for key in feature_keys:
        if key == "age":
            raw_values[key] = employee_doc.get("age", _derived_age())
        elif key == "tenure_months":
            raw_values[key] = employee_doc.get("tenure_months", _derived_tenure_months())
        elif key in categorical_keys:
            raw_values[key] = str(employee_doc.get(key, "UNKNOWN"))
        else:
            raw_values[key] = employee_doc.get(key, 0)

    all_features = []
    for key, display, sv in zip(feature_keys, display_names, shap_vals):
        raw = raw_values.get(key, "N/A")
        is_categorical = key in categorical_keys
        all_features.append({
            "featureKey":     key,
            "displayName":    display,
            "shapValue":      float(sv),
            "absShapValue":   float(abs(sv)),
            "direction":      "INCREASES_RISK" if sv > 0 else "REDUCES_RISK",
            "rawValue":       raw,
            "formattedValue": _fmt(key, raw, is_categorical),
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


def _risk_level_for(risk_score: float, threshold: float) -> str:
    # Anchored on the Phase 7 recall-optimized threshold (see
    # app/training/trainer.py's optimize_threshold()), the same bucketing
    # prediction_service.py's predict_single() applies, so /explain and
    # /predict never disagree on an employee's risk level.
    medium_cutoff = threshold * 0.6
    if risk_score < medium_cutoff:
        return "LOW"
    if risk_score < threshold:
        return "MEDIUM"
    return "HIGH"


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

    df = pd.DataFrame([employee_doc])
    scaler = bundle["scaler"]
    encoders = bundle["encoders"]
    X = transform_inference(df, scaler, encoders)  # shape (1, n_features)

    model = bundle["model"]
    if hasattr(model, "predict_proba"):
        risk_score = float(model.predict_proba(X)[0, 1])
    else:
        risk_score = float(model.predict(X)[0])

    threshold = bundle.get("threshold", 0.5)
    risk_level = _risk_level_for(risk_score, threshold)
    confidence = risk_score if risk_score > 0.5 else (1.0 - risk_score)

    shap_vals = shap_cache.compute_shap_values(X)[0]  # shape (n_features,)
    base_value = shap_cache.get_expected_value()

    return _build_explanation(employee_doc, risk_score, risk_level, confidence, shap_vals, base_value, top_n)


def explain_employees_batch(employee_docs: list[dict], top_n: int = 10) -> list[dict]:
    """
    Vectorized batch counterpart to explain_employee() — computes feature
    transform, model inference, and SHAP values ONCE for the whole batch
    (one (N, n_features) matrix operation) instead of once per employee.

    Why this exists: explain_employee() builds a 1-row DataFrame and calls
    transform_inference/model.predict_proba/shap_cache.compute_shap_values
    per employee. Calling POST /explain/batch with no filter processes every
    ACTIVE employee (~1470 in the seeded dataset); at ~0.05s/employee of pure
    per-call Python/pandas/SHAP overhead, that's 70-100+ seconds — well past
    Express's 30s timeout, which is the direct cause of the "Generate
    Explanations" 503 AI_SERVICE_UNAVAILABLE error. Pandas/sklearn/SHAP are
    all vectorized for batch input; doing the same three calls ONCE across
    every row removes nearly all of that per-call overhead. Every other
    caller (explain_employee, used by /explain/{employeeId} and /explain)
    is untouched and behaves exactly as before.
    """
    if not shap_cache.is_ready:
        raise RuntimeError("SHAP explainer is not initialised. Call shap_cache.initialise() first.")
    if not employee_docs:
        return []

    from app.prediction.prediction_service import prediction_service, ModelNotLoadedException

    bundle = prediction_service.model_bundle
    if bundle is None:
        raise ModelNotLoadedException("No active model bundle loaded.")

    df = pd.DataFrame(employee_docs)
    scaler = bundle["scaler"]
    encoders = bundle["encoders"]
    X = transform_inference(df, scaler, encoders)  # shape (N, n_features)

    model = bundle["model"]
    if hasattr(model, "predict_proba"):
        risk_scores = model.predict_proba(X)[:, 1]
    else:
        risk_scores = model.predict(X)

    threshold = bundle.get("threshold", 0.5)
    shap_vals_batch = shap_cache.compute_shap_values(X)  # shape (N, n_features)
    base_value = shap_cache.get_expected_value()

    results = []
    for i, employee_doc in enumerate(employee_docs):
        risk_score = float(risk_scores[i])
        risk_level = _risk_level_for(risk_score, threshold)
        confidence = risk_score if risk_score > 0.5 else (1.0 - risk_score)
        results.append(
            _build_explanation(employee_doc, risk_score, risk_level, confidence, shap_vals_batch[i], base_value, top_n)
        )
    return results
