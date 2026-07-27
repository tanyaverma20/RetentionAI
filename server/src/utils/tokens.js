/**
 * @file tokens.js
 * @description JWT and cryptographic token utilities.
 *
 * Why this file exists
 * --------------------
 * All token creation and verification logic is isolated here so that algorithm
 * choices, secret references, and entropy levels are changed in one place only.
 * Controllers and services never import `jsonwebtoken` or `crypto` directly.
 *
 * Security decisions
 * ------------------
 * - Access tokens use HS256 and carry the subject (`sub`), role name, and
 *   organisation scope. They are short-lived (configurable, default 15 minutes)
 *   so a stolen token is limited in usefulness.
 * - Refresh tokens are 48 bytes of CSPRNG output encoded as base64url —
 *   384 bits of entropy, well above the minimum for an opaque bearer secret.
 * - Password-reset tokens are 32 bytes (256 bits) — more than sufficient for a
 *   time-limited single-use secret.
 * - Token hashes use HMAC-SHA-256 keyed with the refresh secret. This prevents
 *   a database dump from yielding usable refresh or reset tokens.
 * - `verifyAccessToken` explicitly restricts accepted algorithms to ['HS256'] to
 *   prevent the "algorithm confusion" attack (e.g. RS256 / none switching).
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/**
 * Issue a short-lived JWT access token for an authenticated user.
 *
 * Payload fields
 * - `sub`            – MongoDB user ID (string).
 * - `role`           – Role name string for fast RBAC checks in middleware.
 * - `organizationId` – Tenant boundary; undefined for single-org MVP.
 * - `type`           – Literal `'access'`; checked in authenticate middleware
 *                      to prevent refresh tokens from being used as access tokens.
 *
 * @param {{ id: string, role: { name: string }, organizationId?: string }} user
 * @returns {string} Signed JWT.
 */
export function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role.name,
      organizationId: user.organizationId?.toString(),
      type: 'access',
    },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessTtl, algorithm: 'HS256' },
  );
}

/**
 * Generate a cryptographically secure opaque refresh token.
 * The raw value is given to the client; its HMAC hash is stored in the database.
 *
 * @returns {string} 48-byte base64url string (~64 printable characters).
 */
export function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Generate an HMAC-SHA-256 hash of a token value keyed with the refresh secret.
 * Used for both refresh-token storage and password-reset-token storage so that
 * the raw bearer value is never persisted.
 *
 * @param {string} token - Raw token string.
 * @returns {string} Hex-encoded HMAC digest.
 */
export function hashToken(token) {
  return crypto.createHmac('sha256', env.jwtRefreshSecret).update(token).digest('hex');
}

/**
 * Generate a cryptographically secure password-reset token.
 * Single-use; the hash is stored on the User document with an expiry timestamp.
 *
 * @returns {string} 32-byte base64url string (~43 printable characters).
 */
export function createPasswordResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Verify and decode a JWT access token.
 * Throws `JsonWebTokenError` or `TokenExpiredError` on failure; these are
 * caught in the authenticate middleware and converted to AppError instances.
 *
 * Algorithm is explicitly restricted to `['HS256']` to prevent algorithm
 * confusion attacks where an attacker downgrades to `none` or substitutes RS256.
 *
 * @param {string} token - Raw JWT string from the Authorization header.
 * @returns {import('jsonwebtoken').JwtPayload} Decoded payload.
 */
export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret, { algorithms: ['HS256'] });
}
