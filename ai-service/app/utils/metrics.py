"""
metrics.py
==========
In-process latency tracking for the AI Service — Sprint 10, Part 4
(Monitoring). Mirrors server/src/middlewares/metrics.js on the Node side:
an in-memory rolling window per pipeline category, not a Prometheus/StatsD
integration — appropriate for a single-instance MVP, documented as tech
debt for a multi-instance deployment.
"""

import time
from collections import deque
from statistics import mean

WINDOW_SIZE = 200

_samples: dict[str, deque] = {}
_totals = {"requests": 0, "errors": 0}

CATEGORY_PREFIXES = {
    "/predict": "prediction",
    "/explain": "shap",
    "/employee-intelligence": "employee_intelligence",
    "/knowledge": "knowledge",
    "/rag": "knowledge",
    "/decision": "decision",
}


def _categorize(path: str) -> str | None:
    for prefix, category in CATEGORY_PREFIXES.items():
        if path.startswith(prefix):
            return category
    return None


def _percentile(values: list[float], p: float) -> float | None:
    if not values:
        return None
    sorted_values = sorted(values)
    index = min(len(sorted_values) - 1, int((p / 100) * len(sorted_values)))
    return round(sorted_values[index], 1)


async def metrics_middleware(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    _totals["requests"] += 1
    if response.status_code >= 500:
        _totals["errors"] += 1

    category = _categorize(request.url.path)
    if category:
        if category not in _samples:
            _samples[category] = deque(maxlen=WINDOW_SIZE)
        _samples[category].append(duration_ms)

    return response


def get_metrics_snapshot() -> dict:
    categories = {}
    for name, values in _samples.items():
        values_list = list(values)
        categories[name] = {
            "sampleCount": len(values_list),
            "avgMs": round(mean(values_list), 1) if values_list else None,
            "p95Ms": _percentile(values_list, 95),
            "maxMs": round(max(values_list), 1) if values_list else None,
        }
    total_requests = _totals["requests"]
    total_errors = _totals["errors"]
    return {
        "totalRequests": total_requests,
        "totalErrors": total_errors,
        "errorRate": round((total_errors / total_requests) * 100, 2) if total_requests else 0,
        "categories": categories,
    }
