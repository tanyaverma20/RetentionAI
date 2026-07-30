from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DecisionGenerateRequest(BaseModel):
    employeeId: str
    employeeData: Dict[str, Any] = Field(description="Full employee document (profile + feature fields).")
    userId: Optional[str] = "system"


class DecisionBatchRequest(BaseModel):
    employees: List[DecisionGenerateRequest]


class RecommendedAction(BaseModel):
    category: str
    description: str
    priority: str
    policyReference: Optional[str] = None
    expectedImpact: str


class DecisionResponse(BaseModel):
    employeeId: str
    recommendationType: str
    priority: str
    confidence: float
    reasoning: str
    evidence: Dict[str, Any]
    affectedFactors: List[str]
    relatedPolicies: List[str]
    expectedOutcome: str
    reviewDate: str
    recommendedActions: List[RecommendedAction] = []
    generatedAt: str
    generatedBy: str = "system"
    error: Optional[str] = None


class DecisionBatchResponse(BaseModel):
    success: bool = True
    processedCount: int
    decisions: List[DecisionResponse]


class DecisionDashboardResponse(BaseModel):
    totalDecisions: int
    recommendationDistribution: Dict[str, int]
    priorityDistribution: Dict[str, int]
