/**
 * @file enforceEntitlements.js
 * @description Middleware to enforce subscription quotas before executing expensive operations.
 */

import { checkAiRequestQuota, checkEmployeeQuota } from '../services/entitlementService.js';

export function enforceAiQuota() {
  return async (req, res, next) => {
    try {
      if (req.auth && req.auth.organizationId) {
        await checkAiRequestQuota(req.auth.organizationId);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function enforceEmployeeQuota(incomingCount = 1) {
  return async (req, res, next) => {
    try {
      if (req.auth && req.auth.organizationId) {
        await checkEmployeeQuota(req.auth.organizationId, incomingCount);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
