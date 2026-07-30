"""
app/agent/services/agent_service.py
=====================================
Business logic layer for the Agentic AI module.
- Handles single and batch recommendations.
- Persists recommendation history to MongoDB.
- Provides statistics aggregations for the dashboard.
"""

import datetime
from typing import Dict, Any, List

from app.agent.orchestrator.agent_orchestrator import orchestrate_recommendation
from app.utils.database import get_db


async def save_recommendation_to_db(recommendation: Dict[str, Any]):
    """Persists a recommendation to the agent_recommendations MongoDB collection."""
    try:
        db = get_db()
        await db["agent_recommendations"].insert_one({
            "employeeId": recommendation["employeeId"],
            "timestamp": datetime.datetime.utcnow(),
            "riskLevel": recommendation["riskLevel"],
            "attritionProbability": recommendation["attritionProbability"],
            "priority": recommendation["priority"],
            "recommendations": recommendation["recommendedActions"],
            "reasoning": recommendation["reasoningSummary"],
            "policyReferences": recommendation["policyReferences"],
            "evidenceBundle": recommendation["evidenceBundle"],
            "confidence": recommendation["confidence"],
            "reviewStatus": "PENDING",
            "nextReviewDate": recommendation["nextReviewDate"],
        })
    except Exception as e:
        print(f"Failed to save agent recommendation to MongoDB: {e}")


async def generate_recommendation(
    employee_id: str, employee_doc: Dict[str, Any], user_id: str = "system"
) -> Dict[str, Any]:
    """
    Runs the full orchestrator pipeline for one employee and persists the result.
    """
    result = await orchestrate_recommendation(employee_id, employee_doc)
    # Persist to MongoDB asynchronously (non-blocking for caller)
    await save_recommendation_to_db(result)
    return result


async def generate_batch_recommendations(
    employees: List[Dict[str, Any]], user_id: str = "system"
) -> List[Dict[str, Any]]:
    """
    Runs the recommendation pipeline for a batch of employees sequentially.
    (Could be parallelized with asyncio.gather for large batches in production.)
    """
    results = []
    for emp in employees:
        try:
            result = await generate_recommendation(
                employee_id=emp["employeeId"],
                employee_doc=emp["employeeData"],
                user_id=user_id
            )
            results.append(result)
        except Exception as e:
            # Don't fail entire batch for one employee
            results.append({
                "employeeId": emp["employeeId"],
                "error": str(e),
                "riskLevel": "UNKNOWN",
                "attritionProbability": 0.0,
                "priority": "LOW",
                "topRiskFactors": [],
                "positiveFactors": [],
                "recommendedActions": [],
                "expectedBusinessImpact": "",
                "policyReferences": [],
                "reasoningSummary": f"Error during orchestration: {str(e)}",
                "evidenceBundle": {},
                "confidence": {"recommendationConfidence": 0.0, "evidenceStrength": 0.0, "dataCompleteness": 0.0},
                "nextReviewDate": "",
                "generatedAt": datetime.datetime.utcnow().isoformat()
            })
    return results


async def get_recommendation_history(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves recent recommendation history from MongoDB."""
    try:
        db = get_db()
        cursor = db["agent_recommendations"].find(
            {}, {"_id": 0}
        ).sort("timestamp", -1).limit(limit)
        return await cursor.to_list(length=limit)
    except Exception as e:
        return []


async def get_employee_recommendations(employee_id: str) -> List[Dict[str, Any]]:
    """Retrieves all recommendation history for a specific employee."""
    try:
        db = get_db()
        cursor = db["agent_recommendations"].find(
            {"employeeId": employee_id}, {"_id": 0}
        ).sort("timestamp", -1)
        return await cursor.to_list(length=100)
    except Exception as e:
        return []


async def get_agent_statistics() -> Dict[str, Any]:
    """Aggregates agent statistics for the dashboard."""
    try:
        db = get_db()
        col = db["agent_recommendations"]

        total = await col.count_documents({})
        high = await col.count_documents({"riskLevel": "HIGH"})
        medium = await col.count_documents({"riskLevel": "MEDIUM"})
        low = await col.count_documents({"riskLevel": "LOW"})

        # Most common risk factors
        risk_pipeline = [
            {"$unwind": "$evidenceBundle.topRiskFeatures"},
            {"$group": {"_id": "$evidenceBundle.topRiskFeatures", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        risk_agg = await col.aggregate(risk_pipeline).to_list(5)
        common_risks = [r["_id"] for r in risk_agg if r["_id"]]

        # Most common recommended action categories
        action_pipeline = [
            {"$unwind": "$recommendations"},
            {"$group": {"_id": "$recommendations.category", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        action_agg = await col.aggregate(action_pipeline).to_list(5)
        common_actions = [a["_id"] for a in action_agg if a["_id"]]

        # Department risk overview
        dept_pipeline = [
            {"$group": {"_id": "$evidenceBundle.department", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        dept_agg = await col.aggregate(dept_pipeline).to_list(10)
        dept_overview = {d["_id"]: d["count"] for d in dept_agg if d["_id"]}

        return {
            "totalRecommendations": total,
            "highRiskCount": high,
            "mediumRiskCount": medium,
            "lowRiskCount": low,
            "mostCommonRiskFactors": common_risks,
            "mostCommonActions": common_actions,
            "departmentRiskOverview": dept_overview,
        }
    except Exception as e:
        return {
            "totalRecommendations": 0,
            "highRiskCount": 0,
            "mediumRiskCount": 0,
            "lowRiskCount": 0,
            "mostCommonRiskFactors": [],
            "mostCommonActions": [],
            "departmentRiskOverview": {},
        }
