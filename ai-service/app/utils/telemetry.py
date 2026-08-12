import time
import functools
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def estimate_tokens(text: str) -> int:
    """Rough estimation of token count (1 token ~= 4 characters)."""
    if not text:
        return 0
    return max(1, len(text) // 4)

def calculate_token_cost(prompt_tokens: int, completion_tokens: int, model_name: str = "gpt-4o-mini") -> float:
    """Calculate estimated USD cost based on token counts."""
    # Pricing per 1,000 tokens benchmark
    rates = {
        "gpt-4o-mini": {"prompt": 0.00015 / 1000, "completion": 0.0006 / 1000},
        "gpt-4o": {"prompt": 0.0025 / 1000, "completion": 0.010 / 1000},
        "distilbert": {"prompt": 0.0, "completion": 0.0},
        "catboost": {"prompt": 0.0, "completion": 0.0},
    }
    rate = rates.get(model_name, rates["gpt-4o-mini"])
    cost = (prompt_tokens * rate["prompt"]) + (completion_tokens * rate["completion"])
    return round(cost, 6)

def trace_execution(service_name: str):
    """Decorator to measure function latency and log AI telemetry payload."""
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            start_time = time.time()
            error_msg = None
            status = "SUCCESS"
            result = None
            try:
                result = await func(*args, **kwargs)
                return result
            except Exception as e:
                status = "FAILED"
                error_msg = str(e)
                raise e
            finally:
                duration_ms = round((time.time() - start_time) * 1000, 2)
                logger.info({
                    "event": "ai_telemetry_trace",
                    "service": service_name,
                    "duration_ms": duration_ms,
                    "status": status,
                    "error": error_msg
                })
        return async_wrapper
    return decorator
