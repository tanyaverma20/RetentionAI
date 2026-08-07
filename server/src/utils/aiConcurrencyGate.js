/**
 * @file aiConcurrencyGate.js
 * @description Global in-process lock preventing more than one heavy AI
 * batch job (train / explain-batch / decision-batch / employee-intelligence
 * batch) from running against the ai-service at the same time.
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
 * Scope: process-global, not per-organization. Correct for now, since this
 * app is still single-tenant in practice (see docs/PLATFORM_BLUEPRINT.md
 * Part 1/2) and — more importantly — there is only ONE ai-service instance
 * with one shared memory budget regardless of which tenant is asking, so a
 * per-tenant lock wouldn't actually prevent the crash. Revisit only if the
 * ai-service itself is scaled to isolate tenants.
 */

let activeJob = null; // { name: string, startedAt: number } | null

/**
 * Claims the single AI-heavy-job slot. Throws a well-formed 429 if another
 * heavy job is already running.
 * @param {string} jobName - human-readable name for the error message/logs.
 */
export function acquireAiSlot(jobName) {
  if (activeJob) {
    const runningForSec = Math.round((Date.now() - activeJob.startedAt) / 1000);
    const err = new Error(
      `The AI pipeline is currently busy running "${activeJob.name}" (started ${runningForSec}s ago). ` +
      `Only one heavy AI batch job can run at a time to avoid overloading the AI service. ` +
      `Please wait for it to finish and try again.`,
    );
    err.statusCode = 429;
    err.code = 'AI_PIPELINE_BUSY';
    throw err;
  }
  activeJob = { name: jobName, startedAt: Date.now() };
}

/** Releases the slot. Safe to call even if nothing is held. */
export function releaseAiSlot() {
  activeJob = null;
}

/** For the health/status endpoints — what's running right now, if anything. */
export function getActiveAiJob() {
  return activeJob ? { ...activeJob } : null;
}
