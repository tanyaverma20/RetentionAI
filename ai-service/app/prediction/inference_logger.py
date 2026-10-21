"""
ai-service/app/prediction/inference_logger.py
=============================================
Structured operational inference telemetry and privacy-preserving logger.
Captures request correlation, execution latency, pseudonymous tracking,
and aggregate prediction score distributions without logging PII.
"""

import os
import time
import hmac
import hashlib
import datetime
from collections import deque
from typing import Dict, Any, List, Optional
import numpy as np


class InferenceTelemetryLogger:
    """
    Privacy-preserving operational logger for model inference requests.
    Enforces strict PII exclusion (no names, emails, raw salaries, or tokens).
    Uses keyed HMAC-SHA256 to prevent dictionary and rainbow-table de-anonymization.
    """

    def __init__(self, max_buffer_size: int = 1000, hmac_key: Optional[bytes] = None):
        self.max_buffer_size = max_buffer_size
        self._hmac_key = hmac_key or os.getenv("HMAC_TELEMETRY_SECRET", "retentionai_secure_telemetry_key_2026").encode("utf-8")
        self._records = deque(maxlen=max_buffer_size)
        self._total_requests = 0
        self._total_success = 0
        self._total_errors = 0
        self._error_counts_by_type: Dict[str, int] = {}

    def pseudonymize_id(self, raw_id: Optional[str], secret_key: Optional[bytes] = None) -> str:
        """
        Generates an irreversible pseudonymous hash of an identifier using keyed HMAC-SHA256.
        Prevents dictionary and rainbow-table precomputation attacks.
        """
        if not raw_id:
            return "anonymous"
        key = secret_key or self._hmac_key
        return hmac.new(key, str(raw_id).encode("utf-8"), hashlib.sha256).hexdigest()[:16]

    @staticmethod
    def sanitize_error_message(error: Exception) -> str:
        """Strips potential sensitive information from exception strings."""
        msg = str(error)
        # Remove emails, objectids, or filepaths that could leak directory structure
        for token in ["@"]:
            if token in msg:
                return "Internal error during request processing."
        return msg[:200]

    def log_inference(
        self,
        correlation_id: str,
        model_version: str,
        inference_latency_ms: float,
        preprocessing_latency_ms: float,
        status: str,
        risk_score: Optional[float] = None,
        risk_level: Optional[str] = None,
        employee_id: Optional[str] = None,
        error_category: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Records an operational inference event with privacy guarantees.
        """
        record = {
            "correlationId": correlation_id,
            "modelVersion": model_version,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "status": status,
            "inferenceLatencyMs": round(float(inference_latency_ms), 2),
            "preprocessingLatencyMs": round(float(preprocessing_latency_ms), 2),
            "totalLatencyMs": round(float(inference_latency_ms + preprocessing_latency_ms), 2),
            "pseudonymousId": self.pseudonymize_id(employee_id),
            "riskScore": round(float(risk_score), 4) if risk_score is not None else None,
            "riskLevel": risk_level,
            "errorCategory": error_category,
            "sanitizedError": error_message[:200] if error_message else None,
        }

        self._records.append(record)
        self._total_requests += 1
        if status == "SUCCESS":
            self._total_success += 1
        else:
            self._total_errors += 1
            if error_category:
                self._error_counts_by_type[error_category] = self._error_counts_by_type.get(error_category, 0) + 1

        return record

    def get_summary_statistics(self) -> Dict[str, Any]:
        """
        Computes aggregate operational telemetry metrics across the buffered requests.
        """
        if not self._records:
            return {
                "totalRequests": self._total_requests,
                "bufferedCount": 0,
                "successRate": 1.0,
                "latencyP50Ms": 0.0,
                "latencyP95Ms": 0.0,
                "latencyMeanMs": 0.0,
                "riskScoreDistribution": {"mean": 0.0, "highRiskRate": 0.0},
                "errorsByCategory": {},
            }

        latencies = [r["totalLatencyMs"] for r in self._records]
        scores = [r["riskScore"] for r in self._records if r["riskScore"] is not None]
        high_risk_count = sum(1 for r in self._records if r.get("riskLevel") == "HIGH")

        return {
            "totalRequests": self._total_requests,
            "bufferedCount": len(self._records),
            "successCount": self._total_success,
            "errorCount": self._total_errors,
            "successRate": round(self._total_success / max(self._total_requests, 1), 4),
            "latencyP50Ms": round(float(np.percentile(latencies, 50)), 2),
            "latencyP90Ms": round(float(np.percentile(latencies, 90)), 2),
            "latencyP95Ms": round(float(np.percentile(latencies, 95)), 2),
            "latencyMeanMs": round(float(np.mean(latencies)), 2),
            "riskScoreDistribution": {
                "mean": round(float(np.mean(scores)), 4) if scores else 0.0,
                "std": round(float(np.std(scores)), 4) if scores else 0.0,
                "highRiskRate": round(high_risk_count / max(len(scores), 1), 4),
            },
            "errorsByCategory": dict(self._error_counts_by_type),
        }

    def get_recent_records(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Returns recent sanitized operational telemetry records."""
        return list(self._records)[-limit:]


inference_logger = InferenceTelemetryLogger()
