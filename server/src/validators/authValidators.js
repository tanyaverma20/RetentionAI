/**
 * @file authValidators.js
 * @description Zod request-body schemas for all authentication endpoints.
 *
 * Why this file exists
 * --------------------
 * Request validation is separated from business logic so that the validate
 * middleware can reject structurally invalid or policy-violating input before
 * any service code executes. This prevents database round-trips for clearly
 * invalid requests and makes each schema independently testable.
 *
 * All schemas use `.strict()` where appropriate to reject unknown fields —
 * a defence against mass-assignment attacks where a client sends unexpected
 * properties hoping they will be persisted.
 *
 * Schema inventory
 * ----------------
 * loginSchema         – POST /auth/login
 * logoutSchema        – POST /auth/logout
 * refreshSchema       – POST /auth/refresh
 * forgotPasswordSchema – POST /auth/forgot-password
 * resetPasswordSchema  – POST /auth/reset-password
 * changePasswordSchema – POST /auth/change-password
 */

import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

/**
 * POST /auth/login
 * Email and a plaintext password. The password minimum (8) is intentionally
 * lower than the creation policy to accommodate legacy accounts that predate
 * the current policy, and to produce a helpful credential-invalid response
 * rather than a schema error.
 */
export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required.').max(128),
  })
  .strict();

/**
 * POST /auth/logout
 * The refresh token is optional: if absent, only the server-side session for
 * the access-token bearer is recorded; if present, the specific refresh token
 * is revoked. Accepting the body without the field prevents a 400 error when
 * a client logs out after a refresh token has already been revoked.
 */
export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1).max(512).optional(),
  })
  .strict();

/**
 * POST /auth/refresh
 * The refresh token string sent from the client's secure storage.
 * Must match an active, non-expired, non-revoked record in the database.
 */
export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, 'Refresh token is required.').max(512),
  })
  .strict();

/**
 * POST /auth/forgot-password
 * Only an email is required. The response is always generic (202) so that
 * the endpoint cannot be used to enumerate which email addresses have accounts.
 */
export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

/**
 * POST /auth/reset-password
 * The one-time reset token from the email link plus the new password that
 * meets the full policy. The token is validated against its hash + expiry.
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required.').max(512),
    newPassword: passwordSchema,
  })
  .strict();

/**
 * POST /auth/change-password
 * The caller must supply their current password to prove possession before
 * setting a new one. Both passwords are validated; same-value detection is
 * handled in the service layer after bcrypt comparison to avoid leaking
 * information about the current hash via schema-level rejection.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required.')
      .max(128),
    newPassword: passwordSchema,
  })
  .strict();
