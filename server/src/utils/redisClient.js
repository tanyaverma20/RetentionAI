/**
 * @file redisClient.js
 * @description Prompt 1, Part 3/4/17 — single Redis abstraction for the
 * whole server. Backs persistent job state (jobStore.js) and the
 * distributed AI concurrency lock (aiConcurrencyGate.js).
 *
 * Why Upstash's REST client (@upstash/redis) and not a TCP client
 * (ioredis/node-redis)
 * -------------------------------------------------------------------------
 * The credentials this project has are UPSTASH_REDIS_REST_URL/
 * UPSTASH_REDIS_REST_TOKEN — an HTTPS REST endpoint + bearer token, not a
 * `redis://` connection string. That is Upstash's serverless-friendly
 * transport: no long-lived TCP socket to manage, works over plain HTTPS
 * (nothing extra to allow through Render's network), and each call is a
 * single stateless fetch — a good fit for a request-scoped Node process
 * that would otherwise need to manage a persistent Redis connection pool
 * itself. A TCP client would need a different credential shape entirely
 * (host/port/password), which is not what was provided.
 *
 * Fail-clearly-at-startup semantics (Part 4/22)
 * -------------------------------------------------------------------------
 * config/env.js already refuses to boot if exactly one of the two env vars
 * is set (ambiguous/typo'd config). If BOTH are unset, that is a valid,
 * intentional state for local development — see the in-memory fallback
 * this module does NOT itself provide (that lives in jobStore.js /
 * aiConcurrencyGate.js, which check isRedisConfigured() and degrade
 * loudly, never silently). This module's own contract is narrow:
 * getRedisClient() throws a clear, typed error if called while
 * unconfigured, so any call site that skips the isRedisConfigured() guard
 * fails fast instead of hitting `undefined.get is not a function`.
 *
 * Never logs the token. isRedisConfigured()/health output expose only a
 * boolean and the REST host (URL, no token) — see getRedisDiagnostics().
 */

import { Redis } from '@upstash/redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let client = null;

if (env.redis.configured) {
  client = new Redis({ url: env.redis.url, token: env.redis.token });
} else {
  // Loud, not silent: Part 17 explicitly forbids quietly falling back to
  // unsafe in-memory state for operations that require persistence. This
  // warning is the one-time, startup-time disclosure of that fallback;
  // jobStore.js/aiConcurrencyGate.js still tag every degraded response so
  // it's visible per-request too, not just once in the boot log.
  logger.warn('redis_not_configured', {
    message:
      'UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are not set. Job state and the AI ' +
      'concurrency lock will run in this process\'s memory only: they will NOT survive a ' +
      'restart and will NOT be shared across instances. Acceptable for local development; ' +
      'required in production.',
  });
}

/** True if a real Upstash Redis client is available. */
export function isRedisConfigured() {
  return client !== null;
}

/**
 * @returns {import('@upstash/redis').Redis}
 * @throws if Redis is not configured — callers must check isRedisConfigured()
 * first if they have a legitimate fallback path; this throw is the guard
 * for callers that don't.
 */
export function getRedisClient() {
  if (!client) {
    const err = new Error(
      'Redis is not configured (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set).',
    );
    err.code = 'REDIS_NOT_CONFIGURED';
    throw err;
  }
  return client;
}

/** Safe-to-expose status for health endpoints — never the token, never the full URL query string. */
export function getRedisDiagnostics() {
  return {
    configured: isRedisConfigured(),
    // Host only (no path/token) — REST URLs carry no secret in the path,
    // but strip to the origin anyway so a future URL shape change can't
    // accidentally leak something through a health endpoint (Part 16).
    host: env.redis.url ? safeHost(env.redis.url) : null,
  };
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
