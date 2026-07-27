/**
 * @file rateLimits.js
 * @description Express middleware for protecting endpoints from abuse.
 *
 * Why this file exists
 * --------------------
 * High-value endpoints like login and password reset must be defended against
 * brute-force attacks and credential stuffing. Centralising rate-limit
 * configuration ensures consistent tracking and standardized error responses.
 *
 * Security decisions
 * ------------------
 * - `loginRateLimit`: Tracks both IP and email address. This prevents distributed
 *   botnets from brute-forcing a single account, while also preventing a single
 *   IP from sweeping many accounts. Limit is strict (5 per minute).
 * - `refreshRateLimit`: Protects against token-rotation race-condition spam.
 * - `forgotPasswordRateLimit` / `resetPasswordRateLimit`: Very strict limits
 *   (3–5 per hour) to prevent email spamming and token guessing.
 * - `passwordChangeRateLimit`: Keyed by `userId` (when authenticated) to
 *   prevent an attacker with an active session from rapid-firing attempts
 *   at the current password.
 *
 * Implementation note: The default memory store is used for the MVP. In a
 * multi-instance production environment, this should be backed by Redis.
 */

import { rateLimit } from 'express-rate-limit';
import { sendError } from '../utils/response.js';

/**
 * Helper to build standard rate limiters with consistent headers and responses.
 */
function createRateLimit({ windowMs, limit, keyGenerator }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    handler: (request, response) =>
      sendError(
        response,
        429,
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        request.requestId,
      ),
  });
}

export const loginRateLimit = createRateLimit({
  windowMs: 60_000,
  limit: 5,
  keyGenerator: (request) => `${request.ip}:${request.body?.email ?? ''}`,
});

export const refreshRateLimit = createRateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (request) => request.ip,
});

export const forgotPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60_000,
  limit: 3,
  keyGenerator: (request) => `${request.ip}:${request.body?.email ?? ''}`,
});

export const resetPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (request) => `${request.ip}:${request.body?.token ?? ''}`,
});

export const passwordChangeRateLimit = createRateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (request) => request.auth?.userId ?? request.ip,
});
