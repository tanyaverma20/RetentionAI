"""
app/preprocessing/enrichment.py
=================================
Async, single-employee real-data enrichment — the runtime counterpart of
pipeline.py's load_data_from_db() training-time joins.

Why this exists
----------------
Sprint 8 ML audit finding: most of the model's numerical features
(attendance, performance, promotion history, training, survey, and NLP
signals) have no source on the Employee document itself — they live in
separate Attendance/Performance/PromotionHistory/TrainingHistory/Survey/
EmployeeFeedback collections and Sprint 5's NLP insights. Any caller that
predicts or explains a real employee from just the raw Employee document
would silently get neutral defaults for most of the feature vector.

Both prediction (app/prediction/prediction_service.py) and explainability
(app/api/explain_routes.py) call this before transforming/explaining an
employee, so a SHAP explanation is always computed on the exact same
enriched feature values the corresponding prediction used — no train/serve
or predict/explain skew.
"""

import asyncio

import pandas as pd
from bson import ObjectId

from app.preprocessing.pipeline import _NEUTRAL_DEFAULTS


async def enrich_employee_doc(employee_doc: dict, db) -> dict:
    """
    Merges real signals from Attendance/Performance/PromotionHistory/
    TrainingHistory/Survey/EmployeeFeedback/nlp_insights onto a single
    employee document. Any field the caller's employee_doc already carries
    is left untouched (setdefault), and any collection with no record for
    this employee falls back to pipeline.py's documented neutral default
    rather than a fabricated value.
    """
    enriched = dict(employee_doc)
    raw_id = employee_doc.get("_id")
    if raw_id is None:
        return enriched

    try:
        eid = ObjectId(str(raw_id))
    except Exception:
        return enriched
    eid_str = str(raw_id)
    now = pd.Timestamp.now()

    # Root cause of the intermittent "Batch SHAP/Employee Intelligence
    # generation failed: 502" errors in production: these 7 queries are
    # independent (none depends on another's result) but were previously
    # awaited one at a time. At MongoDB Atlas's measured ~230ms round-trip
    # latency from this host (see /health/deep's dependencies.mongo.latencyMs),
    # that is ~1.6s of pure network wait per employee. With explain_batch's
    # semaphore(50) bounding concurrency, ~1470 employees is ~30 waves —
    # ~47s+ from serialized network latency alone, on top of real query
    # time — measured directly against production at 105s total, right at
    # the edge of the platform's request timeout, so it failed intermittently
    # depending on incidental load (e.g. a Train Model run shortly before).
    # Firing them concurrently collapses each employee's network wait to
    # ~1 round-trip instead of 7.
    attendance_docs, perf_doc, promo_docs, training_docs, survey_doc, feedback_count, ei_doc = await asyncio.gather(
        db["attendances"].find({"employeeId": eid}).to_list(length=None),
        db["performances"].find_one({"employeeId": eid}, sort=[("reviewPeriod", -1)]),
        db["promotionhistories"].find({"employeeId": eid}).to_list(length=None),
        db["traininghistories"].find({"employeeId": eid}).to_list(length=None),
        db["surveys"].find_one({"employeeId": eid}, sort=[("surveyDate", -1)]),
        db["employeefeedbacks"].count_documents({"employeeId": eid}),
        db["employeeintelligences"].find_one({"employeeId": eid}, sort=[("generatedAt", -1)]),
    )

    if attendance_docs:
        total = len(attendance_docs)
        present = sum(1 for d in attendance_docs if d.get("attendanceStatus") == "PRESENT")
        on_leave = sum(1 for d in attendance_docs if d.get("attendanceStatus") == "ON_LEAVE")
        overtimes = [d.get("overtimeHours") or 0.0 for d in attendance_docs]
        enriched.setdefault("attendance_percentage", (present / total) * 100.0)
        enriched.setdefault("leave_count", float(on_leave))
        enriched.setdefault("overtime_hours", float(sum(overtimes) / len(overtimes)))
    else:
        enriched.setdefault("attendance_percentage", _NEUTRAL_DEFAULTS["attendance_percentage"])
        enriched.setdefault("leave_count", _NEUTRAL_DEFAULTS["leave_count"])
        enriched.setdefault("overtime_hours", _NEUTRAL_DEFAULTS["overtime_hours"])

    enriched.setdefault("performance_rating", float(perf_doc["performanceScore"]) if perf_doc else _NEUTRAL_DEFAULTS["performance_rating"])

    joining_date = enriched.get("joiningDate")
    tenure_years = None
    if joining_date is not None:
        try:
            tenure_years = max((now - pd.to_datetime(joining_date).tz_localize(None)).days / 365.25, 0.01)
        except Exception:
            tenure_years = None
    if promo_docs:
        last_promo_date = max(pd.to_datetime(d["promotionDate"]) for d in promo_docs)
        years_since_promo = (now - last_promo_date).days / 365.25
        enriched.setdefault("promotion_count", float(len(promo_docs)))
        enriched.setdefault("salary_growth_pct", float(sum(d.get("salaryIncreasePercentage") or 0.0 for d in promo_docs)))
    else:
        years_since_promo = tenure_years if tenure_years is not None else _NEUTRAL_DEFAULTS["years_since_last_promotion"]
        enriched.setdefault("promotion_count", _NEUTRAL_DEFAULTS["promotion_count"])
        enriched.setdefault("salary_growth_pct", _NEUTRAL_DEFAULTS["salary_growth_pct"])
    enriched.setdefault("years_since_last_promotion", years_since_promo)
    enriched.setdefault("promotion_gap_ratio", (years_since_promo / tenure_years) if tenure_years else 0.0)
    enriched.setdefault("leave_frequency", (enriched.get("leave_count", 0.0) / tenure_years) if tenure_years else 0.0)

    if training_docs:
        total_hours = sum(d.get("durationHours") or 0.0 for d in training_docs)
        certified = sum(1 for d in training_docs if d.get("certificationEarned"))
        enriched.setdefault("training_hours", float(total_hours))
        enriched.setdefault("training_completion_rate", certified / len(training_docs))
    else:
        enriched.setdefault("training_hours", _NEUTRAL_DEFAULTS["training_hours"])
        enriched.setdefault("training_completion_rate", _NEUTRAL_DEFAULTS["training_completion_rate"])

    if survey_doc:
        dims = [survey_doc.get(f) for f in [
            "engagementScore", "careerGrowthScore", "managerRelationshipScore",
            "recognition", "compensationSatisfaction", "overallHappiness",
        ] if survey_doc.get(f) is not None]
        enriched.setdefault("job_satisfaction", float(survey_doc.get("jobSatisfaction") or 3.0))
        enriched.setdefault("work_life_balance", float(survey_doc.get("workLifeBalance") or 3.0))
        enriched.setdefault("engagement_score", float(survey_doc.get("engagementScore") or 3.0))
        enriched.setdefault("avg_survey_score", float(sum(dims) / len(dims)) if dims else 3.0)
    else:
        enriched.setdefault("job_satisfaction", _NEUTRAL_DEFAULTS["job_satisfaction"])
        enriched.setdefault("work_life_balance", _NEUTRAL_DEFAULTS["work_life_balance"])
        enriched.setdefault("engagement_score", _NEUTRAL_DEFAULTS["engagement_score"])
        enriched.setdefault("avg_survey_score", _NEUTRAL_DEFAULTS["avg_survey_score"])

    enriched.setdefault("feedback_frequency", float(feedback_count))

    # Root cause fixed here: this queried `nlp_insights` — this service's OWN
    # collection, written only by the legacy /nlp/analyze(/batch) endpoints,
    # which nothing in the real "Generate Employee Intelligence" flow
    # (server/src/services/employeeIntelligenceService.js) ever calls. That
    # collection has always been empty, so every live prediction/SHAP/
    # decision call fed the model neutral defaults for 4 of its 28 trained
    # features (sentiment_score, burnout_score, promotion_frustration_nlp,
    # manager_conflict_nlp) regardless of the employee's real sentiment or
    # burnout state — a train/serve skew for exactly the features this
    # module's own docstring says it exists to prevent. The real, populated
    # per-employee data lives in Express's `employeeintelligences` collection
    # (see app/nlp/repository.get_latest_employee_intelligence, fixed the
    # same way for the Decision Engine's NLP evidence step).
    if ei_doc:
        enriched.setdefault("sentiment_score", float(ei_doc["sentimentScore"]) if ei_doc.get("sentimentScore") is not None else _NEUTRAL_DEFAULTS["sentiment_score"])
        # burnoutScore is the 0-1 numeric field on this collection;
        # burnoutRisk there is a Low/Medium/High string — using it directly
        # (as the old nlp_insights-shaped code did) would silently corrupt
        # this numeric feature.
        enriched.setdefault("burnout_score", float(ei_doc["burnoutScore"]) if ei_doc.get("burnoutScore") is not None else _NEUTRAL_DEFAULTS["burnout_score"])
        # promotion_frustration_nlp / manager_conflict_nlp are computed
        # per-text by analyze_hr_text() but never aggregated to the employee
        # level (see _aggregate_employee_intelligence in
        # employee_intelligence_routes.py) — genuinely unavailable here, so
        # these stay at their documented neutral defaults rather than being
        # fabricated.
        enriched.setdefault("promotion_frustration_nlp", _NEUTRAL_DEFAULTS["promotion_frustration_nlp"])
        enriched.setdefault("manager_conflict_nlp", _NEUTRAL_DEFAULTS["manager_conflict_nlp"])
    else:
        enriched.setdefault("sentiment_score", _NEUTRAL_DEFAULTS["sentiment_score"])
        enriched.setdefault("burnout_score", _NEUTRAL_DEFAULTS["burnout_score"])
        enriched.setdefault("promotion_frustration_nlp", _NEUTRAL_DEFAULTS["promotion_frustration_nlp"])
        enriched.setdefault("manager_conflict_nlp", _NEUTRAL_DEFAULTS["manager_conflict_nlp"])

    return enriched
