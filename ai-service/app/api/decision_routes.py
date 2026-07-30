"""
app/api/decision_routes.py
===========================
FastAPI router for the AI Decision Intelligence Engine.

Endpoints:
- POST /decision/generate   : Single-employee recommendation (ML+SHAP+NLP+RAG+Rules)
- POST /decision/batch      : Batch recommendations
- GET  /decision/dashboard  : Aggregated stats (registered BEFORE /{employeeId})
- GET  /decision/history    : Recent decisions across all employees (registered BEFORE /{employeeId})
- GET  /decision/{employeeId} : Decision history for one employee

This module does not implement any ML/SHAP/NLP/RAG logic itself — see
app/decision/services/decision_service.py, which composes the existing
app.agent orchestrator with the new deterministic Business Rules engine.
"""

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.decision.schemas import (
    DecisionGenerateRequest,
    DecisionBatchRequest,
    DecisionResponse,
    DecisionBatchResponse,
    DecisionDashboardResponse,
)
from app.decision.services.decision_service import (
    generate_decision,
    generate_batch_decisions,
    get_decision_history,
    get_employee_decisions,
    get_decision_dashboard_stats,
)

router = APIRouter(prefix="/decision", tags=["Decision Intelligence"])


async def verify_auth_token(authorization: Optional[str] = Header(None)):
    expected = os.getenv("AI_SERVICE_TOKEN")
    if not expected or expected == "replace-with-a-service-token":
        return True
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Authorization header format")
    if parts[1] != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return True


@router.post("/generate", response_model=DecisionResponse, dependencies=[Depends(verify_auth_token)])
async def decision_generate(request: DecisionGenerateRequest):
    if not request.employeeId:
        raise HTTPException(status_code=422, detail="employeeId is required.")
    if not request.employeeData:
        raise HTTPException(status_code=422, detail="employeeData is required.")

    try:
        result = await generate_decision(request.employeeId, request.employeeData, request.userId or "system")
        return DecisionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decision generation failed: {e}")


@router.post("/batch", response_model=DecisionBatchResponse, dependencies=[Depends(verify_auth_token)])
async def decision_batch(request: DecisionBatchRequest):
    if not request.employees:
        raise HTTPException(status_code=422, detail="No employees provided.")

    try:
        raw_results = await generate_batch_decisions(
            employees=[e.model_dump() for e in request.employees]
        )
        decisions = [DecisionResponse(**r) for r in raw_results]
        return DecisionBatchResponse(success=True, processedCount=len(decisions), decisions=decisions)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch decision generation failed: {e}")


# Registered BEFORE /{employeeId} — otherwise "dashboard"/"history" would be
# swallowed as an employeeId path parameter.
@router.get("/dashboard", response_model=DecisionDashboardResponse, dependencies=[Depends(verify_auth_token)])
async def decision_dashboard():
    stats = await get_decision_dashboard_stats()
    return DecisionDashboardResponse(**stats)


@router.get("/history", response_model=List[Dict[str, Any]], dependencies=[Depends(verify_auth_token)])
async def decision_history():
    try:
        return await get_decision_history(limit=50)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch decision history: {e}")


@router.get("/{employeeId}", response_model=List[Dict[str, Any]], dependencies=[Depends(verify_auth_token)])
async def decision_for_employee(employeeId: str):
    try:
        return await get_employee_decisions(employeeId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch employee decisions: {e}")
