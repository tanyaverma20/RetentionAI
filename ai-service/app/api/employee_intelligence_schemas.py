"""
employee_intelligence_schemas.py
=================================
Pydantic v2 request/response models for the Employee Intelligence (NLP) sprint
endpoints: POST /sentiment, POST /sentiment/batch, POST /employee-intelligence,
GET /employee-intelligence/{employeeId}, GET /employee-intelligence/dashboard.
"""

from __future__ import annotations

from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class SentimentRequest(BaseModel):
    text: str = Field(..., description="Raw text to analyze")


class SentimentBatchRequest(BaseModel):
    texts: List[str] = Field(..., description="List of raw texts to analyze")


class SentimentResult(BaseModel):
    text: str
    sentiment: str
    sentimentScore: float


class SentimentBatchResponse(BaseModel):
    success: bool = True
    results: List[SentimentResult]


class EmployeeIntelligenceRequest(BaseModel):
    employeeId: str = Field(..., description="Employee ObjectId to aggregate Employee Intelligence for")


class EmployeeIntelligenceBatchRequest(BaseModel):
    """Mirrors BatchPredictionRequest/ExplainBatchRequest's filtering shape."""
    departmentId: Optional[str] = Field(None, description="Department ID to analyze all department employees")
    employeeIds: Optional[List[str]] = Field(None, description="Explicit list of employee IDs to analyze")


class EmployeeIntelligenceResponse(BaseModel):
    employeeId: str
    sentiment: str
    sentimentScore: float
    emotion: str
    emotionBreakdown: Dict[str, float]
    burnoutRisk: str
    burnoutScore: float
    topics: List[str]
    keywords: List[str]
    confidence: float
    summary: str
    dataPoints: int
    generatedAt: str


class EmployeeIntelligenceBatchResponse(BaseModel):
    success: bool = True
    profiles: List[EmployeeIntelligenceResponse]
    totalCount: int
    successCount: int
    failedCount: int
