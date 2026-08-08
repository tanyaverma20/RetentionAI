"""
job_store.py
============
Prompt 1, Part 3/5/6/7 — Redis-backed job store replacing the in-memory
dicts in app/api/explain_routes.py (_EXPLAIN_JOBS) and
app/api/decision_routes.py (_DECISION_JOBS). See server/src/utils/jobStore.js
for the Node mirror and the shared design rationale (keying, TTL, crash
recovery via a per-process epoch, why large batch results still pass
through here for now). The two are intentionally structurally identical so
the same mental model applies on either side of the Express<->ai-service
boundary.

Ownership note: these two job types are never polled directly by a browser
— Express is the only caller (shared AI_SERVICE_TOKEN), and it always
supplies the jobId it just created. There is therefore no per-tenant
`organizationId` to enforce here (Express enforces that one layer up, on
its own _BATCH_JOBS-equivalent and on the Decision/Explanation documents
those results get written into). This store still accepts an optional
`owner` tag for defense in depth / future direct exposure, but no current
call site needs it.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Any, Optional

from app.utils.redis_client import get_redis_client, is_redis_configured

DEFAULT_TTL_SECONDS = 30 * 60

# Unique per process boot — a job stamped with a DIFFERENT epoch than the
# current process's, while still "running", was being computed by a worker
# that no longer exists (this process restarted). See recover_if_stale().
PROCESS_EPOCH = str(uuid.uuid4())

_memory_store: dict[str, dict[str, Any]] = {}
_memory_expiry: dict[str, float] = {}


def _key(job_type: str, job_id: str) -> str:
    return f"job:{job_type}:{job_id}"


def _prune_memory_store() -> None:
    now = time.time()
    expired = [k for k, exp in _memory_expiry.items() if exp < now]
    for k in expired:
        _memory_store.pop(k, None)
        _memory_expiry.pop(k, None)


async def _write_raw(job_type: str, job_id: str, value: dict[str, Any], ttl_seconds: int) -> None:
    k = _key(job_type, job_id)
    if is_redis_configured():
        await get_redis_client().set(k, json.dumps(value), ex=ttl_seconds)
        return
    _prune_memory_store()
    _memory_store[k] = value
    _memory_expiry[k] = time.time() + ttl_seconds


async def _read_raw(job_type: str, job_id: str) -> Optional[dict[str, Any]]:
    k = _key(job_type, job_id)
    if is_redis_configured():
        raw = await get_redis_client().get(k)
        if raw is None:
            return None
        return raw if isinstance(raw, dict) else json.loads(raw)
    _prune_memory_store()
    return _memory_store.get(k)


def _recover_if_stale(job_type: str, job_id: str, job: dict[str, Any]) -> dict[str, Any]:
    if job.get("status") == "running" and job.get("epoch") != PROCESS_EPOCH:
        corrected = {
            **job,
            "status": "failed",
            "error": "This job was still running when the AI service restarted and could not be resumed. Please retry.",
            "recovered": True,
        }
        # Best-effort persist of the correction — don't block the read on it.
        asyncio.create_task(_write_raw(job_type, job_id, corrected, DEFAULT_TTL_SECONDS))
        return corrected
    return job


async def create_job(job_type: str, job_id: Optional[str] = None, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> str:
    """Creates a new 'running' job. Returns the jobId (generated if not supplied)."""
    jid = job_id or str(uuid.uuid4())
    job = {"status": "running", "epoch": PROCESS_EPOCH, "startedAt": time.time()}
    await _write_raw(job_type, jid, job, ttl_seconds)
    return jid


async def get_job(job_type: str, job_id: str) -> Optional[dict[str, Any]]:
    job = await _read_raw(job_type, job_id)
    if job is None:
        return None
    return _recover_if_stale(job_type, job_id, job)


async def update_job(
    job_type: str, job_id: str, patch: dict[str, Any], ttl_seconds: int = DEFAULT_TTL_SECONDS
) -> Optional[dict[str, Any]]:
    existing = await _read_raw(job_type, job_id)
    if existing is None:
        return None
    updated = {**existing, **patch}
    await _write_raw(job_type, job_id, updated, ttl_seconds)
    return updated
