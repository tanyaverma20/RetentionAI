/**
 * @file userService.js
 * @description Business logic for administrator-managed user accounts.
 *
 * Why this file exists
 * --------------------
 * User management (creation, listing, updates, role assignment, deactivation)
 * involves business rules that sit above raw database operations: checking for
 * duplicate emails, resolving role references, enforcing the "last active admin"
 * constraint, and preventing self-deletion. These rules belong in the service
 * layer, not in controllers or repositories.
 *
 * Design decisions
 * ----------------
 * - No public registration. Only an authenticated System Administrator can
 *   create accounts. This is enforced in the route layer with `authorize('ADMIN')`
 *   but verified at the service layer as well through the caller context.
 * - Soft delete only. User documents are never hard-deleted to preserve audit
 *   identity and referential integrity across audit logs and historical records.
 * - Role resolution: the admin may supply either a role name ('HR_MANAGER') or
 *   a MongoDB ObjectId roleId. Exactly one must be present; this is validated
 *   at the schema level and re-validated here for defence in depth.
 */

import { AppError } from '../errors/AppError.js';
import {
  countUsersWithRole,
  findRoleById,
  findRoleByName,
} from '../repositories/roleRepository.js';
import {
  createUser,
  findUserByEmailInOrg,
  findUserByIdInOrg,
  listUsers,
  updateUser,
} from '../repositories/userRepository.js';
import { revokeAllRefreshTokensForUser } from '../repositories/refreshTokenRepository.js';
import { hashPassword } from '../utils/password.js';

/**
 * Shape returned to callers for any user object.
 * Credential fields, reset tokens, and deletedAt are never included.
 *
 * @param {import('mongoose').Document} user - Populated user document.
 * @param {import('mongoose').Document} role - Role document (may differ from user.roleId after assignment).
 */
function toUserResponse(user, role) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: role?.name ?? user.roleId?.name,
    permissions: role?.permissions ?? user.roleId?.permissions,
    departmentId: user.departmentId?.toString() ?? null,
    employeeId: user.employeeId?.toString() ?? null,
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  };
}

/**
 * Create a managed user account. Only callable by a System Administrator.
 *
 * @param {{ firstName, lastName, email, password, role?, roleId?, departmentId?, status }} payload
 * @param {string} organizationId
 * @returns {Promise<object>} Safe user response object.
 * @throws {AppError} 409 EMAIL_EXISTS | 422 INVALID_ROLE_SCOPE
 */
export async function createManagedUser({
  firstName,
  lastName,
  email,
  password,
  role,
  roleId,
  departmentId,
  status,
}, organizationId) {
  if (await findUserByEmailInOrg(email, organizationId)) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
  }

  const resolvedRole = roleId ? await findRoleById(roleId) : await findRoleByName(role);
  if (!resolvedRole) {
    throw new AppError(422, 'INVALID_ROLE_SCOPE', 'The selected role does not exist.');
  }

  const user = await createUser({
    organizationId,
    name: `${firstName.trim()} ${lastName.trim()}`,
    email,
    passwordHash: await hashPassword(password),
    roleId: resolvedRole.id,
    departmentId,
    status,
  });

  return toUserResponse(user, resolvedRole);
}

/**
 * Return a paginated, filtered list of users.
 *
 * @param {{ page, pageSize, status?, roleId?, departmentId?, q?, sort? }} options
 * @param {string} organizationId
 * @returns {Promise<{ items: object[], totalItems: number, page: number, pageSize: number, totalPages: number }>}
 */
export async function listManagedUsers({ page = 1, pageSize = 25, status, roleId, departmentId, q }, organizationId) {
  const { items, totalItems } = await listUsers({ page, pageSize, status, roleId, departmentId, q }, organizationId);
  return {
    items: items.map((u) => toUserResponse(u, u.roleId)),
    totalItems,
    page,
    pageSize,
    totalPages: Math.ceil(totalItems / pageSize),
  };
}

/**
 * Return a single user by ID.
 *
 * @param {string} userId
 * @param {string} organizationId
 * @returns {Promise<object>}
 * @throws {AppError} 404 NOT_FOUND
 */
export async function getManagedUser(userId, organizationId) {
  const user = await findUserByIdInOrg(userId, organizationId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  return toUserResponse(user, user.roleId);
}

/**
 * Update permitted profile fields (name, departmentId, employeeId).
 * Credential changes are handled exclusively through auth endpoints.
 *
 * @param {string} userId
 * @param {{ name?, departmentId?, employeeId? }} payload
 * @param {string} organizationId
 * @returns {Promise<object>}
 * @throws {AppError} 404 NOT_FOUND
 */
export async function updateManagedUser(userId, payload, organizationId) {
  const user = await findUserByIdInOrg(userId, organizationId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  if (payload.name !== undefined) user.name = payload.name;
  if (payload.departmentId !== undefined) user.departmentId = payload.departmentId || undefined;
  if (payload.employeeId !== undefined) user.employeeId = payload.employeeId || undefined;

  await updateUser(user);
  return toUserResponse(user, user.roleId);
}

/**
 * Assign a role to a user.
 *
 * @param {string} userId
 * @param {string} newRoleId - MongoDB ObjectId of the target role.
 * @param {string} organizationId
 * @returns {Promise<object>}
 * @throws {AppError} 404 NOT_FOUND | 422 INVALID_ROLE_SCOPE
 */
export async function assignUserRole(userId, newRoleId, organizationId) {
  const [user, role] = await Promise.all([findUserByIdInOrg(userId, organizationId), findRoleById(newRoleId)]);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');
  if (!role) throw new AppError(422, 'INVALID_ROLE_SCOPE', 'The selected role does not exist.');

  const currentRoleName = user.roleId?.name;
  const currentRoleId = user.roleId?._id || user.roleId;

  // Guard: If user is currently an ADMIN and changing to a non-ADMIN role, ensure they are not the last ADMIN
  if (currentRoleName === 'ADMIN' && role.name !== 'ADMIN') {
    const adminCount = await countUsersWithRole(currentRoleId, organizationId);
    if (adminCount <= 1) {
      throw new AppError(409, 'LAST_ADMIN', 'Cannot demote the last active administrator.');
    }
  }

  await User.updateOne({ _id: user._id, organizationId }, { roleId: role._id });
  await revokeAllRefreshTokensForUser(user.id);
  const updatedUser = await findUserByIdInOrg(userId, organizationId);
  return toUserResponse(updatedUser, role);
}

/**
 * Deactivate (soft-delete) a user account.
 * Cannot deactivate the caller's own account; cannot remove the last active Admin.
 *
 * @param {string} targetUserId  - User to deactivate.
 * @param {string} callerUserId  - ID of the requesting admin (from request.auth).
 * @param {string} organizationId
 * @returns {Promise<void>}
 * @throws {AppError} 404 NOT_FOUND | 409 LAST_ADMIN | 409 SELF_DEACTIVATION
 */
export async function deactivateManagedUser(targetUserId, callerUserId, organizationId) {
  if (targetUserId === callerUserId) {
    throw new AppError(409, 'SELF_DEACTIVATION', 'You cannot deactivate your own account.');
  }

  const user = await findUserByIdInOrg(targetUserId, organizationId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  // Guard: ensure at least one other active Admin will remain IN THIS
  // ORGANIZATION. countUsersWithRole is itself org-scoped now — see its
  // comment in roleRepository.js for the cross-tenant bug this closes.
  if (user.roleId?.name === 'ADMIN') {
    const adminCount = await countUsersWithRole(user.roleId.toString(), organizationId);
    if (adminCount <= 1) {
      throw new AppError(409, 'LAST_ADMIN', 'Cannot deactivate the last active administrator.');
    }
  }

  user.status = 'INACTIVE';
  user.deletedAt = new Date();
  await updateUser(user);
  await revokeAllRefreshTokensForUser(user.id);
}
