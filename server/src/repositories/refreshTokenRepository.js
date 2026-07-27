/**
 * @file refreshTokenRepository.js
 * @description Data-access functions for the RefreshToken collection.
 *
 * Why this file exists
 * --------------------
 * Refresh-token lifecycle operations (create, find active, revoke, revoke-all)
 * are centralised here. The authService orchestrates these operations but never
 * writes Mongoose queries directly, keeping the data layer swappable and the
 * business logic layer testable.
 *
 * Security notes
 * --------------
 * - `findActiveRefreshToken` checks both `revokedAt` absence and `expiresAt`
 *   in the future. Both conditions must hold; relying on the TTL index alone
 *   would create a race window where a just-expired document is still present.
 * - `revokeRefreshToken` writes `revokedAt` and optionally `replacedByTokenHash`
 *   on the existing document rather than deleting it. This preserves the reuse-
 *   detection chain for token-rotation replay attack detection.
 * - `revokeAllRefreshTokensForUser` is called on password change and account
 *   lock to immediately invalidate every active session for a user.
 */

import { RefreshToken } from '../models/RefreshToken.js';

/**
 * Persist a new refresh token record.
 * The `tokenHash` field must already be the HMAC digest — never the raw token.
 *
 * @param {{ userId: string, tokenHash: string, expiresAt: Date }} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function createRefreshToken(data) {
  return RefreshToken.create(data);
}

/**
 * Find a non-revoked, non-expired refresh token by its HMAC hash.
 * Returns `null` if the token has been revoked, expired, or never existed.
 *
 * Note: `tokenHash` has `select: false` in the schema. The query uses it as a
 * filter field (which is valid), but the returned document will not include it
 * unless `.select('+tokenHash')` is added — intentionally omitted here because
 * the service only needs `userId` and `_id` from the returned document.
 *
 * @param {string} tokenHash - HMAC-SHA-256 hash of the raw refresh token.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findActiveRefreshToken(tokenHash) {
  return RefreshToken.findOne({
    tokenHash,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
}

/**
 * Mark a refresh token as revoked and optionally record the replacement hash.
 *
 * @param {import('mongoose').Document} token            - Active token document from `findActiveRefreshToken`.
 * @param {string}                      [replacementHash] - Hash of the new token (rotation only).
 * @returns {Promise<import('mongoose').Document>}
 */
export function revokeRefreshToken(token, replacementHash) {
  token.revokedAt = new Date();
  if (replacementHash) token.replacedByTokenHash = replacementHash;
  return token.save();
}

/**
 * Revoke all active refresh tokens for a user in a single write operation.
 * Called on password change and administrative account lock so that all
 * existing sessions are immediately invalidated.
 *
 * @param {string} userId - MongoDB ObjectId string of the user.
 * @returns {Promise<import('mongoose').UpdateWriteOpResult>}
 */
export function revokeAllRefreshTokensForUser(userId) {
  return RefreshToken.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}
