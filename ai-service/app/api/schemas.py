from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# Request Schemas
class SinglePredictionRequest(BaseModel):
    employeeId: str = Field(..., description="The ID of the employee to predict attrition risk for")

class BatchPredictionRequest(BaseModel):
    departmentId: Optional[str] = Field(None, description="Department ID to predict for all department employees")
    employeeIds: Optional[List[str]] = Field(None, description="Explicit list of employee IDs to predict")
    reason: Optional[str] = Field(None, description="Reason for running the batch prediction")

# Response Schemas
class PredictionResult(BaseModel):
    employeeId: str
    riskScore: float = Field(..., ge=0.0, le=1.0)
    riskLevel: str = Field(..., description="LOW, MEDIUM, or HIGH")
    confidence: float = Field(..., ge=0.0, le=1.0)
    predictedAt: datetime
    modelVersion: str
    status: str

class BatchPredictionResponse(BaseModel):
    runId: str
    status: str
    totalCount: int
    successCount: int
    failedCount: int
    predictions: List[PredictionResult]
    predictedAt: datetime

class ModelInfoResponse(BaseModel):
    version: str
    algorithm: str
    featureKeys: List[str]
    trainedAt: str
    status: str

class ModelMetricsResponse(BaseModel):
    algorithm: str
    metrics: Dict[str, float]

class HealthStatusResponse(BaseModel):
    status: str
    mongodbConnected: bool
    modelLoaded: bool
    modelVersion: Optional[str] = None
