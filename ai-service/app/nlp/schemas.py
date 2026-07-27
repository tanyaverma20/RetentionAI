from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime

class NLPAnalyzeRequest(BaseModel):
    employeeId: str
    sourceCollection: str = Field(..., description="e.g., employee_feedback, employee_surveys, manager_notes")
    sourceDocumentId: str
    text: str

class NLPBatchAnalyzeRequest(BaseModel):
    records: List[NLPAnalyzeRequest]

class NLPInsightsResponse(BaseModel):
    employeeId: str
    sourceCollection: str
    sourceDocumentId: str
    sentiment: str
    sentimentScore: float
    detectedEmotions: Dict[str, float]
    detectedTopics: List[str]
    extractedKeywords: List[str]
    burnoutRisk: float
    resignationIntent: float
    engagementRisk: float
    promotionFrustration: Optional[float] = 0.0
    managerConflict: Optional[float] = 0.0
    generatedAt: str

class NLPBatchResponse(BaseModel):
    success: bool
    processedCount: int
    insights: List[NLPInsightsResponse]

class DashboardStatistics(BaseModel):
    overallSentiment: str
    averageSentimentScore: float
    burnoutTrend: float
    engagementTrend: float
    topTopics: List[str]
    topComplaints: List[str]
