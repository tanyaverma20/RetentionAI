/**
 * @file Role.js
 * @description Mongoose schema and model for RBAC role definitions.
 *
 * Why this file exists
 * --------------------
 * Roles are the central permission authority. Storing them in MongoDB rather
 * than hard-coding them in source means they can be listed, queried, and
 * eventually managed through the admin API without a deployment. System roles
 * (ADMIN, HR_MANAGER, HR_ANALYST, DEPARTMENT_MANAGER, EMPLOYEE) are seeded
 * at startup via `roleService.ensureSystemRoles` and protected from deletion
 * by the `isSystem` flag.
 *
 * Field decisions
 * ---------------
 * - `name`        – Always stored uppercase. Used as a stable string constant
 *   in RBAC checks (e.g. `authorize('ADMIN', 'HR_MANAGER')`).
 * - `permissions` – Array of capability strings such as `'employee.read'`.
 *   The wildcard `['*']` is reserved for ADMIN.
 * - `isSystem`    – Prevents service code from deleting built-in roles that
 *   the application depends on.
 * - `organizationId` – Future multi-tenancy; custom roles will be scoped per
 *   organisation while system roles can remain global (null organizationId).
 *
 * Indexes
 * -------
 * - Unique `{organizationId, name}` – prevents duplicate role names within a
 *   tenant. System roles are shared (null organizationId), so the unique
 *   constraint prevents two 'ADMIN' system roles.
 */

import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, index: true },
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Prevents duplicate role names within the same tenant scope.
roleSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Role = mongoose.model('Role', roleSchema);
