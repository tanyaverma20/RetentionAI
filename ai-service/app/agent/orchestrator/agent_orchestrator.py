"""
app/agent/orchestrator/agent_orchestrator.py
=============================================
Central orchestration engine for the Agentic AI.

Workflow per employee:
  1. Run ML prediction (async)
  2. Run SHAP explanation (sync, CPU-bound)
  3. Fetch NLP insights from MongoDB (async)
  4. Build RAG query from risk signals and retrieve policies (sync)
  5. Assemble full evidence bundle
  6. Run LangChain LLM reasoning chain → structured JSON recommendations
  7. Compute confidence scores
  8. Return structured AgentRecommendationResponse
"""

import asyncio
import datetime
from typing import Dict, Any, List

import pandas as pd

from app.agent.tools.ml_tool import run_ml_prediction
from app.agent.tools.shap_tool import run_shap_explanation
from app.agent.tools.nlp_tool import run_nlp_insights
from app.agent.tools.rag_tool import run_rag_retrieval
from app.preprocessing.enrichment import enrich_employee_doc
from app.utils.database import get_db
from app.agent.chains.reasoning_chain import run_reasoning_chain


# ── Helpers ────────────────────────────────────────────────────────────────────

def _build_rag_query(ml_result: Dict, nlp_result: Dict) -> str:
    """Constructs a targeted RAG query from signals to find relevant HR policies."""
    parts = []
    risk = ml_result.get("riskLevel", "MEDIUM")
    
    if risk == "HIGH":
        parts.append("employee retention high attrition risk")
    if nlp_result.get("burnoutRisk", 0) > 0.5:
        parts.append("burnout mental wellness workload policy")
    if nlp_result.get("resignationIntent", 0) > 0.5:
        parts.append("resignation career growth promotion policy")
    if nlp_result.get("promotionFrustration", 0) > 0.4:
        parts.append("promotion compensation salary review policy")
    if nlp_result.get("managerConflict", 0) > 0.4:
        parts.append("manager conflict leadership coaching policy")
    if "Work-Life Balance" in nlp_result.get("detectedTopics", []):
        parts.append("flexible work arrangement remote work policy")
    if "Learning" in nlp_result.get("detectedTopics", []) or "Training" in nlp_result.get("detectedTopics", []):
        parts.append("training development learning policy")

    return " ".join(parts) if parts else "employee retention best practices"


def _calculate_confidence(
    ml_success: bool, shap_success: bool, nlp_success: bool, rag_success: bool,
    ml_confidence: float, risk_score: float
) -> Dict[str, float]:
    """Calculates recommendation confidence, evidence strength, and data completeness."""
    sources_available = sum([ml_success, shap_success, nlp_success, rag_success])
    data_completeness = round(sources_available / 4.0, 2)
    
    # Evidence strength: how confident and extreme the signals are
    evidence_strength = round(
        (ml_confidence * 0.4) + 
        (abs(risk_score - 0.5) * 2 * 0.3) +  # Distance from neutral
        (0.15 if nlp_success else 0.0) +
        (0.15 if rag_success else 0.0),
        2
    )
    
    # Overall confidence is a weighted blend
    recommendation_confidence = round(
        (evidence_strength * 0.6) + (data_completeness * 0.4), 2
    )
    
    return {
        "recommendationConfidence": min(recommendation_confidence, 1.0),
        "evidenceStrength": min(evidence_strength, 1.0),
        "dataCompleteness": data_completeness,
    }


def _compute_next_review_date(risk_level: str) -> str:
    """Returns a suggested next review date based on risk level."""
    today = datetime.date.today()
    days = 30 if risk_level == "HIGH" else (60 if risk_level == "MEDIUM" else 90)
    return (today + datetime.timedelta(days=days)).isoformat()


def _get_tenure_string(employee_doc: Dict) -> str:
    try:
        joining = pd.to_datetime(employee_doc.get("joiningDate", "2020-01-01"))
        months = (pd.Timestamp.now() - joining).days / 30.43
        return f"{months:.0f} months"
    except Exception:
        return "Unknown"


# ── Main Orchestrator ──────────────────────────────────────────────────────────

async def orchestrate_recommendation(
    employee_id: str,
    employee_doc: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Full agentic pipeline for a single employee.
    Runs tools in parallel where possible, then reasons over the evidence.
    """
    # ── Step 0: Enrich once with real Attendance/Performance/PromotionHistory/
    # TrainingHistory/Survey/NLP signals, so the ML prediction and the SHAP
    # explanation below both reason over the exact same feature values (data
    # completeness, not decision logic — required so SHAP stays accurate
    # after the Sprint 8 ML feature-set change; ml_tool's predict_single()
    # would otherwise silently re-enrich on its own, but shap_tool calls the
    # explainer directly and would otherwise see only neutral defaults).
    db = get_db()
    if db is not None:
        try:
            employee_doc = await enrich_employee_doc(employee_doc, db)
        except Exception as e:
            print(f"Employee feature enrichment failed in orchestrator, using raw employee_doc: {e}")

    # ── Step 1 & 3: Run ML and fetch NLP insights in parallel ──────────────
    ml_task = run_ml_prediction(employee_doc)
    nlp_task = run_nlp_insights(employee_id)

    ml_result, nlp_result = await asyncio.gather(ml_task, nlp_task)

    # ── Step 2: SHAP explanation (sync, run in thread executor) ────────────
    loop = asyncio.get_event_loop()
    shap_result = await loop.run_in_executor(
        None, run_shap_explanation, employee_doc
    )

    # ── Step 4: RAG policy retrieval ───────────────────────────────────────
    rag_query = _build_rag_query(ml_result, nlp_result)
    rag_result = await loop.run_in_executor(None, run_rag_retrieval, rag_query, 4)

    # ── Step 5: Assemble evidence bundle ───────────────────────────────────
    evidence = {
        # ML signals
        "mlRiskScore": ml_result.get("riskScore", 0.5),
        "mlRiskLevel": ml_result.get("riskLevel", "MEDIUM"),
        "mlConfidence": ml_result.get("confidence", 0.5),
        # SHAP signals
        "topRiskFeatures": shap_result.get("topRiskFeatures", []),
        "topProtectiveFeatures": shap_result.get("topProtectiveFeatures", []),
        "shapNarrative": shap_result.get("narrative", ""),
        # NLP signals
        "sentiment": nlp_result.get("sentiment", "Neutral"),
        "burnoutRisk": nlp_result.get("burnoutRisk", 0.0),
        "resignationIntent": nlp_result.get("resignationIntent", 0.0),
        "engagementRisk": nlp_result.get("engagementRisk", 0.0),
        "promotionFrustration": nlp_result.get("promotionFrustration", 0.0),
        "managerConflict": nlp_result.get("managerConflict", 0.0),
        "detectedTopics": nlp_result.get("detectedTopics", []),
        "extractedKeywords": nlp_result.get("extractedKeywords", []),
        # RAG signals
        "policies": rag_result.get("policies", []),
        "policyReferences": rag_result.get("policyReferences", []),
        # Employee context
        "department": str(employee_doc.get("departmentId", "Unknown")),
        "designation": employee_doc.get("designation", "Unknown"),
        "tenure": _get_tenure_string(employee_doc),
    }

    # ── Step 6: LLM reasoning chain ────────────────────────────────────────
    try:
        llm_output = await loop.run_in_executor(None, run_reasoning_chain, evidence)
    except ValueError as e:
        # GROQ key missing: return structured fallback
        llm_output = {
            "priority": ml_result.get("riskLevel", "MEDIUM"),
            "recommendedActions": [{
                "category": "Manual Review",
                "description": "LLM reasoning unavailable (GROQ_API_KEY missing). Please review evidence manually.",
                "priority": "HIGH",
                "policyReference": None,
                "expectedImpact": "Ensures employee receives timely intervention."
            }],
            "expectedBusinessImpact": "Manual review required.",
            "reasoningSummary": f"LLM unavailable: {str(e)}. "
                                f"ML Risk: {ml_result.get('riskLevel')} ({ml_result.get('riskScore',0):.1%}). "
                                f"Burnout: {nlp_result.get('burnoutRisk', 0):.2f}. "
                                f"Top Risk Features: {', '.join(shap_result.get('topRiskFeatures', []))}"
        }

    # ── Step 7: Confidence scoring ─────────────────────────────────────────
    confidence_scores = _calculate_confidence(
        ml_success=ml_result.get("success", False),
        shap_success=shap_result.get("success", False),
        nlp_success=nlp_result.get("success", False),
        rag_success=rag_result.get("success", False),
        ml_confidence=evidence["mlConfidence"],
        risk_score=evidence["mlRiskScore"]
    )

    # ── Step 8: Build final output ─────────────────────────────────────────
    return {
        "employeeId": employee_id,
        "riskLevel": evidence["mlRiskLevel"],
        "attritionProbability": evidence["mlRiskScore"],
        "priority": llm_output.get("priority", evidence["mlRiskLevel"]),
        "topRiskFactors": evidence["topRiskFeatures"],
        "positiveFactors": evidence["topProtectiveFeatures"],
        "recommendedActions": llm_output.get("recommendedActions", []),
        "expectedBusinessImpact": llm_output.get("expectedBusinessImpact", ""),
        "policyReferences": evidence["policyReferences"],
        "reasoningSummary": llm_output.get("reasoningSummary", ""),
        "evidenceBundle": {
            "mlRiskScore": evidence["mlRiskScore"],
            "mlRiskLevel": evidence["mlRiskLevel"],
            "mlConfidence": evidence["mlConfidence"],
            "topRiskFeatures": evidence["topRiskFeatures"],
            "topProtectiveFeatures": evidence["topProtectiveFeatures"],
            "sentiment": evidence["sentiment"],
            "burnoutRisk": evidence["burnoutRisk"],
            "resignationIntent": evidence["resignationIntent"],
            "detectedTopics": evidence["detectedTopics"],
            "extractedKeywords": evidence["extractedKeywords"],
            "ragPoliciesFound": evidence["policyReferences"],
        },
        "confidence": confidence_scores,
        "nextReviewDate": _compute_next_review_date(evidence["mlRiskLevel"]),
        "generatedAt": datetime.datetime.utcnow().isoformat(),
    }
