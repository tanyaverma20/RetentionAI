"""
schemas.py
==========
Pydantic request and response schemas for the RetentionAI AI Service API.

All request schemas include field-level validation; invalid payloads are
rejected at the FastAPI deserialization boundary with structured 422 errors
before any business logic runs.

Rules for field constraints are documented inline — no silent coercion
happens; a rejected field always produces a message that names the field
and the rule that failed.
"""

from __future__ import annotations

import math
import re
from datetime import datetime
from typing import Annotated, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Shared type aliases with documented constraints
# ---------------------------------------------------------------------------
_OBJECTID_RE = re.compile(r"^[0-9a-fA-F]{24}$")
_PROBABILITY = Annotated[float, Field(ge=0.0, le=1.0)]

VALID_RISK_LEVELS: frozenset[str] = frozenset({"LOW", "MEDIUM", "HIGH"})

# Maximum number of employee IDs accepted in a single batch request.
# Prevents accidental full-dataset scans from a single API call.
BATCH_MAX_SIZE: int = 500


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_object_id(value: str, field_name: str) -> str:
    """Raises ValueError if *value* is not a 24-hex-character MongoDB ObjectId."""
    if not _OBJECTID_RE.match(value):
        raise ValueError(
            f"{field_name} must be a 24-character hexadecimal MongoDB ObjectId; "
            f"received: '{value}'"
        )
    return value


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class SinglePredictionRequest(BaseModel):
    """Request body for POST /predict — single-employee attrition prediction."""

    employeeId: str = Field(
        ...,
        description="MongoDB ObjectId (24 hex chars) of the employee to predict.",
        min_length=1,
    )

    @field_validator("employeeId")
    @classmethod
    def validate_employee_id(cls, v: str) -> str:
        return _validate_object_id(v.strip(), "employeeId")


class BatchPredictionRequest(BaseModel):
    """
    Request body for POST /predict/batch.

    Either *employeeIds* or *departmentId* may be supplied; supplying neither
    triggers an organisation-wide prediction run against all active employees.
    Supplying both is rejected — the caller must pick one filter.
    """

    departmentId: Optional[str] = Field(
        None,
        description="MongoDB ObjectId of the department — predicts all department employees.",
    )
    employeeIds: Optional[List[str]] = Field(
        None,
        description=f"Explicit list of employee ObjectIds (max {BATCH_MAX_SIZE}).",
        max_length=BATCH_MAX_SIZE,
    )
    reason: Optional[str] = Field(
        None,
        description="Human-readable reason for this batch run (audit trail).",
        max_length=500,
    )

    @field_validator("departmentId")
    @classmethod
    def validate_department_id(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_object_id(v.strip(), "departmentId")

    @field_validator("employeeIds", mode="before")
    @classmethod
    def validate_employee_ids(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        if len(v) == 0:
            raise ValueError("employeeIds must not be an empty list; omit the field to run all employees.")
        if len(v) > BATCH_MAX_SIZE:
            raise ValueError(
                f"employeeIds exceeds the maximum batch size of {BATCH_MAX_SIZE}. "
                "Split the request into smaller batches."
            )
        bad = [eid for eid in v if not _OBJECTID_RE.match(str(eid).strip())]
        if bad:
            raise ValueError(
                f"The following employeeIds are not valid ObjectIds: {bad[:5]}"
                + ("…" if len(bad) > 5 else "")
            )
        return [eid.strip() for eid in v]

    @model_validator(mode="after")
    def both_filters_rejected(self) -> "BatchPredictionRequest":
        if self.employeeIds and self.departmentId:
            raise ValueError(
                "Provide either 'employeeIds' or 'departmentId', not both. "
                "Supply only the filter that describes your target set."
            )
        return self


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class PredictionResult(BaseModel):
    """Per-employee prediction result returned from /predict and /predict/batch."""

    employeeId: str
    riskScore: _PROBABILITY
    riskLevel: str = Field(..., description="One of LOW, MEDIUM, or HIGH.")
    confidence: _PROBABILITY
    predictedAt: datetime
    modelVersion: str
    status: str

    @field_validator("riskScore", "confidence")
    @classmethod
    def must_be_finite(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Prediction probability must be a finite number (not NaN or Inf).")
        return v

    @field_validator("riskLevel")
    @classmethod
    def valid_risk_level(cls, v: str) -> str:
        if v not in VALID_RISK_LEVELS:
            raise ValueError(
                f"riskLevel must be one of {sorted(VALID_RISK_LEVELS)}; received '{v}'."
            )
        return v


class BatchPredictionResponse(BaseModel):
    """Response envelope for POST /predict/batch."""

    runId: str
    status: str
    totalCount: int = Field(..., ge=0)
    successCount: int = Field(..., ge=0)
    failedCount: int = Field(..., ge=0)
    predictions: List[PredictionResult]
    predictedAt: datetime


class ModelInfoResponse(BaseModel):
    """Response for GET /model/info."""

    version: str
    algorithm: str
    featureKeys: List[str]
    trainedAt: str
    status: str


class ModelMetricsResponse(BaseModel):
    """Response for GET /model/metrics."""

    algorithm: str
    metrics: Dict[str, float]

    @field_validator("metrics")
    @classmethod
    def metrics_are_finite(cls, v: Dict[str, float]) -> Dict[str, float]:
        bad = {k: val for k, val in v.items() if not math.isfinite(val)}
        if bad:
            raise ValueError(f"Non-finite metric value(s) detected: {bad}")
        return v


class HealthStatusResponse(BaseModel):
    """Response for GET /health."""

    status: str
    mongodbConnected: bool
    modelLoaded: bool
    modelVersion: Optional[str] = None


# ---------------------------------------------------------------------------
# Model-version / feature-schema validation helpers
# (used by prediction_service at model load time — not HTTP schemas)
# ---------------------------------------------------------------------------

def validate_prediction_output(risk_score: float, confidence: float) -> None:
    """
    Validates that a model's numeric outputs are within expected bounds.

    Raises ``ValueError`` with a descriptive message if any value is
    non-finite, negative, or exceeds 1.0.  Call this immediately after
    ``model.predict_proba`` so malformed outputs never reach the database
    or the API response layer.
    """
    for label, value in [("riskScore", risk_score), ("confidence", confidence)]:
        if not math.isfinite(value):
            raise ValueError(
                f"Model output validation failed: {label}={value!r} is not finite. "
                "The model may be corrupted or trained on incompatible data."
            )
        if value < 0.0 or value > 1.0:
            raise ValueError(
                f"Model output validation failed: {label}={value!r} is outside [0, 1]. "
                "Expected a calibrated probability from predict_proba."
            )
