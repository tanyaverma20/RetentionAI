import os
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from app.agent.retention_graph import retention_graph_app

router = APIRouter(tags=["Agentic AI Decision Engine"])

class AgentDecisionRequest(BaseModel):
    employeeId: str
    organizationId: str
    query: Optional[str] = None

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

@router.post("/agent/employee-decision", dependencies=[Depends(verify_auth_token)])
async def execute_agent_decision(request: AgentDecisionRequest):
    if not request.organizationId:
        raise HTTPException(status_code=400, detail="organizationId is required for tenant-isolated agent decision.")
    if not request.employeeId:
        raise HTTPException(status_code=400, detail="employeeId is required.")

    initial_state = {
        "organizationId": request.organizationId,
        "employeeId": request.employeeId,
        "query": request.query,
        "errors": [],
        "trace": [],
    }

    try:
        final_state = await retention_graph_app.ainvoke(initial_state)
        decision = final_state.get("decision", {})
        if not decision.get("success", False):
            raise HTTPException(
                status_code=400 if "Tenant Security Violation" in str(decision.get("error")) or "not found" in str(decision.get("error")) else 500,
                detail=decision.get("error", "Agentic decision workflow failed.")
            )
        return decision
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent workflow execution failed: {str(e)}")
