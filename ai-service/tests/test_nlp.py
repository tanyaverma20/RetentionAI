import os
import pytest
from fastapi.testclient import TestClient
from app.main import app

# Send whatever AI_SERVICE_TOKEN is actually configured (main.py's
# load_dotenv() picks up ai-service/.env when the app module is imported) —
# verify_auth_token only bypasses auth when the token is unset/the
# placeholder, so a real configured token must be sent. Mirrors
# test_explainability.py's api_client fixture.
_token = os.getenv("AI_SERVICE_TOKEN", "replace-with-a-service-token")


@pytest.fixture(scope="module")
def client():
    # Used as a context manager (not a bare `TestClient(app)`) so the app's
    # startup lifespan actually runs and connects the real Motor client —
    # without it, get_db() inside app/nlp/repository.py returns None and
    # every one of these endpoints 500s once a request gets past auth.
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
    monkeypatch.setattr("app.nlp.api_routes_or_analyzer.analyze_hr_text", mock_analyze) # Just need to test endpoint integration
    # Actually, we can test the real analyzer for a quick sanity check but for API it's better to mock

def test_nlp_analyze_endpoint_real_pipeline(client):
    """
    Integration test using the real pipeline to ensure it works end-to-end.
    """
    payload = {
        "employeeId": "test_emp_123",
        "sourceCollection": "employee_feedback",
        "sourceDocumentId": "doc_123",
        "text": "I love my manager and the career growth opportunities here!"
    }
    
    response = client.post("/nlp/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert data["employeeId"] == "test_emp_123"
    assert data["sentiment"] in ["Positive", "Neutral", "Negative"] # Most likely Positive
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
    assert response.status_code == 200
    data = response.json()
    
    assert data["success"] is True
    assert data["processedCount"] == 2
    assert len(data["insights"]) == 2
    
    # Check if the second one flagged burnout (it should conceptually, but we just check keys here)
    insight2 = data["insights"][1]
    assert insight2["employeeId"] == "emp_2"
    assert "burnoutRisk" in insight2

def test_nlp_employee_insights(client):
    # Requires DB data to be meaningful, but we can verify it returns 200 and a list
    response = client.get("/nlp/employee/test_emp_123")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_nlp_dashboard_stats(client):
    response = client.get("/nlp/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "overallSentiment" in data
    assert "averageSentimentScore" in data


# ---------------------------------------------------------------------------
# Regression: nlp_routes.py previously had NO auth dependency on any of its
# 5 endpoints, unlike every sibling router (routes.py, explain_routes.py,
# decision_routes.py, employee_intelligence_routes.py, rag_routes.py), which
# all consistently require a bearer token. This left raw employee sentiment/
# burnout data readable and writable by anyone who could reach the port.
# Fixed by applying the same verify_auth_token dependency used everywhere
# else. This test uses a client with NO Authorization header — it must
# never regress back to 200.
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
    if method == "post":
        response = unauthenticated_client.post(path, json=json_body)
    else:
        response = unauthenticated_client.get(path)
    assert response.status_code == 401


def test_nlp_endpoints_reject_invalid_token():
    response = unauthenticated_client.get(
        "/nlp/dashboard", headers={"Authorization": "Bearer wrong-token"}
    )
    assert response.status_code == 401
