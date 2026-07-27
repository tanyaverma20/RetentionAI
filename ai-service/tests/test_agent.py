"""
tests/test_agent.py
===================
Integration tests for the Agentic AI orchestration layer.
Uses FastAPI TestClient to hit the /agent endpoints.
"""

import asyncio
import pytest
from httpx import AsyncClient
from fastapi import FastAPI
from app.main import app as fastapi_app

# Fixtures
@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"

@pytest.fixture(scope="module")
async def async_client():
    async with AsyncClient(app=fastapi_app, base_url="http://testserver") as client:
        yield client

# Helper to create a minimal employee document for testing
def sample_employee_doc():
    return {
        "employeeId": "emp123",
        "fullName": "John Doe",
        "departmentId": "dept01",
        "designation": "Software Engineer",
        "joiningDate": "2022-01-15",
        "salary": 85000,
        "performanceScore": 4.2,
        # additional features expected by ML model
        "age": 30,
        "tenureMonths": 48,
        "educationLevel": "Masters",
        "remote": False,
    }

# ------------------- Single Recommendation Test -------------------
@pytest.mark.anyio
async def test_recommend_single(async_client: AsyncClient):
    payload = {
        "employeeId": "emp123",
        "employeeData": sample_employee_doc(),
        "userId": "test_user"
    }
    response = await async_client.post("/agent/recommend", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    # Basic schema checks
    assert data["employeeId"] == "emp123"
    assert "riskLevel" in data
    assert "recommendedActions" in data and isinstance(data["recommendedActions"], list)
    assert "evidenceBundle" in data
    assert "confidence" in data

# ------------------- Batch Recommendation Test -------------------
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
    response = await async_client.post("/agent/recommend/batch", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["success"] is True
    assert data["processedCount"] == 2
    assert isinstance(data["recommendations"], list)
    for rec in data["recommendations"]:
        assert "employeeId" in rec
        assert "recommendedActions" in rec

# ------------------- History Endpoint Test -------------------
@pytest.mark.anyio
async def test_history_endpoint(async_client: AsyncClient):
    response = await async_client.get("/agent/history")
    assert response.status_code == 200
    # Expect a list (might be empty initially)
    assert isinstance(response.json(), list)

# ------------------- Statistics Endpoint Test -------------------
@pytest.mark.anyio
async def test_statistics_endpoint(async_client: AsyncClient):
    response = await async_client.get("/agent/statistics")
    assert response.status_code == 200
    stats = response.json()
    for key in [
        "totalRecommendations",
        "highRiskCount",
        "mediumRiskCount",
        "lowRiskCount",
        "mostCommonRiskFactors",
        "mostCommonActions",
        "departmentRiskOverview",
    ]:
        assert key in stats
