/**
 * @file authorize.js
 * @description Express middleware for Role-Based Access Control (RBAC).
 *
 * Why this file exists
 * --------------------
 * After the `authenticate` middleware establishes WHO the caller is, this
 * middleware determines WHAT they are allowed to do. Centralising this logic
 * prevents duplicated and potentially inconsistent permission checks across
 * controllers.
 *
 * Usage
 * -----
 * Route definitions attach this middleware with the required roles or permissions:
 *
 *   // Restrict to specific roles (e.g. System Administrators only)
 *   router.post('/', authorize('ADMIN'), controller.create);
 *
 *   // Allow multiple roles
 *   router.get('/', authorize('ADMIN', 'HR_MANAGER'), controller.list);
 *
 *   // Check specific capability permissions (prefixed with 'permission:')
 *   router.get('/reports', authorize('permission:reports.read'), controller.report);
 *
 * Security decisions
 * ------------------
 * - Fails closed: if the user's role is not in the allowed list, or they lack
 *   the required permission, the request is rejected with a 403 Forbidden.
 * - The 'ADMIN' role inherently has the wildcard permission `['*']`, which
 *   grants access to all permission-based routes automatically.
 */

import { AppError } from '../errors/AppError.js';

/**
 * Authorize the request based on the user's role or permissions.
 *
 * @param {...string} requirements - Roles (e.g. 'ADMIN') or permissions (e.g. 'permission:users.read').
 * @returns {import('express').RequestHandler}
 */
export function authorize(...requirements) {
  return (request, _response, next) => {
    const auth = request.auth;

    // Fail closed if the request was not authenticated.
    if (!auth) {
      return next(
        new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'),
      );
    }

    const hasWildcard = auth.permissions?.includes('*');
    let isAuthorized = false;

    for (const requirement of requirements) {
      if (requirement.startsWith('permission:')) {
        const requiredPermission = requirement.slice(11);
        if (hasWildcard || auth.permissions?.includes(requiredPermission)) {
          isAuthorized = true;
          break;
        }
      } else {
        // Role check
        if (auth.role === requirement) {
          isAuthorized = true;
          break;
        }
      }
    }

    if (!isAuthorized) {
      return next(
        new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action.'),
      );
    }

    return next();
  };
}
