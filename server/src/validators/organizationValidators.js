/**
 * @file organizationValidators.js
 * @description Zod request-body schema for organization signup.
 *
 * Mirrors authValidators.js's pattern: reuses the shared emailSchema/
 * passwordSchema primitives from common.js so the password policy can
 * never drift between login-adjacent flows.
 */
import { z } from 'zod';
import { emailSchema, passwordSchema } from './common.js';

/** POST /organizations/signup */
export const signupSchema = z
  .object({
    organizationName: z
      .string()
      .trim()
      .min(2, 'Organization name must be at least 2 characters.')
      .max(200, 'Organization name must not exceed 200 characters.'),
    adminName: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters.')
      .max(100, 'Name must not exceed 100 characters.'),
    adminEmail: emailSchema,
    adminPassword: passwordSchema,
  })
  .strict();
