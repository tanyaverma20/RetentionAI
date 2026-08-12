/**
 * @file organizationSettingsService.js
 * @description Organization settings, onboarding state machine, and deactivation lifecycle management.
 */

import { Organization } from '../models/Organization.js';
import { recordAudit } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export const ONBOARDING_SEQUENCE = [
  'ORGANIZATION_CREATED',
  'ADMIN_CREATED',
  'COMPANY_CONFIGURED',
  'EMPLOYEES_IMPORTED',
  'DATA_VALIDATED',
  'AI_READY',
  'FIRST_RISK_ANALYSIS',
  'ONBOARDING_COMPLETED',
];

export async function getOrganizationSettings(organizationId) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }

  return {
    id: org.id ?? String(org._id),
    name: org.name,
    slug: org.slug,
    status: org.status,
    plan: org.plan,
    employeeLimit: org.employeeLimit,
    trialEndsAt: org.trialEndsAt,
    settings: org.settings || { industry: '', timezone: 'UTC', allowedEmailDomains: [] },
    onboardingState: org.onboardingState || 'ADMIN_CREATED',
    onboardingMilestones: org.onboardingMilestones
      ? Object.fromEntries(org.onboardingMilestones)
      : { ADMIN_CREATED: org.createdAt },
    deactivatedAt: org.deactivatedAt,
    deactivationReason: org.deactivationReason,
  };
}

export async function updateOrganizationSettings(organizationId, settingsInput, userId) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }

  if (org.deactivatedAt) {
    throw new AppError(403, 'ORGANIZATION_DEACTIVATED', 'Cannot update settings for a deactivated organization.');
  }

  const newSettings = { ...org.settings?.toObject(), ...settingsInput };
  org.settings = newSettings;

  // Auto-advance onboarding state to COMPANY_CONFIGURED if currently ADMIN_CREATED
  if (org.onboardingState === 'ADMIN_CREATED') {
    org.onboardingState = 'COMPANY_CONFIGURED';
    org.onboardingMilestones = org.onboardingMilestones || new Map();
    org.onboardingMilestones.set('COMPANY_CONFIGURED', new Date());
  }

  await org.save();

  await recordAudit(organizationId, 'ORGANIZATION_SETTINGS_UPDATED', userId, {
    entityType: 'ORGANIZATION',
    entityId: org._id,
    context: settingsInput,
  });

  return getOrganizationSettings(organizationId);
}

export async function updateOnboardingState(organizationId, targetState, userId) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }

  if (!ONBOARDING_SEQUENCE.includes(targetState)) {
    throw new AppError(400, 'INVALID_ONBOARDING_STATE', `Target state '${targetState}' is not a valid onboarding state.`);
  }

  const currentIndex = ONBOARDING_SEQUENCE.indexOf(org.onboardingState || 'ADMIN_CREATED');
  const targetIndex = ONBOARDING_SEQUENCE.indexOf(targetState);

  // Validate state machine rule: allow staying in same state or advancing to next sequential state
  if (targetIndex < currentIndex) {
    throw new AppError(400, 'INVALID_STATE_TRANSITION', `Cannot regress onboarding state from '${org.onboardingState}' to '${targetState}'.`);
  }

  if (targetIndex > currentIndex + 1) {
    throw new AppError(
      400,
      'INVALID_STATE_TRANSITION',
      `Cannot skip onboarding steps. Must transition to '${ONBOARDING_SEQUENCE[currentIndex + 1]}' before '${targetState}'.`,
    );
  }

  org.onboardingState = targetState;
  org.onboardingMilestones = org.onboardingMilestones || new Map();
  org.onboardingMilestones.set(targetState, new Date());
  await org.save();

  await recordAudit(organizationId, 'ONBOARDING_STATE_TRANSITION', userId, {
    entityType: 'ORGANIZATION',
    entityId: org._id,
    context: { previousState: ONBOARDING_SEQUENCE[currentIndex], targetState },
  });

  return getOrganizationSettings(organizationId);
}

export async function deactivateOrganization(organizationId, reason, adminUserId) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }

  if (org.deactivatedAt) {
    throw new AppError(409, 'ALREADY_DEACTIVATED', 'Organization is already deactivated.');
  }

  org.status = 'CANCELED';
  org.deactivatedAt = new Date();
  org.deactivationReason = reason || 'Administrative deactivation';
  await org.save();

  logger.warn('organization_deactivated', { organizationId, adminUserId, reason });

  await recordAudit(organizationId, 'ORGANIZATION_DEACTIVATED', adminUserId, {
    entityType: 'ORGANIZATION',
    entityId: org._id,
    context: { reason: org.deactivationReason },
  });

  return getOrganizationSettings(organizationId);
}

export async function reactivateOrganization(organizationId, adminUserId) {
  const org = await Organization.findById(organizationId);
  if (!org) {
    throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
  }

  if (!org.deactivatedAt) {
    throw new AppError(409, 'NOT_DEACTIVATED', 'Organization is active.');
  }

  org.status = 'ACTIVE';
  org.deactivatedAt = null;
  org.deactivationReason = null;
  await org.save();

  logger.info('organization_reactivated', { organizationId, adminUserId });

  await recordAudit(organizationId, 'ORGANIZATION_REACTIVATED', adminUserId, {
    entityType: 'ORGANIZATION',
    entityId: org._id,
  });

  return getOrganizationSettings(organizationId);
}
