"""
app/experimentation/schemas.py
==============================
Pydantic data schemas for A/B testing and retention intervention evaluation.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExperimentCreateRequest(BaseModel):
    name: str = Field(..., description="Descriptive name of the retention intervention experiment")
    hypothesis: str = Field(..., description="Clearly stated hypothesis (e.g. 'Offering flexible scheduling reduces 90-day turnover')")
    organizationId: str = Field(..., description="Tenant organization ID")
    interventionType: str = Field(..., description="Type of intervention (e.g. 'COMPENSATION_ADJUSTMENT', 'FLEXIBLE_HOURS', 'MENTORSHIP')")
    primaryOutcome: str = Field(default="RETAINED_90_DAYS", description="Binary outcome metric being tested")
    observationWindowDays: int = Field(default=90, ge=14, le=365, description="Follow-up window in days to evaluate retention")
    targetSamplePerVariant: int = Field(default=100, ge=10, description="Target participants per variant for planned statistical power")
    expectedBaselineRate: float = Field(default=0.80, ge=0.01, le=0.99, description="Historical retention rate for control group (0-1)")
    minimumDetectableEffect: float = Field(default=0.05, ge=0.01, le=0.50, description="Minimum absolute effect size targeted (e.g. 0.05 = +5%)")
    eligibleCriteria: Optional[Dict[str, Any]] = Field(default=None, description="Filtering criteria for eligible employees")


class ExperimentAssignRequest(BaseModel):
    experimentId: str
    employeeId: str
    organizationId: str


class ExperimentAssignResponse(BaseModel):
    experimentId: str
    employeeId: str
    variant: str = Field(..., description="'TREATMENT' or 'CONTROL'")
    assignedAt: str
    salt: str


class OutcomeRecord(BaseModel):
    employeeId: str
    variant: str = Field(..., description="'TREATMENT' or 'CONTROL'")
    retained: bool = Field(..., description="True if retained at end of observation window, False if left")
    gender: Optional[str] = "UNKNOWN"
    departmentId: Optional[str] = "UNKNOWN"
    tenureMonths: Optional[float] = None
    baselineRisk: Optional[float] = None


class ExperimentEvaluateRequest(BaseModel):
    experimentId: str
    organizationId: str
    outcomes: List[OutcomeRecord] = Field(..., min_length=10, description="Observed outcomes for treatment and control employees")
    significanceLevel: float = Field(default=0.05, ge=0.001, le=0.20, description="Alpha threshold (typically 0.05)")
    averageCostOfReplacement: float = Field(default=40000.0, description="Estimated average cost to replace an employee in USD")
    interventionCostPerEmployee: float = Field(default=2500.0, description="Cost of delivering intervention per treated employee in USD")


class StatisticalMetrics(BaseModel):
    controlCount: int
    controlRetained: int
    controlRetentionRate: float
    treatmentCount: int
    treatmentRetained: int
    treatmentRetentionRate: float
    absoluteRiskDifference: float
    relativeLift: float
    confidenceInterval95: List[float]
    zStatistic: float
    pValue: float
    statisticalMethod: str
    statisticallySignificant: bool


class BusinessImpact(BaseModel):
    estimatedEmployeesSavedPer100Treated: float
    netFinancialImpactPer100Treated: float
    returnOnInvestmentPct: float
    practicalSignificanceSummary: str


class FairnessAudit(BaseModel):
    isBalanced: bool
    warnings: List[str]
    genderDistribution: Dict[str, Dict[str, int]]


class ExperimentEvaluationResponse(BaseModel):
    experimentId: str
    status: str
    sampleSizeAdequate: bool
    statistics: StatisticalMetrics
    businessImpact: BusinessImpact
    fairnessAudit: FairnessAudit
    executiveSummary: str
    recommendation: str
    evaluatedAt: str
    disclaimer: str
