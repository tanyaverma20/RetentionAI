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
from typing import Any, Dict, List

import pandas as pd

from app.agent.orchestrator.agent_orchestrator import orchestrate_recommendation
from app.decision.rules.rule_engine import evaluate as evaluate_rules, highest_priority
from app.utils.database import get_db


def _compute_tenure_months(employee_doc: Dict[str, Any]) -> float:
    # Mirrors agent_orchestrator.py's own _get_tenure_string() calculation.
    try:
        joining = pd.to_datetime(employee_doc.get("joiningDate", "2020-01-01"))
        return round((pd.Timestamp.now() - joining).days / 30.43, 1)
    except Exception:
        return 0.0


def _build_rule_evidence(orchestrator_result: Dict[str, Any], employee_doc: Dict[str, Any]) -> Dict[str, Any]:
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

    return {
        **eb,
        "mlRiskLevel": orchestrator_result.get("riskLevel", eb.get("mlRiskLevel", "MEDIUM")),
        "tenureMonths": tenure_months,
        "promotionOverdue": promotion_overdue,
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

    rule_evidence = _build_rule_evidence(orchestrator_result, employee_doc)
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

    async def _generate_one(emp: Dict[str, Any]) -> Dict[str, Any]:
        emp_user_id = emp.get("userId") or user_id
        async with semaphore:
            try:
                return await generate_decision(emp["employeeId"], emp["employeeData"], emp_user_id)
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
