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
 * Used by the forgot-password and user-uniqueness checks.
 *
 * @param {string} email - Normalised email address.
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findUserByEmail(email) {
  return User.findOne({ email, deletedAt: { $exists: false } }).populate(rolePopulation);
}

/**
 * List users with pagination, optional status/role/department filters,
 * and an optional text search across name and email.
 *
 * @param {{ page: number, pageSize: number, status?: string, roleId?: string, departmentId?: string, q?: string }} options
 * @returns {Promise<{ items: Array, totalItems: number }>}
 */
export async function listUsers({ page, pageSize, status, roleId, departmentId, q }) {
  const filter = { deletedAt: { $exists: false } };
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
