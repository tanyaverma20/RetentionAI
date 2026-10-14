"""
tests/test_agent.py
===================
Integration tests for the Agentic AI orchestration layer and Decision Intelligence routes.
Uses FastAPI TestClient to test /agent and /decision endpoints with authentication and mocking.
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app as fastapi_app

_token = os.getenv("AI_SERVICE_TOKEN", "replace-with-a-service-token")
AUTH_HEADERS = {"Authorization": f"Bearer {_token}"}

@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="module")
async def async_client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

def sample_employee_doc():
    return {
        "employeeId": "emp123",
        "fullName": "John Doe",
        "departmentId": "dept01",
        "designation": "Software Engineer",
        "joiningDate": "2022-01-15",
        "salary": 85000,
        "performanceScore": 4.2,
        "age": 30,
        "tenureMonths": 48,
        "educationLevel": "Masters",
        "remote": False,
    }

def _mock_decision_response(employee_id="emp123"):
    return {
        "employeeId": employee_id,
        "recommendationType": "Retention Plan",
        "priority": "HIGH",
        "confidence": 0.85,
        "reasoning": "High flight risk due to market compensation gap.",
        "evidence": {
            "mlRiskScore": 0.75,
            "sentiment": "Neutral",
            "burnoutRisk": 0.3,
        },
        "affectedFactors": ["salary", "overtime"],
        "relatedPolicies": ["Retention Policy.pdf"],
        "expectedOutcome": "Retention of high performing asset.",
        "reviewDate": "2026-11-01T00:00:00",
        "recommendedActions": [
            {
                "category": "Retention",
                "description": "Conduct retention 1:1 and review compensation band.",
                "priority": "HIGH",
                "policyReference": "Compensation Adjustment Policy 2026",
                "expectedImpact": "Reduces attrition risk by 20%",
            }
        ],
        "generatedAt": "2026-10-15T00:00:00",
        "generatedBy": "test_user",
    }

# ------------------- Agentic LangGraph Endpoint Tests -------------------
@pytest.mark.anyio
async def test_agent_endpoint_rejects_unauthenticated(async_client: AsyncClient):
    payload = {
        "employeeId": "emp123",
        "organizationId": "60d5ec388832a828f8000000"
    }
    expected = os.getenv("AI_SERVICE_TOKEN")
    if expected and expected != "replace-with-a-service-token":
        response = await async_client.post("/agent/employee-decision", json=payload)
        assert response.status_code == 401

@pytest.mark.anyio
async def test_agent_endpoint_requires_organization_id(async_client: AsyncClient):
    payload = {
        "employeeId": "emp123",
        "organizationId": ""
    }
    response = await async_client.post("/agent/employee-decision", json=payload, headers=AUTH_HEADERS)
    assert response.status_code == 400

# ------------------- Decision Intelligence Engine Tests -------------------
@pytest.mark.anyio
async def test_recommend_single(async_client: AsyncClient):
    payload = {
        "employeeId": "emp123",
        "employeeData": sample_employee_doc(),
        "userId": "test_user"
    }
    with patch("app.api.decision_routes.generate_decision", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = _mock_decision_response("emp123")
        response = await async_client.post("/decision/generate", json=payload, headers=AUTH_HEADERS)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["employeeId"] == "emp123"
        assert data["priority"] == "HIGH"
        assert "recommendedActions" in data
        assert isinstance(data["recommendedActions"], list)
        assert "confidence" in data
        assert "reasoning" in data

@pytest.mark.anyio
async def test_recommend_batch(async_client: AsyncClient):
    payload = {
        "employees": [
            {
                "employeeId": "emp123",
                "employeeData": sample_employee_doc(),
                "userId": "test_user"
            },
            {
                "employeeId": "emp456",
                "employeeData": sample_employee_doc(),
                "userId": "test_user"
            }
        ]
    }
    with patch("app.api.decision_routes.create_job", new_callable=AsyncMock) as mock_create_job, \
         patch("app.api.decision_routes.generate_batch_decisions", new_callable=AsyncMock):
        mock_create_job.return_value = "job_test_123"
        response = await async_client.post("/decision/batch", json=payload, headers=AUTH_HEADERS)
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["jobId"] == "job_test_123"

@pytest.mark.anyio
async def test_history_endpoint(async_client: AsyncClient):
    with patch("app.api.decision_routes.get_decision_history", new_callable=AsyncMock) as mock_history:
        mock_history.return_value = [_mock_decision_response("emp123")]
        response = await async_client.get("/decision/history", headers=AUTH_HEADERS)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

@pytest.mark.anyio
async def test_dashboard_endpoint(async_client: AsyncClient):
    with patch("app.api.decision_routes.get_decision_dashboard_stats", new_callable=AsyncMock) as mock_stats:
        mock_stats.return_value = {
            "totalDecisions": 15,
            "recommendationDistribution": {"Retention Plan": 10, "Promotion": 5},
            "priorityDistribution": {"HIGH": 5, "MEDIUM": 8, "LOW": 2},
        }
        response = await async_client.get("/decision/dashboard", headers=AUTH_HEADERS)
        assert response.status_code == 200
        stats = response.json()
        assert stats["totalDecisions"] == 15
        assert "recommendationDistribution" in stats
        assert "priorityDistribution" in stats
