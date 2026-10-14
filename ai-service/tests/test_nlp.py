import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.features import NLP_AVAILABLE

_token = os.getenv("AI_SERVICE_TOKEN", "replace-with-a-service-token")


@pytest.fixture(scope="module")
def client():
    with TestClient(app, headers={"Authorization": f"Bearer {_token}"}) as c:
        yield c

@pytest.fixture
def mock_analyze_hr_text(monkeypatch):
    """
    Mock the heavy NLP pipeline for faster tests.
    """
    def mock_analyze(text, cleaned_text):
        return {
            "sentiment": "Positive",
            "sentimentScore": 0.8,
            "detectedEmotions": {"Motivated": 0.9, "Happy": 0.8},
            "detectedTopics": ["Career Growth", "Leadership"],
            "extractedKeywords": ["manager", "career"],
            "burnoutRisk": 0.1,
            "resignationIntent": 0.05,
            "engagementRisk": 0.1,
            "promotionFrustration": 0.2,
            "managerConflict": 0.0,
            "generatedAt": "2026-07-27T10:00:00"
        }
    monkeypatch.setattr("app.nlp.api_routes_or_analyzer.analyze_hr_text", mock_analyze)

def test_nlp_analyze_endpoint_real_pipeline(client):
    """
    Integration test using the real pipeline to ensure it works end-to-end.
    In lite build, asserts proper 503 response per contract.
    """
    payload = {
        "employeeId": "test_emp_123",
        "sourceCollection": "employee_feedback",
        "sourceDocumentId": "doc_123",
        "text": "I love my manager and the career growth opportunities here!"
    }
    
    response = client.post("/nlp/analyze", json=payload)
    if not NLP_AVAILABLE:
        assert response.status_code == 503
        assert response.json()["code"] == "FEATURE_NOT_AVAILABLE_IN_BUILD"
        return

    assert response.status_code == 200
    data = response.json()
    assert data["employeeId"] == "test_emp_123"
    assert data["sentiment"] in ["Positive", "Neutral", "Negative"]
    assert "detectedEmotions" in data
    assert "detectedTopics" in data
    assert "extractedKeywords" in data

def test_nlp_batch_analyze_endpoint(client):
    payload = {
        "records": [
            {
                "employeeId": "emp_1",
                "sourceCollection": "manager_notes",
                "sourceDocumentId": "doc_1",
                "text": "Great performance this quarter."
            },
            {
                "employeeId": "emp_2",
                "sourceCollection": "employee_surveys",
                "sourceDocumentId": "doc_2",
                "text": "I am feeling very stressed and burnt out due to the heavy workload."
            }
        ]
    }
    
    response = client.post("/nlp/analyze/batch", json=payload)
    if not NLP_AVAILABLE:
        assert response.status_code == 503
        assert response.json()["code"] == "FEATURE_NOT_AVAILABLE_IN_BUILD"
        return

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["processedCount"] == 2
    assert len(data["insights"]) == 2
    insight2 = data["insights"][1]
    assert insight2["employeeId"] == "emp_2"
    assert "burnoutRisk" in insight2

def test_nlp_employee_insights(client):
    response = client.get("/nlp/employee/test_emp_123")
    if not NLP_AVAILABLE:
        assert response.status_code == 503
        assert response.json()["code"] == "FEATURE_NOT_AVAILABLE_IN_BUILD"
        return

    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_nlp_dashboard_stats(client):
    response = client.get("/nlp/dashboard")
    if not NLP_AVAILABLE:
        assert response.status_code == 503
        assert response.json()["code"] == "FEATURE_NOT_AVAILABLE_IN_BUILD"
        return

    assert response.status_code == 200
    data = response.json()
    assert "overallSentiment" in data
    assert "averageSentimentScore" in data


# ---------------------------------------------------------------------------
# Auth regression tests
# ---------------------------------------------------------------------------

unauthenticated_client = TestClient(app)

@pytest.mark.parametrize(
    "method,path,json_body",
    [
        ("post", "/nlp/analyze", {
            "employeeId": "test_emp_123",
            "sourceCollection": "employee_feedback",
            "sourceDocumentId": "doc_123",
            "text": "Some feedback text.",
        }),
        ("post", "/nlp/analyze/batch", {"records": []}),
        ("get", "/nlp/employee/test_emp_123", None),
        ("get", "/nlp/dashboard", None),
        ("get", "/nlp/statistics", None),
    ],
)
def test_nlp_endpoints_reject_missing_auth(method, path, json_body):
    if not NLP_AVAILABLE:
        # In lite build, unavailable route returns 503 before processing auth
        response = unauthenticated_client.post(path, json=json_body) if method == "post" else unauthenticated_client.get(path)
        assert response.status_code == 503
        return

    if method == "post":
        response = unauthenticated_client.post(path, json=json_body)
    else:
        response = unauthenticated_client.get(path)
    assert response.status_code == 401


def test_nlp_endpoints_reject_invalid_token():
    if not NLP_AVAILABLE:
        response = unauthenticated_client.get(
            "/nlp/dashboard", headers={"Authorization": "Bearer wrong-token"}
        )
        assert response.status_code == 503
        return

    response = unauthenticated_client.get(
        "/nlp/dashboard", headers={"Authorization": "Bearer wrong-token"}
    )
    assert response.status_code == 401
