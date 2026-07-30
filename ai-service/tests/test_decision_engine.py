"""
tests/test_decision_engine.py
==============================
Unit tests for the Decision Engine's userId/generatedBy propagation — the
Sprint 7 API-contract fix. Previously `POST /decision/batch` always stamped
every generated decision's `generatedBy` as "system", ignoring the real
authenticated HR/Admin user each employee entry actually carried, because
`generate_batch_decisions()` used its own function-level default instead of
each employee's own `userId`. Single-employee generation was never affected.

These tests mock `orchestrate_recommendation` (ML+SHAP+NLP+RAG+LLM) so they
run without a live MongoDB, trained model, or Groq API key — they exercise
only the decision_service composition/plumbing layer, not the underlying
pipelines (already covered by test_agent.py / test_explainability.py /
test_nlp.py / test_rag.py). Rule Engine and recommendation-generation logic
are exercised exactly as before — untouched by this fix.
"""

import datetime
from unittest.mock import AsyncMock, patch

import pytest

from app.decision.services import decision_service


def _fake_orchestrator_result(employee_id: str) -> dict:
    """A minimal, well-formed orchestrate_recommendation() return value."""
    return {
        "employeeId": employee_id,
        "riskLevel": "MEDIUM",
        "attritionProbability": 0.42,
        "priority": "MEDIUM",
        "topRiskFactors": ["Overtime"],
        "positiveFactors": ["Tenure"],
        "recommendedActions": [{
            "category": "Retention",
            "description": "Schedule a 1:1 check-in.",
            "priority": "MEDIUM",
            "policyReference": None,
            "expectedImpact": "Improved engagement.",
        }],
        "expectedBusinessImpact": "Reduced attrition risk.",
        "policyReferences": ["Retention Policy.pdf, p.1"],
        "reasoningSummary": "Moderate risk with no acute drivers.",
        "evidenceBundle": {
            "mlRiskScore": 0.42,
            "mlRiskLevel": "MEDIUM",
            "mlConfidence": 0.7,
            "topRiskFeatures": ["Overtime"],
            "topProtectiveFeatures": ["Tenure"],
            "sentiment": "Neutral",
            "burnoutRisk": 0.2,
            "resignationIntent": 0.1,
            "detectedTopics": [],
            "extractedKeywords": [],
            "ragPoliciesFound": ["Retention Policy.pdf, p.1"],
        },
        "confidence": {
            "recommendationConfidence": 0.65,
            "evidenceStrength": 0.6,
            "dataCompleteness": 1.0,
        },
        "nextReviewDate": "2026-09-01",
        "generatedAt": datetime.datetime.utcnow().isoformat(),
    }


def _sample_employee_doc():
    return {
        "joiningDate": "2023-01-15",
        "departmentId": "dept01",
        "designation": "Software Engineer",
    }


REQUIRED_RESPONSE_FIELDS = [
    "employeeId", "recommendationType", "priority", "confidence", "reasoning",
    "evidence", "affectedFactors", "relatedPolicies", "expectedOutcome",
    "reviewDate", "recommendedActions", "generatedAt", "generatedBy",
]


@pytest.mark.asyncio
async def test_single_generation_records_authenticated_user():
    """generate_decision()'s generatedBy must equal the caller's userId (unaffected by this fix, verified as a regression guard)."""
    with patch.object(
        decision_service, "orchestrate_recommendation",
        new=AsyncMock(return_value=_fake_orchestrator_result("emp1")),
    ), patch.object(decision_service, "_log_decision", new=AsyncMock()) as mock_log:
        result = await decision_service.generate_decision("emp1", _sample_employee_doc(), user_id="hr_user_alice")

    for field in REQUIRED_RESPONSE_FIELDS:
        assert field in result, f"missing required field: {field}"
    assert result["generatedBy"] == "hr_user_alice"

    # The audit log entry must carry the same authenticated user, not "system".
    mock_log.assert_awaited_once()
    logged_decision = mock_log.await_args.args[0]
    assert logged_decision["generatedBy"] == "hr_user_alice"


@pytest.mark.asyncio
async def test_batch_generation_records_authenticated_user_per_employee():
    """
    Regression test for the batch API-contract bug: every batch-generated
    decision used to be stamped generatedBy="system" regardless of the real
    per-employee userId, because generate_batch_decisions() ignored
    emp["userId"] in favor of its own function-level default.
    """
    with patch.object(
        decision_service, "orchestrate_recommendation",
        new=AsyncMock(side_effect=lambda employee_id, employee_doc: _fake_orchestrator_result(employee_id)),
    ), patch.object(decision_service, "_log_decision", new=AsyncMock()) as mock_log:
        employees = [
            {"employeeId": "emp1", "employeeData": _sample_employee_doc(), "userId": "hr_user_alice"},
            {"employeeId": "emp2", "employeeData": _sample_employee_doc(), "userId": "hr_user_bob"},
        ]
        results = await decision_service.generate_batch_decisions(employees, user_id="system")

    assert len(results) == 2
    by_employee = {r["employeeId"]: r for r in results}
    assert by_employee["emp1"]["generatedBy"] == "hr_user_alice"
    assert by_employee["emp2"]["generatedBy"] == "hr_user_bob"
    assert "system" not in (by_employee["emp1"]["generatedBy"], by_employee["emp2"]["generatedBy"])

    # Every generation must be logged (audit trail) with its own real user.
    logged_users = {call.args[0]["employeeId"]: call.args[0]["generatedBy"] for call in mock_log.await_args_list}
    assert logged_users == {"emp1": "hr_user_alice", "emp2": "hr_user_bob"}


@pytest.mark.asyncio
async def test_batch_generation_backward_compatible_without_per_employee_userid():
    """
    Existing/older callers that omit `userId` on an employee entry must keep
    working exactly as before (falling back to the batch-level default) —
    the fix must not require every caller to change.
    """
    with patch.object(
        decision_service, "orchestrate_recommendation",
        new=AsyncMock(side_effect=lambda employee_id, employee_doc: _fake_orchestrator_result(employee_id)),
    ), patch.object(decision_service, "_log_decision", new=AsyncMock()):
        employees = [{"employeeId": "emp3", "employeeData": _sample_employee_doc()}]  # no userId key
        results = await decision_service.generate_batch_decisions(employees, user_id="system")

    assert len(results) == 1
    assert results[0]["generatedBy"] == "system"
    for field in REQUIRED_RESPONSE_FIELDS:
        assert field in results[0]


@pytest.mark.asyncio
async def test_batch_generation_isolates_per_employee_failure_and_still_tags_user():
    """
    A failure for one employee must not affect others (existing contract),
    and the error entry itself must still record the correct authenticated
    user — only the *value* of generatedBy changes with this fix, not the
    error-isolation behavior.
    """
    async def flaky_orchestrator(employee_id, employee_doc):
        if employee_id == "emp_bad":
            raise RuntimeError("simulated orchestrator failure")
        return _fake_orchestrator_result(employee_id)

    with patch.object(
        decision_service, "orchestrate_recommendation", new=AsyncMock(side_effect=flaky_orchestrator),
    ), patch.object(decision_service, "_log_decision", new=AsyncMock()):
        employees = [
            {"employeeId": "emp_bad", "employeeData": _sample_employee_doc(), "userId": "hr_user_carol"},
            {"employeeId": "emp_good", "employeeData": _sample_employee_doc(), "userId": "hr_user_carol"},
        ]
        results = await decision_service.generate_batch_decisions(employees, user_id="system")

    by_employee = {r["employeeId"]: r for r in results}
    assert by_employee["emp_bad"].get("error")
    assert by_employee["emp_bad"]["generatedBy"] == "hr_user_carol"
    assert not by_employee["emp_good"].get("error")
    assert by_employee["emp_good"]["generatedBy"] == "hr_user_carol"
