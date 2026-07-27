"""
app/api/agent_routes.py
========================
FastAPI router for the Agentic AI recommendation endpoints.

Endpoints:
  POST /agent/recommend          - Single employee recommendation
  POST /agent/recommend/batch    - Batch recommendations
  GET  /agent/history            - Recent recommendation history
  GET  /agent/employee/{id}      - History for specific employee
  GET  /agent/statistics         - Dashboard statistics
"""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any

from app.agent.schemas import (
    AgentRecommendRequest,
    AgentBatchRecommendRequest,
    AgentRecommendationResponse,
    AgentBatchResponse,
    AgentStatisticsResponse,
    RecommendedAction,
    EvidenceBundle,
    ConfidenceScores,
)
from app.agent.services.agent_service import (
    generate_recommendation,
    generate_batch_recommendations,
    get_recommendation_history,
    get_employee_recommendations,
    get_agent_statistics,
)

router = APIRouter(prefix="/agent", tags=["Agentic AI"])


def _map_to_response(result: Dict[str, Any]) -> AgentRecommendationResponse:
    """Maps raw orchestrator output to the Pydantic response model."""
    actions = [RecommendedAction(**a) for a in result.get("recommendedActions", [])]
    
    eb = result.get("evidenceBundle", {})
    evidence = EvidenceBundle(
        mlRiskScore=eb.get("mlRiskScore", 0.0),
        mlRiskLevel=eb.get("mlRiskLevel", "UNKNOWN"),
        mlConfidence=eb.get("mlConfidence", 0.0),
        topRiskFeatures=eb.get("topRiskFeatures", []),
        topProtectiveFeatures=eb.get("topProtectiveFeatures", []),
        sentiment=eb.get("sentiment"),
        burnoutRisk=eb.get("burnoutRisk"),
        resignationIntent=eb.get("resignationIntent"),
        detectedTopics=eb.get("detectedTopics", []),
        extractedKeywords=eb.get("extractedKeywords", []),
        ragPoliciesFound=eb.get("ragPoliciesFound", []),
    )

    conf = result.get("confidence", {})
    confidence = ConfidenceScores(
        recommendationConfidence=conf.get("recommendationConfidence", 0.0),
        evidenceStrength=conf.get("evidenceStrength", 0.0),
        dataCompleteness=conf.get("dataCompleteness", 0.0),
    )

    return AgentRecommendationResponse(
        employeeId=result["employeeId"],
        riskLevel=result.get("riskLevel", "UNKNOWN"),
        attritionProbability=result.get("attritionProbability", 0.0),
        priority=result.get("priority", "MEDIUM"),
        topRiskFactors=result.get("topRiskFactors", []),
        positiveFactors=result.get("positiveFactors", []),
        recommendedActions=actions,
        expectedBusinessImpact=result.get("expectedBusinessImpact", ""),
        policyReferences=result.get("policyReferences", []),
        reasoningSummary=result.get("reasoningSummary", ""),
        evidenceBundle=evidence,
        confidence=confidence,
        nextReviewDate=result.get("nextReviewDate", ""),
        generatedAt=result.get("generatedAt", ""),
    )


@router.post("/recommend", response_model=AgentRecommendationResponse)
async def recommend_single(request: AgentRecommendRequest):
    """
    Generates an evidence-based, policy-grounded retention recommendation
    for a single employee by orchestrating ML, SHAP, NLP, and RAG.
    """
    if not request.employeeId:
        raise HTTPException(status_code=422, detail="employeeId is required.")
    if not request.employeeData:
        raise HTTPException(status_code=422, detail="employeeData is required.")

    try:
        result = await generate_recommendation(
            employee_id=request.employeeId,
            employee_doc=request.employeeData,
            user_id=request.userId or "system"
        )
        return _map_to_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent orchestration failed: {str(e)}")


@router.post("/recommend/batch", response_model=AgentBatchResponse)
async def recommend_batch(request: AgentBatchRecommendRequest):
    """
    Generates retention recommendations for a batch of employees.
    Processes each employee sequentially with graceful error handling.
    """
    if not request.employees:
        raise HTTPException(status_code=422, detail="No employees provided.")

    try:
        raw_results = await generate_batch_recommendations(
            employees=[e.model_dump() for e in request.employees]
        )
        recommendations = []
        for r in raw_results:
            if "error" in r and r["error"]:
                # Include error entries with partial data
                recommendations.append(_map_to_response(r))
            else:
                recommendations.append(_map_to_response(r))

        return AgentBatchResponse(
            success=True,
            processedCount=len(recommendations),
            recommendations=recommendations
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch orchestration failed: {str(e)}")


@router.get("/history", response_model=List[Dict[str, Any]])
async def get_history():
    """
    Returns the 50 most recent agent recommendations from MongoDB.
    """
    try:
        return await get_recommendation_history(limit=50)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/employee/{employeeId}", response_model=List[Dict[str, Any]])
async def get_employee_history(employeeId: str):
    """
    Returns all recommendation history for a specific employee.
    """
    try:
        return await get_employee_recommendations(employeeId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch employee history: {str(e)}")


@router.get("/statistics", response_model=AgentStatisticsResponse)
async def get_statistics():
    """
    Returns aggregated statistics for the HR dashboard:
    risk distribution, common risk factors, common actions, and dept overview.
    """
    try:
        return await get_agent_statistics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")
