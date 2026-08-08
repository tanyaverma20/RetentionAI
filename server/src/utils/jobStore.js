/**
 * @file jobStore.js
 * @description Prompt 1, Part 3/5/6/7/14 — generic Redis-backed job
 * abstraction replacing the in-memory `Map`-based job stores that
 * disappeared on every restart/redeploy (the actual production problem this
 * phase exists to fix).
 *
 * Design
 * ------
 * - Keyed `job:{type}:{jobId}` — `type` namespaces the four call sites that
 *   previously had their own ad-hoc Map (decisionService.js's _BATCH_JOBS,
 *   the ai-service's _EXPLAIN_JOBS/_DECISION_JOBS — this file is the Node
 *   side; app/core/job_store.py is its Python mirror for those two).
 * - Every job carries `organizationId`. getJob() enforces ownership when
 *   called with one (Part 14): a mismatch returns null, identical to "not
 *   found" — confirming *that a job ID exists but belongs to someone else*
 *   is itself a cross-tenant information leak, so this never distinguishes
 *   403 from 404 to the caller.
 * - Crash/restart recovery (Part 6) via a per-process "epoch": each boot of
 *   this process gets a random id. A job is stamped with the epoch of the
 *   process that created it. If a read finds status "running" tagged with a
 *   DIFFERENT epoch than the current process's, the worker that was
 *   computing it is provably gone (this process restarted) — the job is
 *   corrected to "failed" with a clear message instead of being left
 *   "running" forever or silently reported as complete.
 * - TTL on every write (Part 5) so nothing accumulates unbounded — same
 *   30-minute default the old in-memory stores used.
 * - Local-dev fallback: when Redis isn't configured (env.redis.configured
 *   is false — see redisClient.js), this degrades to an in-process Map with
 *   the same TTL behavior. That fallback is intentionally NOT used in
 *   production: config/env.js's production checks plus this session's
 *   Prompt 1 report both call out that Upstash credentials are required
 *   there. Development is allowed to run without Redis so a fresh clone
 *   still boots.
 * - Large results (Part 5 — "do not store unnecessarily large AI results
 *   directly in Redis"): this store still holds the ai-service's batch
 *   result once per job (same as the in-memory version it replaces), scoped
 *   by a short TTL, because it is the only handoff channel between the two
 *   services for that data today. See docs/AUDIT_PROMPT0.md and the Prompt
 *   1 final report's "Remaining Risks" for why explain-batch (unlike
 *   decision-batch, already chunked to 300) is the one job type where this
 *   could matter at full workforce scale, and why fixing that is deferred.
 */

import { randomUUID } from 'crypto';
import { getRedisClient, isRedisConfigured } from './redisClient.js';

const DEFAULT_TTL_SECONDS = 30 * 60;

// Unique per process boot. Used to detect "this running job's process is
// gone" on read — see the module docstring.
export const PROCESS_EPOCH = randomUUID();

const memoryStore = new Map(); // dev-only fallback; see module docstring.
const memoryTimers = new Map();

function redisKey(type, jobId) {
  return `job:${type}:${jobId}`;
}

async function writeRaw(type, jobId, value, ttlSeconds) {
  const k = redisKey(type, jobId);
  if (isRedisConfigured()) {
    await getRedisClient().set(k, value, { ex: ttlSeconds });
    return;
  }
  memoryStore.set(k, value);
  clearTimeout(memoryTimers.get(k));
  const timer = setTimeout(() => memoryStore.delete(k), ttlSeconds * 1000);
  timer.unref?.();
  memoryTimers.set(k, timer);
}

/** @returns {true} if this call created the key, {false} if it already existed (SETNX semantics — Part 7 idempotency). */
async function writeIfAbsent(type, jobId, value, ttlSeconds) {
  const k = redisKey(type, jobId);
  if (isRedisConfigured()) {
    const result = await getRedisClient().set(k, value, { ex: ttlSeconds, nx: true });
    return result !== null;
  }
  if (memoryStore.has(k)) return false;
  memoryStore.set(k, value);
  const timer = setTimeout(() => memoryStore.delete(k), ttlSeconds * 1000);
  timer.unref?.();
  memoryTimers.set(k, timer);
  return true;
}

async function readRaw(type, jobId) {
  const k = redisKey(type, jobId);
  if (isRedisConfigured()) {
    const value = await getRedisClient().get(k);
    return value ?? null;
  }
  return memoryStore.get(k) ?? null;
}

/** Part 6 — corrects a job left "running" by a process that no longer exists. Best-effort persists the correction. */
function recoverIfStale(type, jobId, job) {
  if (job.status === 'running' && job.epoch !== PROCESS_EPOCH) {
    const corrected = {
      ...job,
      status: 'failed',
      error: 'This job was still running when the server restarted and could not be resumed. Please retry.',
      recovered: true,
      updatedAt: new Date().toISOString(),
    };
    writeRaw(type, jobId, corrected, DEFAULT_TTL_SECONDS).catch(() => {});
    return corrected;
  }
  return job;
}

/**
 * Creates a new job with a random ID.
 * @param {string} type - namespace, e.g. 'decision-batch'.
 * @param {object} opts
 * @param {string|null} opts.organizationId - the AUTHENTICATED caller's org
 *   (req.auth.organizationId) — never a client-supplied value (Part 10).
 * @param {number} [opts.ttlSeconds]
 * @returns {Promise<string>} jobId
 */
export async function createJob(type, { organizationId, ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const jobId = randomUUID();
  const now = new Date().toISOString();
  const job = {
    status: 'running',
    organizationId: organizationId ?? null,
    epoch: PROCESS_EPOCH,
    createdAt: now,
    updatedAt: now,
  };
  await writeRaw(type, jobId, job, ttlSeconds);
  return jobId;
}

/**
 * Creates a job under a CALLER-SUPPLIED id only if one doesn't already
 * exist — Part 7's idempotency-key mechanism. Use when the same logical
 * operation (e.g. "batch decisions for org X's ACTIVE employees") must not
 * be started twice concurrently; derive `jobId` deterministically from the
 * operation's own parameters at the call site.
 * @returns {Promise<{jobId: string, created: boolean}>} created=false means
 *   an equivalent job is already in flight (or recently finished) — the
 *   caller should return the existing jobId rather than starting new work.
 */
export async function createJobIdempotent(type, jobId, { organizationId, ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const now = new Date().toISOString();
  const job = {
    status: 'running',
    organizationId: organizationId ?? null,
    epoch: PROCESS_EPOCH,
    createdAt: now,
    updatedAt: now,
  };
  const created = await writeIfAbsent(type, jobId, job, ttlSeconds);
  return { jobId, created };
}

/**
 * @param {object} [opts]
 * @param {string} [opts.organizationId] - if given, enforces ownership;
 *   a mismatch returns null (indistinguishable from "not found" — Part 14).
 */
export async function getJob(type, jobId, { organizationId } = {}) {
  const job = await readRaw(type, jobId);
  if (!job) return null;
  if (organizationId && job.organizationId && String(job.organizationId) !== String(organizationId)) {
    return null;
  }
  return recoverIfStale(type, jobId, job);
}

/** Merges `patch` into the existing job and refreshes updatedAt/TTL. No-op (returns null) if the job doesn't exist (e.g. it already expired). */
export async function updateJob(type, jobId, patch, { ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  const existing = await readRaw(type, jobId);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await writeRaw(type, jobId, updated, ttlSeconds);
  return updated;
}
