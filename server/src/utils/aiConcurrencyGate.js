/**
 * @file aiConcurrencyGate.js
 * @description Global lock preventing more than one heavy AI batch job
 * (train / explain-batch / decision-batch / employee-intelligence batch)
 * from running against the ai-service at the same time.
 *
 * Why this file exists
 * ---------------------
 * Root cause of a real production outage (verified via Render logs, not
 * guessed): at 11:02 UTC a batch SHAP explanation and a batch recommendation
 * run landed on the ai-service within one second of each other. Both got
 * 502s; the container crashed and Render restarted it. It crashed again
 * ~28 minutes later and stayed down for 5+ hours (zero live instances,
 * confirmed via `render services instances`). Each individual batch job is
 * already chunked/bounded (decisionService.js processes 300 employees per
 * ai-service call), but nothing stopped two bounded jobs from running
 * concurrently and adding their memory footprints together — which is
 * exactly what tipped the container into an OOM kill.
 *
 * This is intentionally a blunt, global lock rather than a queue: queueing
 * a second request behind the first would just hold its HTTP connection
 * open longer, reintroducing the platform-proxy-timeout class of bug this
 * session already fixed once. Rejecting immediately with a clear 429 is a
 * better user experience than either silently queueing or crashing again —
 * the caller finds out in milliseconds, not minutes.
 *
 * Prompt 1, Part 8 — Redis migration
 * ------------------------------------------------------------------------
 * This was originally a plain in-process variable, correct only because
 * exactly one Express instance has ever run (`numInstances: 1`, confirmed
 * in docs/AUDIT_PROMPT0.md). It doesn't survive a restart (a crash mid-job
 * would leave the *next* process's lock unheld even though the ai-service
 * might still be finishing the old request) and wouldn't coordinate at all
 * across multiple instances, which the target Cloud Run architecture may
 * run. Now backed by a Redis key (`SET NX PX` — atomic acquire, TTL-bounded
 * so a crashed holder can't wedge the lock forever) with a token-guarded
 * release (Lua EVAL: only delete if the stored token still matches the
 * caller's own) so one process can never release a lock it doesn't hold —
 * the classic Redlock safe-release pattern, minimal version (single Redis
 * node — Upstash — so the multi-node Redlock consensus algorithm itself
 * isn't needed here).
 *
 * Falls back to the original in-process variable when Redis isn't
 * configured (local dev only — see redisClient.js); that fallback is
 * exactly as correct/incorrect as the code this replaces, so it changes
 * nothing for anyone currently running without Redis.
 *
 * acquireAiSlot/releaseAiSlot are now async — every call site was updated
 * to `await` them (see decisionService.js, explainService.js,
 * employeeIntelligenceService.js, aiService.js).
 */

import { randomUUID } from 'crypto';
import { getRedisClient, isRedisConfigured } from './redisClient.js';
import { logger } from './logger.js';

const LOCK_KEY = 'lock:ai-concurrency-gate';
// Safety ceiling, not the expected hold time: real callers release
// explicitly (or via aiService.js's fixed 3-minute train timer) far sooner.
// This TTL only matters if a process dies mid-job without releasing —
// bounds how long the lock can stay stuck instead of leaving it held
// forever, which is what a plain in-process variable would already have
// "fixed" by dying with the process (a restart cleared it for free). Redis
// persistence removes that free reset, so an explicit ceiling replaces it.
const LOCK_TTL_MS = 15 * 60 * 1000;

// Lua: only delete the key if its value still matches the token we set it
// to — guards against process A's release accidentally clearing process
// B's lock after A's own lock already expired and B legitimately acquired
// it in between.
//
// Bug found and fixed during Prompt 1B's live verification (Part 9): the
// stored value is the JSON payload `{name, startedAt, token}`, not the bare
// token — comparing it directly against ARGV[1] (the bare token
// acquireAiSlot() returns to callers) can never match, so releaseAiSlot()
// silently failed to delete the key every single time (returned 0, no
// error) and every lock sat until its 15-minute TTL expired instead of
// being released on the caller's own `finally`. Live-reproduced: acquire →
// release → immediate re-acquire failed with AI_PIPELINE_BUSY although
// nothing was still running. Fixed by decoding the stored JSON in the
// script itself (cjson, standard in Redis' Lua environment) and comparing
// its `.token` field instead of the raw string.
const RELEASE_SCRIPT = `
local raw = redis.call("get", KEYS[1])
if raw == false then
  return 0
end
local ok, decoded = pcall(cjson.decode, raw)
if not ok or decoded.token ~= ARGV[1] then
  return 0
end
return redis.call("del", KEYS[1])
`;

// In-process fallback, used only when Redis isn't configured.
let memoryLock = null; // { name, token, startedAt } | null

function busyError(name, startedAt) {
  const runningForSec = Math.round((Date.now() - startedAt) / 1000);
  const err = new Error(
    `The AI pipeline is currently busy running "${name}" (started ${runningForSec}s ago). ` +
    `Only one heavy AI batch job can run at a time to avoid overloading the AI service. ` +
    `Please wait for it to finish and try again.`,
  );
  err.statusCode = 429;
  err.code = 'AI_PIPELINE_BUSY';
  return err;
}

/**
 * Claims the single AI-heavy-job slot. Throws a well-formed 429 if another
 * heavy job is already running.
 * @param {string} jobName - human-readable name for the error message/logs.
 * @returns {Promise<string>} a release token — pass it to releaseAiSlot().
 */
export async function acquireAiSlot(jobName) {
  const token = randomUUID();
  const payload = JSON.stringify({ name: jobName, startedAt: Date.now(), token });

  if (isRedisConfigured()) {
    const result = await getRedisClient().set(LOCK_KEY, payload, { px: LOCK_TTL_MS, nx: true });
    if (result === null) {
      const raw = await getRedisClient().get(LOCK_KEY);
      const held = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      throw busyError(held?.name || 'another job', held?.startedAt || Date.now());
    }
    return token;
  }

  if (memoryLock) {
    throw busyError(memoryLock.name, memoryLock.startedAt);
  }
  memoryLock = { name: jobName, startedAt: Date.now(), token };
  return token;
}

/**
 * Releases the slot. Safe to call even if nothing is held, and safe to call
 * with a stale/foreign token — it only ever removes a lock this exact
 * acquireAiSlot() call created.
 * @param {string} [token] - the token returned by the matching acquireAiSlot().
 */
export async function releaseAiSlot(token) {
  if (isRedisConfigured()) {
    if (!token) return; // nothing to safely release without a token.
    try {
      await getRedisClient().eval(RELEASE_SCRIPT, [LOCK_KEY], [token]);
    } catch (err) {
      // Releasing must never throw into a caller's `finally` block — that
      // would mask the real error/result it's wrapping. The TTL is the
      // backstop if this genuinely fails to reach Redis.
      logger.error('ai_concurrency_gate_release_failed', { error: err.message });
    }
    return;
  }
  if (memoryLock && (!token || memoryLock.token === token)) {
    memoryLock = null;
  }
}

/** For the health/status endpoints — what's running right now, if anything. */
export async function getActiveAiJob() {
  if (isRedisConfigured()) {
    const raw = await getRedisClient().get(LOCK_KEY);
    if (!raw) return null;
    const held = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { name: held.name, startedAt: held.startedAt };
  }
  return memoryLock ? { name: memoryLock.name, startedAt: memoryLock.startedAt } : null;
}
