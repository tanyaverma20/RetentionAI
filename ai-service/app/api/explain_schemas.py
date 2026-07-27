"""
explain_schemas.py
==================
Pydantic v2 request/response models for the XAI endpoints.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ExplainRequest(BaseModel):
    """
    Body for POST /explain — accepts an ad-hoc employee feature dict.
    The caller supplies raw employee fields; the server transforms and explains.
    """
    employeeId:     Optional[str]  = Field(None, description="Optional employee ID for logging")
    salary:         Optional[float] = Field(None, description="Annual salary")
    dateOfBirth:    Optional[str]   = Field(None, description="ISO date string, e.g. '1990-05-15'")
    joiningDate:    Optional[str]   = Field(None, description="ISO date string, e.g. '2022-01-10'")
    gender:         Optional[str]   = Field(None, description="MALE | FEMALE | OTHER | PREFER_NOT_TO_SAY")
    employmentType: Optional[str]   = Field(None, description="FULL_TIME | PART_TIME | CONTRACT | INTERN")
    workLocation:   Optional[str]   = Field(None, description="Office | Remote | Hybrid")
    designation:    Optional[str]   = Field(None, description="Job title / designation")
    departmentId:   Optional[str]   = Field(None, description="Department ObjectId or code string")
    status:         Optional[str]   = Field(None, description="ACTIVE | TERMINATED | INACTIVE")


# ---------------------------------------------------------------------------
# Shared sub-models
# ---------------------------------------------------------------------------

class FeatureContributor(BaseModel):
    featureKey:     str
    displayName:    str
    shapValue:      float
    absShapValue:   float
    direction:      str   # 'INCREASES_RISK' | 'REDUCES_RISK'
    rawValue:       Any
    formattedValue: str


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class LocalExplanationResponse(BaseModel):
    success:                  bool = True
    data: Dict[str, Any]


class GlobalImportanceItem(BaseModel):
    featureKey:  str
    displayName: str
    meanAbsShap: float
    rank:        int


class GlobalImportanceResponse(BaseModel):
    success:    bool = True
    data: Dict[str, Any]


class PlotPathsResponse(BaseModel):
    success: bool = True
    data:    Dict[str, str]   # plotType → file path
