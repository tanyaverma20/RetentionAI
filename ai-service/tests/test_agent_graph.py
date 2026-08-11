import pytest
import asyncio
from app.agent.retention_graph import retention_graph_app

@pytest.mark.asyncio
async def test_agent_graph_validation_failure():
    """Verify that missing organizationId causes context validation to fail and returns error state."""
    initial_state = {
        "organizationId": "",
        "employeeId": "emp-123",
        "errors": [],
        "trace": [],
    }
    final_state = await retention_graph_app.ainvoke(initial_state)
    decision = final_state.get("decision", {})
    assert decision.get("success") is False
    assert "organizationId is required" in decision.get("error", "")

@pytest.mark.asyncio
async def test_agent_graph_cross_tenant_prevention():
    """Verify that non-existent or unauthenticated cross-tenant access is rejected at context_validation_node."""
    initial_state = {
        "organizationId": "60d5ec388832a828f8000000",
        "employeeId": "nonexistent_employee_999",
        "errors": [],
        "trace": [],
    }
    final_state = await retention_graph_app.ainvoke(initial_state)
    decision = final_state.get("decision", {})
    assert decision.get("success") is False
    assert len(final_state.get("errors", [])) > 0
