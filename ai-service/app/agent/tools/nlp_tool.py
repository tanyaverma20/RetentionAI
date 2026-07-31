"""
app/agent/tools/nlp_tool.py
============================
Tool wrapper: retrieves the latest Employee Intelligence profile from MongoDB
for an employee. Calls the existing nlp repository — does NOT rebuild the
NLP pipeline.

Reads from the `employeeintelligences` collection (populated by
server/src/services/employeeIntelligenceService.js via the "Generate Employee
Intelligence" flow) rather than this service's own `nlp_insights` collection,
which nothing in that flow ever writes to and which is therefore always
empty. See repository.get_latest_employee_intelligence() for the full
explanation.

Note: resignationIntent, engagementRisk, promotionFrustration, and
managerConflict are computed per-text by analyze_hr_text() but are NOT
currently aggregated to the employee level anywhere (see
_aggregate_employee_intelligence in employee_intelligence_routes.py) — they
are genuinely unavailable at this level today, so they default to 0.0 rather
than being fabricated.
"""

from app.nlp.repository import get_latest_employee_intelligence
from typing import Dict, Any


async def run_nlp_insights(employee_id: str) -> Dict[str, Any]:
    """
    Fetches the latest Employee Intelligence profile for a given employee.
    """
    try:
        profile = await get_latest_employee_intelligence(employee_id)

        if not profile:
            return {
                "success": False,
                "sentiment": "Neutral",
                "burnoutRisk": 0.0,
                "resignationIntent": 0.0,
                "engagementRisk": 0.0,
                "promotionFrustration": 0.0,
                "managerConflict": 0.0,
                "detectedTopics": [],
                "extractedKeywords": [],
                "error": "No Employee Intelligence profile found for this employee.",
            }

        return {
            "success": True,
            "sentiment": profile.get("sentiment", "Neutral"),
            "sentimentScore": profile.get("sentimentScore", 0.5),
            # burnoutScore is the 0-1 numeric field; burnoutRisk on this
            # collection is a Low/Medium/High string (a different field with
            # the same name the rule engine expects numerically) — using it
            # directly here would silently break every burnout-based rule.
            "burnoutRisk": profile.get("burnoutScore", 0.0),
            "resignationIntent": 0.0,
            "engagementRisk": 0.0,
            "promotionFrustration": 0.0,
            "managerConflict": 0.0,
            "detectedTopics": profile.get("topics", []),
            "extractedKeywords": profile.get("keywords", []),
        }
    except Exception as e:
        return {
            "success": False,
            "sentiment": "Neutral",
            "burnoutRisk": 0.0,
            "resignationIntent": 0.0,
            "engagementRisk": 0.0,
            "promotionFrustration": 0.0,
            "managerConflict": 0.0,
            "detectedTopics": [],
            "extractedKeywords": [],
            "error": str(e),
        }
