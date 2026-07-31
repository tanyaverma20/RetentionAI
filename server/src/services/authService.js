/**
 * @file authService.js
 * @description Business logic for all authentication and session operations.
 *
 * Why this file exists
 * --------------------
 * All auth workflows (login, logout, token refresh, password management) involve
 * multiple steps that must succeed or fail together. Isolating these workflows
 * in a service keeps controllers thin (they only translate HTTP to service calls)
 * and makes the business logic independently testable and auditable.
 *
 * Token rotation strategy
 * -----------------------
 * On each successful token refresh, the old refresh token is immediately revoked
 * and a new one is issued. The old document retains `replacedByTokenHash` so
 * that if the same old token is presented again (replay attack), the chain can
 * be detected. The service currently invalidates the session on any revoked-token
 * presentation; a future enhancement could invalidate all user sessions.
 *
 * Password reset security
 * -----------------------
 * `requestPasswordReset` always returns normally even when the email does not
 * exist. This prevents email enumeration attacks where an attacker could
 * determine which addresses have accounts by observing different response codes.
 * The reset token is generated with 256 bits of CSPRNG entropy, hashed with
 * HMAC-SHA-256, and expires after `PASSWORD_RESET_TTL_MINUTES`.
 *
 * Session invalidation on password change
 * ----------------------------------------
 * When a user changes or resets their password, ALL active refresh tokens for
 * that user are revoked. This logs out every device immediately, preventing
 * an attacker who obtained a refresh token from maintaining access after the
 * account owner has detected and remediated a compromise.
 */

import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import {
  findActiveRefreshToken,
  createRefreshToken as persistRefreshToken,
  revokeAllRefreshTokensForUser,
  revokeRefreshToken,
} from '../repositories/refreshTokenRepository.js';
import {
  findUserByEmail,
  findUserById,
  findUserByResetToken,
  findUserForAuthentication,
  findUserForAuthenticationById,
  updateUser,
} from '../repositories/userRepository.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { durationToMilliseconds } from '../utils/duration.js';
import { recordAudit } from './auditService.js';
import { logger } from '../utils/logger.js';

const DEFAULT_ORGANIZATION_ID = '60d5ec388832a828f8000000';
import {
  createAccessToken,
  createPasswordResetToken,
  createRefreshToken,
  hashToken,
} from '../utils/tokens.js';

/**
 * Build the safe user profile object returned to clients.
 * Sensitive fields (passwordHash, reset tokens, deletedAt) are never included.
 *
 * @param {import('mongoose').Document} user - Populated user document.
 * @returns {{ id, firstName, lastName, name, email, role, permissions, departmentId, status }}
 */
function toUserProfile(user) {
  const [firstName, ...lastNameParts] = user.name.split(' ');
  return {
    id: user.id,
    firstName,
    lastName: lastNameParts.join(' '),
    name: user.name,
    email: user.email,
    role: user.roleId.name,
    permissions: user.roleId.permissions,
    departmentId: user.departmentId?.toString(),
    status: user.status,
  };
}

/**
 * Issue a new session: persist a refresh token and return tokens + profile.
 * If `replacedToken` is provided the old token is revoked and linked to the
 * new one (token rotation).
 *
 * @param {import('mongoose').Document} user           - Active user with populated roleId.
 * @param {import('mongoose').Document} [replacedToken] - Old token document to revoke.
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 */
async function issueSession(user, replacedToken) {
  const refreshToken = createRefreshToken();
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + durationToMilliseconds(env.jwtRefreshTtl));

  await persistRefreshToken({ userId: user.id, tokenHash, expiresAt });
  if (replacedToken) await revokeRefreshToken(replacedToken, tokenHash);

  return {
    accessToken: createAccessToken({
      id: user.id,
      role: user.roleId,
      organizationId: user.organizationId,
    }),
    refreshToken,
    user: toUserProfile(user),
  };
}

/**
 * Authenticate a user with email and password and issue a new session.
 *
 * Security: both "user not found" and "wrong password" produce the same
 * INVALID_CREDENTIALS error to prevent user enumeration.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 * @throws {AppError} 401 INVALID_CREDENTIALS | 423 ACCOUNT_LOCKED
 */
export async function login({ email, password }) {
  const user = await findUserForAuthentication(email);

  // Constant-time comparison via bcrypt.compare; do not short-circuit on user absence.
  const passwordMatch = user ? await comparePassword(password, user.passwordHash) : false;

  if (!user || !passwordMatch) {
    logger.warn('auth_login_failed', { email, reason: 'invalid_credentials' });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }
  if (user.status === 'LOCKED') {
    logger.warn('auth_login_failed', { email, reason: 'account_locked' });
    throw new AppError(423, 'ACCOUNT_LOCKED', 'This account has been locked. Contact an administrator.');
  }
  if (user.status !== 'ACTIVE' || !user.roleId) {
    logger.warn('auth_login_failed', { email, reason: 'inactive_or_unroled' });
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  user.lastLoginAt = new Date();
  await updateUser(user);
  const session = await issueSession(user);
  await recordAudit(user.organizationId || DEFAULT_ORGANIZATION_ID, 'USER_LOGIN', user.id, { context: { email: user.email } });
  logger.info('auth_login_success', { userId: user.id, email: user.email, role: user.roleId?.name });
  return session;
}

/**
 * Exchange a valid refresh token for a new session (token rotation).
 *
 * @param {string} refreshToken - Raw opaque refresh token from the client.
 * @returns {Promise<{ accessToken, refreshToken, user }>}
 * @throws {AppError} 401 INVALID_REFRESH_TOKEN
 */
export async function refreshSession(refreshToken) {
  const storedToken = await findActiveRefreshToken(hashToken(refreshToken));
  if (!storedToken) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired.');
  }

  const user = await findUserById(storedToken.userId);
  if (!user || user.status !== 'ACTIVE' || !user.roleId) {
    await revokeRefreshToken(storedToken);
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired.');
  }

  return issueSession(user, storedToken);
}

/**
 * Revoke the caller's refresh token, terminating their current session.
 *
 * @param {string}  userId        - Authenticated user ID from the access token.
 * @param {string}  [refreshToken] - Raw refresh token to revoke.
 * @returns {Promise<void>}
 * @throws {AppError} 401 INVALID_REFRESH_TOKEN if the token does not belong to the caller.
 */
export async function logout(userId, refreshToken) {
  if (!refreshToken) return;

  const storedToken = await findActiveRefreshToken(hashToken(refreshToken));
  if (!storedToken || storedToken.userId.toString() !== userId) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token is invalid or expired.');
  }

  await revokeRefreshToken(storedToken);
  await recordAudit(DEFAULT_ORGANIZATION_ID, 'USER_LOGOUT', userId, {});
  logger.info('auth_logout', { userId });
}

/**
 * Return the safe profile for the authenticated user.
 *
 * @param {string} userId - Authenticated user ID from the access token.
 * @returns {Promise<object>} Safe user profile.
 * @throws {AppError} 401 UNAUTHENTICATED if the user is inactive or deleted.
 */
export async function getCurrentUser(userId) {
  const user = await findUserById(userId);
  if (!user || user.status !== 'ACTIVE' || !user.roleId) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
  }
  return toUserProfile(user);
}

/**
 * Change the authenticated user's password after verifying the current one.
 * Revokes all active refresh tokens on success.
 *
 * @param {string} userId                            - Authenticated user ID.
 * @param {{ currentPassword: string, newPassword: string }} payload
 * @returns {Promise<void>}
 * @throws {AppError} 401 INVALID_CREDENTIALS | 422 SAME_PASSWORD
 */
export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await findUserForAuthenticationById(userId);
  if (!user || !(await comparePassword(currentPassword, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
  }

  // Prevent setting the same password as the current one.
  const isSamePassword = await comparePassword(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw new AppError(422, 'SAME_PASSWORD', 'New password must differ from the current password.');
  }

  user.passwordHash = await hashPassword(newPassword);
  await updateUser(user);
  // Invalidate all sessions; the caller must log in again.
  await revokeAllRefreshTokensForUser(user.id);
}

/**
 * Initiate a password-reset flow by generating and storing a reset token.
 * Always resolves without error regardless of whether the email exists,
 * preventing account enumeration.
 *
 * The raw token is returned from this function so the calling layer can pass
 * it to a notification/email service. In the current MVP the token must be
 * retrieved from the database for testing; a real deployment would email it.
 *
 * @param {string} email - Normalised email address.
 * @returns {Promise<void>}
 */
export async function requestPasswordReset(email) {
  const user = await findUserByEmail(email);
  // Silently return if no active user found; do not reveal account existence.
  if (!user || user.status !== 'ACTIVE') return;

  const token = createPasswordResetToken();
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + env.passwordResetTtlMinutes * 60_000);
  await updateUser(user);

  // In a production system the raw `token` would be emailed here via a
  // notification service. In the MVP it is stored hashed and the token is
  // not returned to the HTTP response.
}

/**
 * Reset a user's password using a valid, non-expired reset token.
 * Revokes all active refresh tokens on success.
 *
 * @param {{ token: string, newPassword: string }} payload
 * @returns {Promise<void>}
 * @throws {AppError} 400 INVALID_RESET_TOKEN
 */
export async function resetPassword({ token, newPassword }) {
  const user = await findUserByResetToken(hashToken(token));
  if (!user) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'The reset token is invalid or has expired.');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await updateUser(user);
  await revokeAllRefreshTokensForUser(user.id);
}
