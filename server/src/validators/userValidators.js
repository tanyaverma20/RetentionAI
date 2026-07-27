/**
 * @file userValidators.js
 * @description Zod request-body schemas for user-management endpoints.
 *
 * Why this file exists
 * --------------------
 * User management (creation, updates, role assignment, deactivation) is
 * restricted to System Administrators. All input is validated before it
 * reaches the service layer, preventing bad data from entering the database
 * and providing actionable field-level errors to the admin UI.
 *
 * Schema inventory
 * ----------------
 * createUserSchema    – POST /api/v1/users  (admin creates a managed account)
 * updateUserSchema    – PATCH /api/v1/users/:userId
 * assignRoleSchema    – POST /api/v1/users/:userId/role
 * deactivateUserSchema – POST /api/v1/users/:userId/deactivate
 */

import { z } from 'zod';
import { ROLE_NAMES } from '../config/roles.js';
import { emailSchema, objectIdSchema, passwordSchema } from './common.js';

/**
 * POST /api/v1/users
 *
 * Admin creates a managed user account. The user never self-registers.
 *
 * Role resolution: the admin supplies EITHER a human-readable role name (e.g.
 * `'HR_MANAGER'`) OR a MongoDB ObjectId pointing to a role document. Exactly
 * one must be present. The service resolves whichever is provided; this keeps
 * the API flexible for both UI dropdowns (name) and programmatic clients (id).
 *
 * Status defaults to `'ACTIVE'` so new accounts are immediately usable unless
 * the admin explicitly creates an inactive one.
 */
export const createUserSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required.')
      .max(50, 'First name must not exceed 50 characters.'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required.')
      .max(50, 'Last name must not exceed 50 characters.'),
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(Object.values(ROLE_NAMES)).optional(),
    roleId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).default('ACTIVE'),
  })
  .strict()
  .refine(
    (value) => Boolean(value.role) !== Boolean(value.roleId),
    {
      message: 'Provide exactly one of role (name) or roleId (ObjectId), not both and not neither.',
      path: ['role'],
    },
  );

/**
 * PATCH /api/v1/users/:userId
 *
 * Update non-credential profile and administrative fields.
 * Passwords are changed through /auth/change-password only.
 * At least one field must be present.
 */
export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    departmentId: objectIdSchema.nullable().optional(),
    employeeId: objectIdSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: 'At least one field is required.' },
  );

/**
 * POST /api/v1/users/:userId/role
 *
 * Assign a new role to an existing user. Only a valid existing role ID is
 * accepted; names are not used here to prevent case-mismatch issues.
 */
export const assignRoleSchema = z
  .object({
    roleId: objectIdSchema,
  })
  .strict();

/**
 * POST /api/v1/users/:userId/deactivate
 *
 * Explicitly deactivate a user. An optional reason string is recorded in the
 * audit log but is never returned to other users.
 */
export const deactivateUserSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
