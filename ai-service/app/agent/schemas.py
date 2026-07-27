"""
app/agent/schemas.py
====================
Pydantic models for the Agentic AI orchestration layer.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# ── Request Models ─────────────────────────────────────────────────────────────

class AgentRecommendRequest(BaseModel):
    employeeId: str
    employeeData: Dict[str, Any] = Field(
        description="Full employee document including profile and feature fields."
    )
    userId: Optional[str] = "system"

class AgentBatchRecommendRequest(BaseModel):
    employees: List[AgentRecommendRequest]


# ── Sub-models ─────────────────────────────────────────────────────────────────

class RecommendedAction(BaseModel):
    category: str              # e.g. "Salary Review", "Training", "Promotion"
    description: str
    priority: str              # HIGH | MEDIUM | LOW
    policyReference: Optional[str] = None   # e.g. "Leave Policy.pdf, p.4"
    expectedImpact: str

class EvidenceBundle(BaseModel):
    mlRiskScore: float
    mlRiskLevel: str
    mlConfidence: float
    topRiskFeatures: List[str]
    topProtectiveFeatures: List[str]
    sentiment: Optional[str] = None
    burnoutRisk: Optional[float] = None
    resignationIntent: Optional[float] = None
    detectedTopics: Optional[List[str]] = []
    extractedKeywords: Optional[List[str]] = []
    ragPoliciesFound: Optional[List[str]] = []

class ConfidenceScores(BaseModel):
    recommendationConfidence: float    # 0-1
    evidenceStrength: float            # 0-1: how strong the combined signals are
    dataCompleteness: float            # 0-1: how many data sources contributed

# ── Response Models ────────────────────────────────────────────────────────────

class AgentRecommendationResponse(BaseModel):
    employeeId: str
    riskLevel: str
    attritionProbability: float
    priority: str
    topRiskFactors: List[str]
    positiveFactors: List[str]
    recommendedActions: List[RecommendedAction]
    expectedBusinessImpact: str
    policyReferences: List[str]
    reasoningSummary: str
    evidenceBundle: EvidenceBundle
    confidence: ConfidenceScores
    nextReviewDate: str
    generatedAt: str

class AgentBatchResponse(BaseModel):
    success: bool
    processedCount: int
    recommendations: List[AgentRecommendationResponse]

class AgentStatisticsResponse(BaseModel):
    totalRecommendations: int
    highRiskCount: int
    mediumRiskCount: int
    lowRiskCount: int
    mostCommonRiskFactors: List[str]
    mostCommonActions: List[str]
    departmentRiskOverview: Dict[str, int]
