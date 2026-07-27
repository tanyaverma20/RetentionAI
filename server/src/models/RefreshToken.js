/**
 * @file RefreshToken.js
 * @description Mongoose schema and model for server-side refresh token tracking.
 *
 * Why this file exists
 * --------------------
 * JWTs are stateless by nature — once issued, a server cannot unilaterally
 * invalidate them without checking a revocation list. Refresh tokens are the
 * long-lived credential used to obtain new access tokens, so their lifecycle
 * must be tracked server-side to support:
 *
 *   - Logout (immediate revocation of a specific token).
 *   - Password change (revoke all sessions for the user).
 *   - Token rotation (old token is marked replaced; new token is issued).
 *   - Reuse detection (a revoked token being presented again is a security event).
 *
 * Field decisions
 * ---------------
 * - `tokenHash`           – Only the HMAC-SHA-256 hash of the raw refresh token
 *   is stored. If the database is compromised, the attacker cannot use hashes
 *   directly as bearer tokens.
 * - `select: false`       – Prevents the hash from being included in any query
 *   result unless explicitly requested.
 * - `expiresAt`           – Application-level expiry enforced in queries. The
 *   MongoDB TTL index (`expires: 0`) also automatically deletes documents once
 *   the `expiresAt` date has passed, keeping the collection small.
 * - `revokedAt`           – Set on logout, password change, or rotation. A
 *   missing field means the token is still active.
 * - `replacedByTokenHash` – On token rotation, the old record stores a
 *   reference to the hash of the new token. If the old token is presented
 *   again (replay attack), the chain can be inspected and the session invalidated.
 *
 * Collection hygiene
 * ------------------
 * The TTL index on `expiresAt` removes expired documents automatically.
 * Revoked-but-unexpired tokens remain in the collection until their expiry
 * date, because they need to be detectable for reuse-detection checks.
 */

import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** HMAC-SHA-256 hash of the raw bearer token. Never stored in plaintext. */
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    /** UTC timestamp after which the token is invalid, regardless of revocation state. */
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index; documents auto-delete after this date.
    },
    /** Set on logout, password change, or token rotation. Absent = active. */
    revokedAt: { type: Date },
    /** Hash of the replacement token issued during rotation, for reuse-detection chains. */
    replacedByTokenHash: { type: String },
  },
  { timestamps: true },
);

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
