/**
 * @file organizationAdminController.js
 * @description Controllers for organization settings, onboarding state, and tenant deactivation.
 */

import * as organizationSettingsService from '../services/organizationSettingsService.js';

export async function getSettings(req, res, next) {
  try {
    const data = await organizationSettingsService.getOrganizationSettings(req.auth.organizationId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req, res, next) {
  try {
    const data = await organizationSettingsService.updateOrganizationSettings(
      req.auth.organizationId,
      req.body,
      req.auth.userId,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getOnboardingState(req, res, next) {
  try {
    const data = await organizationSettingsService.getOrganizationSettings(req.auth.organizationId);
    res.json({
      success: true,
      data: {
        onboardingState: data.onboardingState,
        onboardingMilestones: data.onboardingMilestones,
        sequence: organizationSettingsService.ONBOARDING_SEQUENCE,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function advanceOnboardingState(req, res, next) {
  try {
    const { targetState } = req.body;
    const data = await organizationSettingsService.updateOnboardingState(
      req.auth.organizationId,
      targetState,
      req.auth.userId,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deactivateOrganization(req, res, next) {
  try {
    const { reason } = req.body;
    const data = await organizationSettingsService.deactivateOrganization(
      req.auth.organizationId,
      reason,
      req.auth.userId,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function reactivateOrganization(req, res, next) {
  try {
    const data = await organizationSettingsService.reactivateOrganization(
      req.auth.organizationId,
      req.auth.userId,
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
