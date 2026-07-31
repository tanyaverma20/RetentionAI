"""
app/agent/chains/reasoning_chain.py
=====================================
LangChain chain that feeds the assembled evidence bundle into the Groq LLM
and parses the structured JSON recommendation output.
"""

import os
import json
from langchain_groq import ChatGroq
from app.agent.prompts.recommendation_prompt import recommendation_prompt
from typing import Dict, Any, List

_llm = None

def get_agent_llm():
    global _llm
    if _llm is None:
        groq_api_key = os.getenv("GROQ_API_KEY", "")
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY environment variable is missing.")
        _llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            api_key=groq_api_key,
            temperature=0.1,  # Low temperature for consistent, factual output
            # ChatGroq defaults to max_retries=2, and the underlying client
            # honors the Retry-After hint Groq sends on 429s. That's fine for
            # a short per-minute rate limit, but this account's limit is a
            # DAILY token quota (TPD) — Groq's own error message reports
            # waits of 9-12+ minutes. With the default retries, a single
            # rate-limited employee could block for 20-30+ minutes (2 retries
            # x that wait) before the existing per-employee try/except in
            # generate_batch_decisions ever got a chance to catch it and move
            # on — which is what made "Generate Recommendations" appear to
            # hang forever across a ~1250-employee batch instead of finishing
            # in seconds with per-employee NO_ACTION_REQUIRED fallbacks.
            # Failing fast here preserves that existing isolation; it does
            # not change what happens on failure, only how long one call is
            # allowed to block before it's reported.
            max_retries=0,
            request_timeout=30,
        )
    return _llm


def _format_policy_context(policies: List[Dict]) -> str:
    """Formats retrieved policy chunks into a readable string for the prompt."""
    if not policies:
        return "No relevant HR policies found in knowledge base."
    lines = []
    for p in policies:
        doc = p.get("documentName", "Unknown")
        page = p.get("pageNumber", "N/A")
        content = p.get("content", "")[:300]
        lines.append(f"[{doc}, p.{page}]: {content}")
    return "\n".join(lines)


def run_reasoning_chain(evidence: Dict[str, Any]) -> Dict[str, Any]:
    """
    Assembles the evidence bundle into a prompt and calls the Groq LLM.
    Parses the structured JSON output.
    Returns a dict with recommendedActions, reasoningSummary, and priority.
    """
    llm = get_agent_llm()
    chain = recommendation_prompt | llm

    # Format inputs for the prompt
    prompt_inputs = {
        "ml_risk_score": evidence.get("mlRiskScore", 0.5),
        "ml_risk_level": evidence.get("mlRiskLevel", "MEDIUM"),
        "ml_confidence": evidence.get("mlConfidence", 0.5),
        "top_risk_features": ", ".join(evidence.get("topRiskFeatures", [])) or "None identified",
        "top_protective_features": ", ".join(evidence.get("topProtectiveFeatures", [])) or "None identified",
        "shap_narrative": evidence.get("shapNarrative", "SHAP explanation not available."),
        "sentiment": evidence.get("sentiment", "Neutral"),
        "burnout_risk": evidence.get("burnoutRisk", 0.0),
        "resignation_intent": evidence.get("resignationIntent", 0.0),
        "engagement_risk": evidence.get("engagementRisk", 0.0),
        "promotion_frustration": evidence.get("promotionFrustration", 0.0),
        "manager_conflict": evidence.get("managerConflict", 0.0),
        "detected_topics": ", ".join(evidence.get("detectedTopics", [])) or "None",
        "keywords": ", ".join(evidence.get("extractedKeywords", [])) or "None",
        "policy_context": _format_policy_context(evidence.get("policies", [])),
        "department": evidence.get("department", "Unknown"),
        "designation": evidence.get("designation", "Unknown"),
        "tenure": evidence.get("tenure", "Unknown"),
    }

    response = chain.invoke(prompt_inputs)
    raw_text = response.content.strip()

    # Parse JSON from LLM response
    try:
        # Strip markdown code fences if present
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
        parsed = json.loads(raw_text)
    except (json.JSONDecodeError, IndexError):
        # Graceful fallback if LLM doesn't return pure JSON
        parsed = {
            "priority": evidence.get("mlRiskLevel", "MEDIUM"),
            "recommendedActions": [{
                "category": "Data Collection",
                "description": "Could not parse structured recommendation. Please review employee data manually.",
                "priority": "MEDIUM",
                "policyReference": None,
                "expectedImpact": "Ensures accurate recommendations in the next review cycle."
            }],
            "expectedBusinessImpact": "Manual review required.",
            "reasoningSummary": raw_text[:500]  # Store partial LLM output for review
        }

    # The prompt tells the LLM to write `else null` for an absent policy
    # reference, but that lands inside a JSON string, so the model sometimes
    # emits the literal string "null" instead of the JSON literal null.
    for action in parsed.get("recommendedActions", []) or []:
        if isinstance(action, dict) and str(action.get("policyReference")).strip().lower() in ("null", "none", ""):
            action["policyReference"] = None

    return parsed
