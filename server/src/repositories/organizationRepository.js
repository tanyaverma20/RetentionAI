/**
 * @file organizationRepository.js
 * @description Data-access functions for the Organization collection.
 *
 * Why this file exists
 * ---------------------
 * Mirrors the existing repository pattern (userRepository.js,
 * roleRepository.js) — the service layer never writes a Mongoose query
 * directly, keeping this the only place that knows Organization's schema.
 */

import { Organization } from '../models/Organization.js';

/** @param {object} data - Validated organization fields from the service layer. */
export function createOrganization(data) {
  return Organization.create(data);
}

/** @param {string} slug */
export function findOrganizationBySlug(slug) {
  return Organization.findOne({ slug });
}

/** @param {string} organizationId */
export function findOrganizationById(organizationId) {
  return Organization.findById(organizationId);
}

/** @param {string} slug */
export function slugExists(slug) {
  return Organization.exists({ slug });
}
