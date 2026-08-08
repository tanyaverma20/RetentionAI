/**
 * @file organizationService.js
 * @description Self-serve organization signup — Phase 1, item 2 of
 * docs/PLATFORM_BLUEPRINT.md.
 *
 * Why this file exists
 * ---------------------
 * Turns the app from "one seeded organization everyone shares" into
 * "anyone can create their own, isolated organization." Isolation itself
 * was already fixed (organizationId is derived from the verified JWT's
 * User document in authenticate.js, never from client input) — this file
 * is what actually lets a new, distinct organizationId come into being.
 *
 * Design decisions
 * -----------------
 * - The signing-up user is granted the existing global system ADMIN role
 *   (organizationId: null, permissions: ['*']) rather than a new
 *   "ORG_OWNER" role type. The blueprint's Part 2 sketches a future
 *   ORG_OWNER/PLATFORM_ADMIN split for when billing and a cross-tenant
 *   admin panel need to distinguish "owns this org's subscription" from
 *   "can manage this org's HR data" — introducing that distinction before
 *   either of those exists would be unused complexity.
 * - No billing (Phase 2): every new organization starts TRIALING/FREE with
 *   a stored `employeeLimit`, but nothing currently checks it. Enforcing
 *   it belongs with the rest of Phase 2's usage-limit work, not bundled
 *   into signup.
 * - Not a true DB transaction: if User creation fails after the
 *   Organization was already created, the (empty, useless) Organization
 *   document is deleted as a compensating action rather than left
 *   orphaned. This is a pragmatic safety net, not ACID — acceptable here
 *   because both writes are simple inserts with no cross-document
 *   invariants beyond "an org should have an admin," and Mongoose
 *   transactions require a replica set that adds real operational cost
 *   for a guarantee this specific flow doesn't need.
 * - Session issuance is NOT reimplemented here — it calls the existing,
 *   already-tested `login()` from authService.js immediately after
 *   creating the account, so signup and login can never drift apart in
 *   how a session gets issued.
 */

import { createOrganization, slugExists, findOrganizationById } from '../repositories/organizationRepository.js';
import { createUser } from '../repositories/userRepository.js';
import { findRoleByName } from '../repositories/roleRepository.js';
import { hashPassword } from '../utils/password.js';
import { login } from './authService.js';
import { recordAudit } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { Organization } from '../models/Organization.js';

const TRIAL_DAYS = 14;
const FREE_PLAN_EMPLOYEE_LIMIT = 50;

function slugify(name) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'org';
}

async function generateUniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design: each check depends on the previous attempt's result.
    if (!(await slugExists(slug))) return slug;
    slug = `${base}-${attempt}`;
  }
  // Extremely unlikely (20 name collisions), but never fail signup over a slug.
  return `${base}-${Date.now().toString(36)}`;
}

export function toOrganizationProfile(org) {
  return {
    id: org.id ?? String(org._id),
    name: org.name,
    slug: org.slug,
    status: org.status,
    plan: org.plan,
    employeeLimit: org.employeeLimit,
    trialEndsAt: org.trialEndsAt,
  };
}

/**
 * Creates a brand-new Organization and its first (ADMIN) User, then issues
 * a session for that user — the caller is logged in immediately, same as
 * every other SaaS signup flow.
 *
 * @param {{ organizationName: string, adminName: string, adminEmail: string, adminPassword: string }} input
 * @returns {Promise<{ organization: object, accessToken: string, refreshToken: string, user: object }>}
 * @throws {AppError} 500 ROLE_SEED_MISSING | 409 EMAIL_IN_USE (surfaced from login/createUser)
 */
export async function signUp({ organizationName, adminName, adminEmail, adminPassword }) {
  const adminRole = await findRoleByName('ADMIN');
  if (!adminRole) {
    // Should be unreachable — ensureSystemRoles seeds this at startup — but
    // fail loudly rather than silently create an organization with no one
    // able to administer it.
    throw new AppError(500, 'ROLE_SEED_MISSING', 'System roles are not initialized. Contact support.');
  }

  const slug = await generateUniqueSlug(organizationName);
  const organization = await createOrganization({
    name: organizationName,
    slug,
    status: 'TRIALING',
    plan: 'FREE',
    employeeLimit: FREE_PLAN_EMPLOYEE_LIMIT,
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
  });

  let adminUser;
  try {
    const passwordHash = await hashPassword(adminPassword);
    adminUser = await createUser({
      organizationId: organization._id,
      name: adminName,
      email: adminEmail,
      passwordHash,
      roleId: adminRole._id,
      status: 'ACTIVE',
    });
  } catch (err) {
    // Compensating action, not a transaction — see file header. A brand-new
    // org can only fail user creation on this same request (duplicate email
    // within it is impossible; the org didn't exist a moment ago), so
    // deleting it back out is safe and leaves nothing orphaned.
    await Organization.deleteOne({ _id: organization._id }).catch((cleanupErr) =>
      logger.error('organization_signup_cleanup_failed', { organizationId: organization.id, error: cleanupErr.message }),
    );
    if (err.code === 11000) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists.');
    }
    throw err;
  }

  logger.info('organization_signup', { organizationId: organization.id, slug, adminUserId: adminUser.id });
  await recordAudit(organization._id, 'ORGANIZATION_CREATED', adminUser._id, {
    entityType: 'ORGANIZATION',
    entityId: organization._id,
    context: { name: organizationName, slug },
  });

  const session = await login({ email: adminEmail, password: adminPassword });
  return { organization: toOrganizationProfile(organization), ...session };
}

/** @param {string} organizationId - from req.auth.organizationId, never client input. */
export async function getCurrentOrganization(organizationId) {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }
  return toOrganizationProfile(org);
}
