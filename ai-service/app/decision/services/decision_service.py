"""
app/decision/services/decision_service.py
===========================================
The AI Decision Intelligence Engine's business logic layer.

This is a thin, deterministic composition layer — it does NOT reimplement
ML, SHAP, NLP, or RAG. It:
  1. Reuses app.agent.orchestrator.orchestrate_recommendation() to assemble
     the evidence bundle and get an LLM-generated reasoning/action draft
     (ML + SHAP + NLP + RAG, already built in prior sprints).
  2. Runs the deterministic Business Rules engine over that SAME evidence
     to get the canonical `recommendationType` (fixed taxonomy) — this is
     the piece that was missing: without it, category selection was left
     entirely to free-text LLM choice.
  3. Merges both into the final Decision record shape this sprint requires.
  4. Appends an immutable log entry to this service's own `decisions`
     collection (satisfies "log every recommendation generation" as an
     audit trail, independent of whatever Express does with the same
     payload for its HR accept/dismiss/review workflow).

No tool-selection loop exists anywhere in this pipeline — every step always
runs, in the same fixed order, for every employee. This is a deterministic
decision pipeline, not an autonomous agent.
"""

from __future__ import annotations

import asyncio
import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
from bson import ObjectId

from app.agent.orchestrator.agent_orchestrator import orchestrate_recommendation
from app.decision.rules.rule_engine import evaluate as evaluate_rules, highest_priority
from app.prediction.prediction_service import prediction_service
from app.utils.database import get_db


def _compute_tenure_months(employee_doc: Dict[str, Any]) -> float:
    # Mirrors agent_orchestrator.py's own _get_tenure_string() calculation.
    #
    # Root cause fixed here: employeeData always arrives over HTTP as JSON,
    # where a joiningDate serializes to a "...Z"-suffixed ISO string (e.g.
    # from JS Date.toISOString()). pandas parses that as a TIMEZONE-AWARE
    # Timestamp, while pd.Timestamp.now() is timezone-NAIVE — subtracting
    # the two raises "Cannot subtract tz-naive and tz-aware datetime-like
    # objects", silently caught by the except below, returning 0.0 for
    # EVERY real employee. Verified directly: _compute_tenure_months on a
    # real 67.7-month-tenure employee's joiningDate returned 0.0, while an
    # employee_doc missing joiningDate (falls back to the naive literal
    # "2020-01-01" default) correctly returned a nonzero value — proving
    # the failure was specifically the aware/naive mismatch, not a general
    # parsing problem. This silently made every employee look like a
    # brand-new hire to the rule engine (tenureMonths < 6 always true) and
    # made "promotionOverdue"/tenure>=24 conditions always false, so
    # new_hire_mentorship over-fired while role_mismatch_long_tenure and
    # high_risk_burnout_promotion_overdue could never fire at all.
    try:
        joining = pd.to_datetime(employee_doc.get("joiningDate", "2020-01-01"))
        if joining.tzinfo is not None:
            joining = joining.tz_localize(None)
        return round((pd.Timestamp.now() - joining).days / 30.43, 1)
    except Exception:
        return 0.0


def _compute_risk_tier(risk_score: float) -> str:
    """
    LOW / MEDIUM / HIGH / VERY_HIGH — a finer split than the model's own
    3-bucket riskLevel, needed so the rule engine can distinguish a
    crisis-level employee from one that merely crossed the HIGH threshold.

    Derived proportionally from the SAME recall-optimized threshold
    prediction_service/local_explainer already use for LOW/MEDIUM/HIGH
    (medium_cutoff = threshold * 0.6) rather than a hardcoded number, so it
    stays consistent if the model is retrained with a different threshold.
    very_high_cutoff = threshold * 6.0 lands at ~0.42 for the currently
    active model (threshold=0.07) — which also matches the real, observed
    median risk score among today's HIGH-bucket employees (~0.42), i.e. this
    formula and the actual live data agree on where "HIGH" stops being
    "just crossed the line" and starts being "clearly, severely at risk".
    """
    threshold = prediction_service.model_bundle.get("threshold", 0.5) if prediction_service.model_bundle else 0.5
    medium_cutoff = threshold * 0.6
    very_high_cutoff = threshold * 6.0
    if risk_score < medium_cutoff:
        return "LOW"
    if risk_score < threshold:
        return "MEDIUM"
    if risk_score < very_high_cutoff:
        return "HIGH"
    return "VERY_HIGH"


async def _fetch_performance_and_engagement(employee_id: str) -> Dict[str, Any]:
    """
    Real performance rating and engagement-trend signals the rule engine
    needs for the Performance Improvement Plan and Career Discussion rules —
    fetched directly here (rather than threaded through the orchestrator's
    evidenceBundle) following this module's own established pattern of
    keeping rule-specific extras local so the reused orchestrator is never
    touched. Returns None values (not fabricated numbers) when no real
    record exists for a given signal.
    """
    db = get_db()
    try:
        oid = ObjectId(employee_id)
    except Exception:
        return {"performanceRating": None, "engagementScore": None, "engagementDeclining": False}

    perf_doc = await db["performances"].find_one({"employeeId": oid}, sort=[("reviewPeriod", -1)])
    performance_rating = float(perf_doc["performanceScore"]) if perf_doc and perf_doc.get("performanceScore") is not None else None

    surveys = await db["surveys"].find({"employeeId": oid}).sort("surveyDate", -1).to_list(length=3)
    engagement_score: Optional[float] = None
    engagement_declining = False
    if surveys and surveys[0].get("engagementScore") is not None:
        engagement_score = float(surveys[0]["engagementScore"])
    if len(surveys) >= 2:
        latest = surveys[0].get("engagementScore")
        previous = surveys[1].get("engagementScore")
        if latest is not None and previous is not None:
            # A real, meaningful drop between the two most recent surveys —
            # not just noise — flags a genuine decline, not a fabricated one.
            engagement_declining = float(latest) <= float(previous) - 0.3

    return {
        "performanceRating": performance_rating,
        "engagementScore": engagement_score,
        "engagementDeclining": engagement_declining,
    }


async def _build_rule_evidence(orchestrator_result: Dict[str, Any], employee_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extends the orchestrator's evidence bundle with a couple of derived
    signals the rule engine needs but the orchestrator doesn't compute
    itself (kept here rather than in agent_orchestrator.py so the reused
    orchestrator's tested behavior is never touched by this sprint).
    """
    eb = orchestrator_result.get("evidenceBundle", {})
    tenure_months = _compute_tenure_months(employee_doc)

    # "Promotion overdue" isn't a field the Employee schema tracks directly
    # (no PromotionHistory join is available here) — it's derived from two
    # real evidence signals: long tenure + an NLP-detected promotion/career
    # frustration signal. This is a documented heuristic, not a fabricated
    # fact, and only ever influences which *category* a recommendation gets,
    # never whether one is grounded in evidence at all.
    promotion_overdue = tenure_months >= 24 and eb.get("promotionFrustration", 0) >= 0.2

    employee_id = str(employee_doc.get("_id") or orchestrator_result.get("employeeId") or "")
    perf_and_engagement = await _fetch_performance_and_engagement(employee_id)

    return {
        **eb,
        "mlRiskLevel": orchestrator_result.get("riskLevel", eb.get("mlRiskLevel", "MEDIUM")),
        "mlRiskTier": _compute_risk_tier(orchestrator_result.get("attritionProbability", eb.get("mlRiskScore", 0.0))),
        "tenureMonths": tenure_months,
        "promotionOverdue": promotion_overdue,
        **perf_and_engagement,
    }


def _build_reasoning(orchestrator_result: Dict[str, Any], rule_result: Dict[str, Any]) -> str:
    llm_reasoning = orchestrator_result.get("reasoningSummary", "")
    rule_note = f"Business rule '{rule_result['ruleName']}' matched: {rule_result['ruleReasoning']}"
    if llm_reasoning:
        return f"{rule_note} {llm_reasoning}"
    return rule_note


def _build_evidence_summary(orchestrator_result: Dict[str, Any], rule_evidence: Dict[str, Any]) -> Dict[str, Any]:
    """The 'Evidence' field — must cite Prediction, SHAP, Employee Intelligence,
    Knowledge Base, and Business Rules, per the sprint's explicit requirement."""
    eb = orchestrator_result.get("evidenceBundle", {})
    return {
        "prediction": {
            "riskScore": eb.get("mlRiskScore"),
            "riskLevel": eb.get("mlRiskLevel"),
            "confidence": eb.get("mlConfidence"),
        },
        "shap": {
            "topRiskFeatures": eb.get("topRiskFeatures", []),
            "topProtectiveFeatures": eb.get("topProtectiveFeatures", []),
        },
        "employeeIntelligence": {
            "sentiment": eb.get("sentiment"),
            "burnoutRisk": eb.get("burnoutRisk"),
            "resignationIntent": eb.get("resignationIntent"),
            "detectedTopics": eb.get("detectedTopics", []),
        },
        "knowledgeBase": {
            "policiesFound": eb.get("ragPoliciesFound", []),
        },
        "businessRules": {
            "ruleName": rule_evidence.get("ruleName"),
            "ruleReasoning": rule_evidence.get("ruleReasoning"),
        },
    }


async def generate_decision(employee_id: str, employee_doc: Dict[str, Any], user_id: str = "system") -> Dict[str, Any]:
    """
    Runs the full Decision Intelligence pipeline for one employee:
    Employee Profile (input) -> Prediction -> SHAP -> Employee Intelligence
    -> Knowledge retrieval -> Business Rules -> Recommendation -> Reasoning.
    """
    orchestrator_result = await orchestrate_recommendation(employee_id, employee_doc)

    rule_evidence = await _build_rule_evidence(orchestrator_result, employee_doc)
    rule_result = evaluate_rules(rule_evidence)

    # Rules are authoritative for priority when they fire on anything other
    # than the default fallback; otherwise defer to the LLM/ML-risk-derived
    # priority already computed by the orchestrator.
    if rule_result["ruleName"] == "default_no_action":
        final_priority = orchestrator_result.get("priority", "LOW")
    else:
        final_priority = highest_priority(rule_result["priority"], orchestrator_result.get("priority", "LOW"))

    decision = {
        "employeeId": employee_id,
        "recommendationType": rule_result["recommendationType"],
        "priority": final_priority,
        "confidence": orchestrator_result.get("confidence", {}).get("recommendationConfidence", 0.0),
        "reasoning": _build_reasoning(orchestrator_result, rule_result),
        "evidence": _build_evidence_summary(orchestrator_result, rule_result),
        "affectedFactors": list(dict.fromkeys(
            (orchestrator_result.get("topRiskFactors") or []) + (orchestrator_result.get("positiveFactors") or [])
        )),
        "relatedPolicies": orchestrator_result.get("policyReferences", []),
        "expectedOutcome": orchestrator_result.get("expectedBusinessImpact", ""),
        "reviewDate": orchestrator_result.get("nextReviewDate", ""),
        "recommendedActions": orchestrator_result.get("recommendedActions", []),
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "generatedBy": user_id,
    }

    await _log_decision(decision)
    return decision


async def generate_batch_decisions(employees: List[Dict[str, Any]], user_id: str = "system") -> List[Dict[str, Any]]:
    """
    Generates decisions for a batch with bounded concurrency, isolating
    per-employee failures.

    Each employee entry may carry its own `userId` (the authenticated HR/Admin
    user who triggered the batch — Node forwards it per-employee, mirroring
    the single-generate request shape). That per-employee value is always
    preferred; the `user_id` parameter is only a fallback for entries that
    omit it, so a real batch request never gets silently stamped "system".

    Root cause this replaces: this ran one employee at a time — reproduced
    directly against this endpoint, the "Generate Recommendations" button on
    the Dashboard stayed on "Generating…" for 4+ minutes and still didn't
    finish for the full ~1250-employee active workforce, because each
    employee runs the full prediction+SHAP+sentiment+RAG+LLM pipeline
    sequentially. Mirrors employee_intelligence_routes.py's bounded-semaphore
    concurrency pattern. The bound (20, lower than explain_batch's/employee-
    intelligence's 50) is deliberately conservative: unlike those two, each
    unit of work here makes an LLM API call, and providers commonly enforce
    their own per-key concurrent-request ceiling independent of the token
    quota — too high a fan-out risks tripping that as well as the token
    limit. Measured directly against this endpoint: concurrency=10 processed
    ~10 employees every ~2s (clustered request timestamps in the Groq call
    log confirm real parallelism, not just syntactic concurrency) — for the
    full ~1250-employee workforce that projects to ~250s, just over Express's
    240s batch timeout. 20 keeps the same safety margin below common
    per-key concurrency ceilings while comfortably clearing that budget.
    """
    semaphore = asyncio.Semaphore(20)
    # Hard per-employee ceiling. Root cause this closes: the per-employee
    # try/except below only isolates EXCEPTIONS — it does nothing if a single
    # employee's call (a DB query, the LLM call, SHAP) simply never returns.
    # Reproduced directly: a full ~1250-employee run that used to complete in
    # ~4.5 minutes took over 14 minutes and still hadn't responded after
    # adding the two extra performance/survey DB lookups per employee (see
    # _fetch_performance_and_engagement above) — with 20 concurrent slots,
    # even a handful of employees whose calls stall (instead of cleanly
    # failing) can occupy every slot indefinitely and stop the whole batch
    # from ever finishing. Wrapping each unit of work in asyncio.wait_for
    # guarantees the batch's total wall time is bounded by
    # ceil(len(employees) / 20) * PER_EMPLOYEE_TIMEOUT_SECONDS no matter what
    # stalls, converting a stall into the same handled "isolated failure"
    # path immediately below instead of an unbounded hang.
    PER_EMPLOYEE_TIMEOUT_SECONDS = 45

    async def _generate_one(emp: Dict[str, Any]) -> Dict[str, Any]:
        emp_user_id = emp.get("userId") or user_id
        async with semaphore:
            try:
                return await asyncio.wait_for(
                    generate_decision(emp["employeeId"], emp["employeeData"], emp_user_id),
                    timeout=PER_EMPLOYEE_TIMEOUT_SECONDS,
                )
            except Exception as e:
                return {
                    "employeeId": emp.get("employeeId"),
                    "error": str(e),
                    "recommendationType": "NO_ACTION_REQUIRED",
                    "priority": "LOW",
                    "confidence": 0.0,
                    "reasoning": f"Decision generation failed: {e}",
                    "evidence": {},
                    "affectedFactors": [],
                    "relatedPolicies": [],
                    "expectedOutcome": "",
                    "reviewDate": "",
                    "recommendedActions": [],
                    "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    "generatedBy": emp_user_id,
                }

    return await asyncio.gather(*(_generate_one(emp) for emp in employees))


# ---------------------------------------------------------------------------
# Persistence — append-only generation log (audit trail). This is separate
# from Express's mutable `Decision` collection (which owns HR status/
# accept-dismiss workflow) — this collection is never updated, only
# appended to, satisfying "log every recommendation generation".
# ---------------------------------------------------------------------------

async def _log_decision(decision: Dict[str, Any]):
    try:
        db = get_db()
        await db["decisions"].insert_one({**decision, "loggedAt": datetime.datetime.now(datetime.timezone.utc)})
    except Exception as e:
        print(f"Failed to log decision to MongoDB: {e}")


async def get_decision_history(limit: int = 50) -> List[Dict[str, Any]]:
    try:
        db = get_db()
        cursor = db["decisions"].find({}, {"_id": 0}).sort("generatedAt", -1).limit(limit)
        return await cursor.to_list(length=limit)
    except Exception:
        return []


async def get_employee_decisions(employee_id: str) -> List[Dict[str, Any]]:
    try:
        db = get_db()
        cursor = db["decisions"].find({"employeeId": employee_id}, {"_id": 0}).sort("generatedAt", -1)
        return await cursor.to_list(length=100)
    except Exception:
        return []


async def get_decision_dashboard_stats() -> Dict[str, Any]:
    try:
        db = get_db()
        col = db["decisions"]

        total = await col.count_documents({})

        type_pipeline = [
            {"$group": {"_id": "$recommendationType", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]
        type_agg = await col.aggregate(type_pipeline).to_list(20)
        distribution = {t["_id"]: t["count"] for t in type_agg if t["_id"]}

        priority_pipeline = [
            {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
        ]
        priority_agg = await col.aggregate(priority_pipeline).to_list(10)
        priority_counts = {p["_id"]: p["count"] for p in priority_agg if p["_id"]}

        return {
            "totalDecisions": total,
            "recommendationDistribution": distribution,
            "priorityDistribution": priority_counts,
        }
    except Exception:
        return {
            "totalDecisions": 0,
            "recommendationDistribution": {},
            "priorityDistribution": {},
        }
