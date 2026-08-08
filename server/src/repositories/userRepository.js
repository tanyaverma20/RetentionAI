/**
 * @file userRepository.js
 * @description Data-access functions for the User collection.
 *
 * Why this file exists
 * --------------------
 * Mongoose queries are isolated in repository functions so that services
 * contain only business logic and never touch the ODM directly. This keeps
 * services testable without a live database and ensures that projection,
 * population, and scope filters are applied consistently in one place.
 *
 * Conventions
 * -----------
 * - Every query that returns a user for display excludes `passwordHash`,
 *   `passwordResetTokenHash`, and `passwordResetExpiresAt` (they are
 *   `select: false` in the schema, so they are absent by default).
 * - Queries that need credentials call `.select('+passwordHash')` explicitly.
 * - Soft-deleted users (`deletedAt` present) are excluded from all queries
 *   using `{ deletedAt: { $exists: false } }`, preserving audit identity.
 * - The `roleId` field is populated in every user returned to the service
 *   layer so that services and middleware receive `user.roleId.name` and
 *   `user.roleId.permissions` without additional round-trips.
 */

import mongoose from 'mongoose';
import { User } from '../models/User.js';

/** Consistent population spec used in every user query that needs role data. */
const rolePopulation = { path: 'roleId', select: 'name permissions' };

/**
 * Find an active user by email, including the password hash.
 * Used exclusively by the login flow.
 *
 * @param {string} email - Normalised (lowercase, trimmed) email address.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserForAuthentication(email) {
  return User.findOne({ email, deletedAt: { $exists: false } })
    .select('+passwordHash')
    .populate(rolePopulation);
}

/**
 * Find an active user by ID, including the password hash.
 * Used by the change-password flow to verify the current password.
 *
 * @param {string} userId - MongoDB ObjectId string.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserForAuthenticationById(userId) {
  return User.findOne({ _id: userId, deletedAt: { $exists: false } })
    .select('+passwordHash')
    .populate(rolePopulation);
}

/**
 * Find an active user by ID without credential fields.
 * Used by the authenticate middleware and getCurrentUser service.
 *
 * @param {string} userId - MongoDB ObjectId string.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserById(userId) {
  return User.findOne({ _id: userId, deletedAt: { $exists: false } }).populate(rolePopulation);
}

/**
 * Find a user by ID including the password-reset token fields.
 * Only used when the admin needs to inspect reset state directly.
 *
 * @param {string} userId - MongoDB ObjectId string.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserByIdWithResetToken(userId) {
  return User.findById(userId).select('+passwordResetTokenHash +passwordResetExpiresAt');
}

/**
 * Find a user by a valid (non-expired) password-reset token hash.
 * Returns `null` if the token is absent, expired, or does not exist.
 *
 * @param {string} tokenHash - HMAC-SHA-256 hash of the reset token.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserByResetToken(tokenHash) {
  return User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
    deletedAt: { $exists: false },
  }).select('+passwordResetTokenHash +passwordResetExpiresAt');
}

/**
 * Find an active user by email without credential fields.
 * Used by the forgot-password flow, which — like login — looks a user up
 * by email BEFORE any organization context exists, so this is intentionally
 * NOT organization-scoped. For the admin-management "does this email
 * already exist in MY org" check, use findUserByEmailInOrg below instead.
 *
 * @param {string} email - Normalised email address.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserByEmail(email) {
  return User.findOne({ email, deletedAt: { $exists: false } }).populate(rolePopulation);
}

/**
 * Find an active user by ID, scoped to one organization. Used by the
 * ADMIN-facing user-management endpoints (userService.js) — unlike
 * findUserById above (used by auth flows that establish identity from a
 * token/email before any org context exists), this must never return a
 * user belonging to a different organization than the caller's.
 *
 * @param {string} userId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserByIdInOrg(userId, organizationId) {
  return User.findOne({ _id: userId, organizationId, deletedAt: { $exists: false } }).populate(rolePopulation);
}

/**
 * Find an active user by email, scoped to one organization. See
 * findUserByIdInOrg's comment — used for the admin-management
 * "does this email already exist in MY org" duplicate check, where
 * findUserByEmail's global (cross-org) lookup would incorrectly block
 * creating a user whose email merely happens to match one in a
 * DIFFERENT organization (the schema's uniqueness is {organizationId,
 * email}, not email alone).
 *
 * @param {string} email
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserByEmailInOrg(email, organizationId) {
  return User.findOne({ email, organizationId, deletedAt: { $exists: false } }).populate(rolePopulation);
}

/**
 * List users with pagination, optional status/role/department filters,
 * and an optional text search across name and email, scoped to one
 * organization.
 *
 * @param {{ page: number, pageSize: number, status?: string, roleId?: string, departmentId?: string, q?: string }} options
 * @param {string} organizationId
 * @returns {Promise<{ items: Array, totalItems: number }>}
 */
export async function listUsers({ page, pageSize, status, roleId, departmentId, q }, organizationId) {
  const filter = {
    organizationId: mongoose.Types.ObjectId.isValid(organizationId)
      ? new mongoose.Types.ObjectId(organizationId)
      : organizationId,
    deletedAt: { $exists: false },
  };
  if (status) filter.status = status;
  if (roleId) filter.roleId = new mongoose.Types.ObjectId(roleId);
  if (departmentId) filter.departmentId = new mongoose.Types.ObjectId(departmentId);
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [items, totalItems] = await Promise.all([
    User.find(filter)
      .populate(rolePopulation)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
    User.countDocuments(filter),
  ]);

  return { items, totalItems };
}

/**
 * Create a new user document.
 *
 * @param {object} data - Validated user fields from the service layer.
 * @returns {Promise<import('mongoose').Document>}
 */
export function createUser(data) {
  return User.create(data);
}

/**
 * Persist changes to an existing user document.
 * Services mutate the document in memory and call this to flush.
 *
 * @param {import('mongoose').Document} user - Modified user document.
 * @returns {Promise<import('mongoose').Document>}
 */
export function updateUser(user) {
  return user.save();
}
