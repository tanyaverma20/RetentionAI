/**
 * @file roleRepository.js
 * @description Data-access functions for the Role collection.
 *
 * Why this file exists
 * --------------------
 * Role lookups and the system-role seed operation are isolated here. The
 * service layer resolves roles by name or ID without writing Mongoose queries,
 * keeping the repository the only place that knows about Role schema details.
 *
 * System role seeding
 * -------------------
 * `upsertSystemRoles` is called at startup by `roleService.ensureSystemRoles`.
 * It uses `$setOnInsert` rather than `$set` so that an administrator's custom
 * permission changes to a system role (e.g. adding a permission to HR_MANAGER)
 * are not overwritten on every restart. Only the initial creation uses the
 * hardcoded defaults.
 */

import { Role } from '../models/Role.js';

/**
 * Find a system role by its canonical name.
 * Used during user creation when the caller supplies a role name string.
 *
 * @param {string} name - Role name constant, e.g. `'HR_MANAGER'`.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findRoleByName(name) {
  return Role.findOne({ name, isSystem: true });
}

/**
 * Find any role by its MongoDB ObjectId.
 * Used when the caller supplies a `roleId` instead of a name.
 *
 * @param {string} roleId - MongoDB ObjectId string.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findRoleById(roleId) {
  return Role.findById(roleId);
}

/**
 * List all roles visible to administrators, sorted by name.
 *
 * @returns {Promise<import('mongoose').Document[]>}
 */
export function listRoles() {
  return Role.find({}).sort({ name: 1 });
}

/**
 * Create a new custom (non-system) role.
 *
 * @param {{ name: string, permissions: string[] }} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function createRole(data) {
  return Role.create({ ...data, isSystem: false });
}

/**
 * Update a role's name or permissions.
 * The service layer enforces that system roles cannot be renamed.
 *
 * @param {import('mongoose').Document} role - Role document to modify.
 * @returns {Promise<import('mongoose').Document>}
 */
export function updateRole(role) {
  return role.save();
}

/**
 * Delete a custom role document.
 * The service layer verifies the role is not `isSystem` and not in use
 * before calling this function.
 *
 * @param {string} roleId - MongoDB ObjectId string.
 * @returns {Promise<import('mongoose').DeleteResult>}
 */
export function deleteRole(roleId) {
  return Role.deleteOne({ _id: roleId });
}

/**
 * Seed system roles at startup using `updateOne` with `upsert: true`.
 * Uses `$setOnInsert` so that existing roles (potentially with custom
 * permission changes) are not overwritten on restart.
 *
 * @param {Array<{ name: string, permissions: string[] }>} roles
 * @returns {Promise<void>}
 */
export function upsertSystemRoles(roles) {
  return Promise.all(
    roles.map((role) =>
      Role.updateOne(
        { name: role.name, isSystem: true },
        { $setOnInsert: { ...role, isSystem: true } },
        { upsert: true },
      ),
    ),
  );
}

/**
 * Merge newly-introduced baseline permissions into existing system roles
 * without touching any admin-added custom permissions. `upsertSystemRoles`
 * only writes on first creation ($setOnInsert), so a role seeded in an
 * earlier sprint never gains permissions added by a later sprint (e.g. the
 * Sprint 9 workflow permissions) on its own — this closes that gap via a
 * $addToSet union rather than overwriting the permissions array outright.
 *
 * @param {Array<{ name: string, permissions: string[] }>} roles
 * @returns {Promise<void>}
 */
export function syncSystemRolePermissions(roles) {
  return Promise.all(
    roles.map((role) => {
      if (role.permissions.includes('*')) return Promise.resolve();
      return Role.updateOne(
        { name: role.name, isSystem: true },
        { $addToSet: { permissions: { $each: role.permissions } } },
      );
    }),
  );
}

/**
 * Count the number of users assigned to a given role within one
 * organization. Used before deactivating/deleting to ensure the role
 * isn't left unheld in that org.
 *
 * Scoped by organizationId — system roles like ADMIN are shared, global
 * Role documents (one 'ADMIN' Role._id used by every tenant's admins), so
 * an unscoped count here summed admins across EVERY organization. That
 * meant deactivateManagedUser's "don't remove the last admin" guard was
 * checking whether the last admin existed ANYWHERE, not in the caller's
 * own org — Org A could deactivate its own last admin as long as some
 * OTHER org still had one.
 *
 * @param {string} roleId - MongoDB ObjectId string.
 * @param {string} organizationId
 * @returns {Promise<number>}
 */
export async function countUsersWithRole(roleId, organizationId) {
  // Import here to avoid circular dependency: Role → User → Role.
  const { User } = await import('../models/User.js');
  return User.countDocuments({ roleId, organizationId, deletedAt: { $exists: false } });
}
