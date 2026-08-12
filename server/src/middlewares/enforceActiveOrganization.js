/**
 * @file enforceActiveOrganization.js
 * @description Middleware to block requests from deactivated or suspended organizations.
 */

import { Organization } from '../models/Organization.js';
import { AppError } from '../errors/AppError.js';

export async function enforceActiveOrganization(req, res, next) {
  try {
    if (!req.auth || !req.auth.organizationId) {
      return next();
    }

    const org = await Organization.findById(req.auth.organizationId).lean();
    if (!org) {
      throw new AppError(404, 'ORGANIZATION_NOT_FOUND', 'Organization not found.');
    }

    if (org.deactivatedAt || org.status === 'CANCELED' || org.status === 'SUSPENDED') {
      // Allow reactivation endpoint if caller is ADMIN
      if (req.originalUrl.includes('/deactivate') || req.originalUrl.includes('/reactivate')) {
        return next();
      }
      throw new AppError(
        403,
        'ORGANIZATION_DEACTIVATED',
        'Organization access has been suspended or deactivated. Contact system support.',
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}
