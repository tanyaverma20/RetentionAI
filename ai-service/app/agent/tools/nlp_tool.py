"""
app/agent/tools/nlp_tool.py
============================
Tool wrapper: retrieves the latest NLP insights from MongoDB for an employee.
Calls the existing nlp repository — does NOT rebuild the NLP pipeline.
"""

from app.nlp.repository import get_employee_insights
from typing import Dict, Any, List


async def run_nlp_insights(employee_id: str) -> Dict[str, Any]:
    """
    Fetches the latest NLP insight for a given employee from MongoDB.
    """
    try:
        insights = await get_employee_insights(employee_id)
        
        if not insights:
            return {
                "success": False,
                "sentiment": "Neutral",
                "burnoutRisk": 0.0,
                "resignationIntent": 0.0,
                "engagementRisk": 0.0,
                "detectedTopics": [],
                "extractedKeywords": [],
                "error": "No NLP insights found for this employee."
            }
            
        # Use the most recent insight
        latest = insights[0]
        return {
            "success": True,
            "sentiment": latest.get("sentiment", "Neutral"),
            "sentimentScore": latest.get("sentimentScore", 0.5),
            "burnoutRisk": latest.get("burnoutRisk", 0.0),
            "resignationIntent": latest.get("resignationIntent", 0.0),
            "engagementRisk": latest.get("engagementRisk", 0.0),
            "promotionFrustration": latest.get("promotionFrustration", 0.0),
            "managerConflict": latest.get("managerConflict", 0.0),
            "detectedTopics": latest.get("detectedTopics", []),
            "extractedKeywords": latest.get("extractedKeywords", [])
        }
    except Exception as e:
        return {
            "success": False,
            "sentiment": "Neutral",
            "burnoutRisk": 0.0,
            "resignationIntent": 0.0,
            "engagementRisk": 0.0,
            "detectedTopics": [],
            "extractedKeywords": [],
            "error": str(e)
        }
