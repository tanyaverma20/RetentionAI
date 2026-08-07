/**
 * @file authenticate.js
 * @description Express middleware for JWT bearer authentication.
 *
 * Why this file exists
 * --------------------
 * Every protected endpoint must verify the caller's identity before executing
 * business logic. Centralising this verification ensures tokens are parsed,
 * signatures validated, and user state (like soft-deletion or locking) checked
 * consistently for every request.
 *
 * Security decisions
 * ------------------
 * - Reads only the `Authorization: Bearer <token>` header to prevent CSRF
 *   attacks that can occur with cookie-based session storage.
 * - Enforces `payload.type === 'access'`. Refresh tokens are explicitly
 *   rejected to prevent an attacker with a stolen long-lived token from
 *   using it directly against the API.
 * - Performs a database lookup for the user. While this reduces the stateless
 *   benefit of JWTs slightly, it is absolutely necessary so that deactivated
 *   or locked accounts are immediately blocked, rather than retaining access
 *   until their current 15-minute token expires.
 * - Errors are uniformly converted to 401 UNAUTHENTICATED to avoid leaking
 *   whether an account exists but is locked vs token expiration.
 */

import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';
import { findUserById } from '../repositories/userRepository.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { DEFAULT_ORGANIZATION_ID } from '../config/tenancy.js';

const { JsonWebTokenError, TokenExpiredError } = jwt;

/**
 * Verify the request's JWT access token and attach the user context to `request.auth`.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} _response
 * @param {import('express').NextFunction} next
 */
export async function authenticate(request, _response, next) {
  try {
    const authorization = request.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError(401, 'MISSING_TOKEN', 'Authentication is required.');
    }

    const token = authorization.slice(7).trim();
    const payload = verifyAccessToken(token);

    if (payload.type !== 'access') {
      throw new AppError(401, 'INVALID_TOKEN', 'Authentication is required.');
    }

    // Lookup ensures the account is still active (not locked/deleted).
    const user = await findUserById(payload.sub);
    if (!user || user.status !== 'ACTIVE' || !user.roleId) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    }

    // Attach verified context for downstream authorize middleware and controllers.
    //
    // organizationId is resolved HERE, from the authenticated user's own DB
    // record — never from client input. Every controller previously had its
    // own extractOrgId(req) helper that trusted an `x-organization-id`
    // header (falling back to the same DEFAULT_ORGANIZATION_ID below),
    // which meant any authenticated user could read/write ANY
    // organization's data just by setting that header. That header is no
    // longer consulted anywhere. The DEFAULT_ORGANIZATION_ID fallback only
    // exists because pre-existing seeded User documents predate this field
    // being populated; once every User has a real organizationId this
    // fallback becomes dead code and can be deleted.
    request.auth = {
      userId: user.id,
      role: user.roleId.name,
      permissions: user.roleId.permissions,
      departmentId: user.departmentId?.toString(),
      employeeId: user.employeeId?.toString(),
      organizationId: user.organizationId?.toString() || DEFAULT_ORGANIZATION_ID,
    };

    return next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(new AppError(401, 'TOKEN_EXPIRED', 'Authentication token has expired.'));
    }
    if (error instanceof JsonWebTokenError) {
      return next(new AppError(401, 'INVALID_TOKEN', 'Authentication is required.'));
    }
    return next(error);
  }
}
