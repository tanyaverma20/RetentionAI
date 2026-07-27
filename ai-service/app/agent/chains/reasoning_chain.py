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
            temperature=0.1  # Low temperature for consistent, factual output
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

    return parsed
