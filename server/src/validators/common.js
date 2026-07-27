/**
 * @file common.js
 * @description Shared Zod schema primitives reused across all validators.
 *
 * Why this file exists
 * --------------------
 * Validation rules for fundamental types like email addresses, passwords, and
 * MongoDB identifiers must be identical everywhere they appear. Defining them
 * once here and importing them into feature-specific validators ensures that a
 * change to the password policy (e.g. raising the minimum length) takes effect
 * across every endpoint automatically.
 *
 * Password policy (aligned with SRS §19 and SDD §4)
 * ---------------------------------------------------
 * - Minimum 8 characters, maximum 128 characters.
 * - Must contain at least one lowercase letter (a–z).
 * - Must contain at least one uppercase letter (A–Z).
 * - Must contain at least one digit (0–9).
 * - Must contain at least one special character (anything that is not a-z A-Z 0-9).
 *
 * These requirements balance usability (short minimum, generous maximum for
 * passphrases) with resistance to dictionary and brute-force attacks.
 *
 * Email normalisation
 * -------------------
 * Emails are trimmed and lowercased at the schema layer so that the service
 * and database always work with a canonical form. The unique MongoDB index is
 * also on the normalised value, preventing duplicate registrations that differ
 * only in case (e.g. `Asha@Acme.com` vs `asha@acme.com`).
 *
 * ObjectId validation
 * -------------------
 * A 24-character hex string check validates MongoDB ObjectIds without importing
 * Mongoose into validator files, keeping the validation layer dependency-light.
 */

import { z } from 'zod';

/**
 * Validate a MongoDB ObjectId: 24 lowercase or uppercase hex characters.
 * Used for path parameters and reference fields like `roleId`, `departmentId`.
 */
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Provide a valid identifier.');

/**
 * Validate and enforce the full password security policy.
 * Returns the raw string; hashing is done in the service layer with bcrypt.
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must contain at least 8 characters.')
  .max(128, 'Password must contain at most 128 characters.')
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/\d/, 'Password must contain a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character.');

/**
 * Validate, trim, and lowercase an email address.
 * Maximum length 254 characters matches the RFC 5321 SMTP envelope limit.
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Provide a valid email address.')
  .max(254, 'Email must not exceed 254 characters.');

/**
 * Validate pagination parameters.
 */
export const paginationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default("10")
});
