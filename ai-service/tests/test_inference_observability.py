"""
tests/test_inference_observability.py
=====================================
Tests privacy-preserving inference telemetry:
1. PII exclusion: No employee names, raw salaries, email addresses, or tokens logged.
2. Pseudonymous ID hashing: Raw employee ID is transformed via irreversible SHA-256 salt.
3. Latency measurement: Preprocessing, inference, and total latency recorded > 0ms.
4. Operational summary metrics: P50, P90, P95 percentiles, error rates, score distribution.
5. Error sanitization: Prevents sensitive path or internal leaks in error messages.
"""

import pytest
from app.prediction.inference_logger import InferenceTelemetryLogger


def test_pii_strictly_excluded_from_telemetry():
    """
    Ensure telemetry logs never contain PII keys (name, email, salary, token).
    """
    logger = InferenceTelemetryLogger(max_buffer_size=50)

    record = logger.log_inference(
        correlation_id="corr-test-123",
        model_version="1.0.0",
        inference_latency_ms=12.4,
        preprocessing_latency_ms=3.1,
        status="SUCCESS",
        risk_score=0.45,
        risk_level="MEDIUM",
        employee_id="emp_998822",
    )

    # Check the created record
    assert "name" not in record
    assert "email" not in record
    assert "salary" not in record
    assert "token" not in record

    # Check that raw employee_id is NOT stored, only pseudonymousId
    assert "emp_998822" not in str(record)
    assert record["pseudonymousId"] != "emp_998822"
    assert len(record["pseudonymousId"]) == 16


def test_pseudonymize_id_deterministic_and_salted():
    logger = InferenceTelemetryLogger()
    hash1 = logger.pseudonymize_id("emp_12345")
    hash2 = logger.pseudonymize_id("emp_12345")
    hash3 = logger.pseudonymize_id("emp_67890")

    assert hash1 == hash2
    assert hash1 != hash3
    assert "12345" not in hash1


def test_pseudonymize_id_keyed_hmac_protection():
    """
    Verify that keyed HMAC produces completely different hashes under different keys,
    preventing offline dictionary / rainbow table reversal.
    """
    logger_key1 = InferenceTelemetryLogger(hmac_key=b"secret_key_org_alpha")
    logger_key2 = InferenceTelemetryLogger(hmac_key=b"secret_key_org_beta")

    hash_org1 = logger_key1.pseudonymize_id("emp_common_id")
    hash_org2 = logger_key2.pseudonymize_id("emp_common_id")

    assert hash_org1 != hash_org2
    assert len(hash_org1) == 16
    assert len(hash_org2) == 16


def test_latency_percentiles_calculation():
    logger = InferenceTelemetryLogger(max_buffer_size=100)

    # Simulate 100 inference calls with varying latencies
    for i in range(1, 101):
        logger.log_inference(
            correlation_id=f"req-{i}",
            model_version="1.0.0",
            inference_latency_ms=float(i),
            preprocessing_latency_ms=2.0,
            status="SUCCESS",
            risk_score=float(i) / 100.0,
            risk_level="HIGH" if i > 70 else "LOW",
        )

    summary = logger.get_summary_statistics()

    assert summary["totalRequests"] == 100
    assert summary["bufferedCount"] == 100
    assert summary["successRate"] == 1.0
    assert summary["latencyP50Ms"] > 0
    assert summary["latencyP90Ms"] > summary["latencyP50Ms"]
    assert summary["latencyP95Ms"] >= summary["latencyP90Ms"]
    assert summary["riskScoreDistribution"]["highRiskRate"] == 0.30


def test_sanitized_error_handling():
    logger = InferenceTelemetryLogger()

    # If an exception contains an email or sensitive path
    sensitive_err = ValueError("Failed connection to user@corp-confidential.internal on /var/secrets")
    sanitized = logger.sanitize_error_message(sensitive_err)

    assert "@" not in sanitized
    assert "Internal error" in sanitized

    # Log an error record
    err_record = logger.log_inference(
        correlation_id="corr-err-1",
        model_version="1.0.0",
        inference_latency_ms=1.5,
        preprocessing_latency_ms=0.5,
        status="ERROR",
        error_category="DATA_VALIDATION_ERROR",
        error_message=sanitized,
    )

    assert err_record["status"] == "ERROR"
    assert err_record["errorCategory"] == "DATA_VALIDATION_ERROR"
    assert "@" not in err_record["sanitizedError"]

    stats = logger.get_summary_statistics()
    assert stats["errorCount"] == 1
    assert stats["errorsByCategory"]["DATA_VALIDATION_ERROR"] == 1
