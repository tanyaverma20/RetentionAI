from pydantic import BaseModel, Field
from typing import List, Dict, Optional

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
    dominantEmotion: Optional[str] = None
    detectedTopics: List[str]
    extractedKeywords: List[str]
    burnoutRisk: float
    burnoutLevel: Optional[str] = None
    resignationIntent: float
    engagementRisk: float
    promotionFrustration: Optional[float] = 0.0
    managerConflict: Optional[float] = 0.0
    confidence: Optional[float] = None
    summary: Optional[str] = None
    generatedAt: str

class NLPBatchResponse(BaseModel):
    success: bool
    processedCount: int
    insights: List[NLPInsightsResponse]

class TopicFrequency(BaseModel):
    topic: str
    count: int

class DashboardStatistics(BaseModel):
    overallSentiment: str
    averageSentimentScore: float
    burnoutTrend: float
    engagementTrend: float
    topTopics: List[str]
    topComplaints: List[str]
    sentimentDistribution: Optional[Dict[str, int]] = None
    burnoutDistribution: Optional[Dict[str, int]] = None
    emotionDistribution: Optional[Dict[str, int]] = None
    trendingTopics: Optional[List[TopicFrequency]] = None
