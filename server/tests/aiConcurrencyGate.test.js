import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Prompt 1B, Part 9 — regression test for a real bug found during live
 * verification: releaseAiSlot() silently failed to release a Redis-backed
 * lock every single time (the release Lua script compared the FULL stored
 * JSON payload against the bare token acquireAiSlot() hands back, which can
 * never match), so every lock sat stuck until its 15-minute TTL expired
 * instead of being freed on the caller's own `finally`. This only
 * reproduces against real Redis — the in-memory fallback path used a plain
 * `===` check on the token field directly and was never affected — so this
 * test requires live UPSTASH_REDIS_REST_URL/TOKEN and skips cleanly
 * without them (e.g. in an environment with no Upstash credentials).
 */
test('aiConcurrencyGate: acquire, release, and re-acquire actually round-trips through Redis', async (t) => {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    t.skip('UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set — this test only exercises the Redis-backed path.');
    return;
  }

  const { acquireAiSlot, releaseAiSlot, getActiveAiJob } = await import('../src/utils/aiConcurrencyGate.js');
  const { getRedisClient } = await import('../src/utils/redisClient.js');

  // Clean slate — a prior failed run (or this exact bug) could have left a stale lock.
  await getRedisClient().del('lock:ai-concurrency-gate');

  const token = await acquireAiSlot('regression-test-job');
  assert.ok(token, 'acquireAiSlot must return a release token');

  await assert.rejects(
    () => acquireAiSlot('should-be-blocked'),
    (err) => err.statusCode === 429 && err.code === 'AI_PIPELINE_BUSY',
    'a second acquisition while the first is held must be rejected with 429 AI_PIPELINE_BUSY',
  );

  await releaseAiSlot(token);
  const afterRelease = await getActiveAiJob();
  assert.equal(afterRelease, null, 'the lock must actually be gone after releaseAiSlot() — this is the exact bug that was found and fixed');

  // A wrong/foreign token must never release someone else's lock (safe-release guard).
  const token2 = await acquireAiSlot('second-holder');
  await releaseAiSlot('not-the-real-token');
  const stillHeld = await getActiveAiJob();
  assert.equal(stillHeld?.name, 'second-holder', 'releasing with the wrong token must not clear a lock it does not own');

  await releaseAiSlot(token2);
  const finalState = await getActiveAiJob();
  assert.equal(finalState, null, 'cleanup must leave no lock behind');
});
