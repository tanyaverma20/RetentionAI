/**
 * @file usageController.js
 * @description Controller for tenant usage and entitlement summary endpoints.
 */

import * as entitlementService from '../services/entitlementService.js';

export async function getUsageSummary(req, res, next) {
  try {
    const data = await entitlementService.getTenantUsageSummary(req.auth.organizationId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
