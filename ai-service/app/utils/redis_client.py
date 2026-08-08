"""
redis_client.py
================
Prompt 1, Part 3/4/17 — Python mirror of server/src/utils/redisClient.js.

Same Upstash REST client family (`upstash-redis`'s async `Redis`), same
UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN env vars, same contract:
isRedisConfigured()-style check before use, a clear typed error if a caller
skips that check, never logs the token.

Why the async client specifically: this service is FastAPI/async end to end
(motor for Mongo, asyncio.to_thread for CPU-bound SHAP work) — a blocking
Redis call here would stall the event loop for every other in-flight
request, exactly the class of bug app/main.py's lifespan already works
around for the NLP/vectorstore startup chains.
"""

from __future__ import annotations

import logging
from typing import Optional

from upstash_redis.asyncio import Redis

from app.config import Settings

logger = logging.getLogger("retentionai.redis")

_client: Optional[Redis] = None
_configured = False
_warned = False


def _settings() -> Settings:
    return Settings()


def _ensure_initialised() -> None:
    global _client, _configured, _warned
    if _client is not None or _warned:
        return
    settings = _settings()
    if settings.upstash_redis_rest_url and settings.upstash_redis_rest_token:
        _client = Redis(url=settings.upstash_redis_rest_url, token=settings.upstash_redis_rest_token)
        _configured = True
    else:
        _warned = True
        logger.warning(
            "UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not set. Job state "
            "(_EXPLAIN_JOBS/_DECISION_JOBS) will run in this process's memory only: it will "
            "NOT survive a restart and will NOT be shared across instances. Acceptable for "
            "local development; required in production."
        )


def is_redis_configured() -> bool:
    _ensure_initialised()
    return _configured


def get_redis_client() -> Redis:
    _ensure_initialised()
    if _client is None:
        raise RuntimeError(
            "Redis is not configured (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set)."
        )
    return _client
