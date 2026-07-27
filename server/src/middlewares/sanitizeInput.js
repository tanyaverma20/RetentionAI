/**
 * @file sanitizeInput.js
 * @description Express middleware to prevent NoSQL injection attacks.
 *
 * Why this file exists
 * --------------------
 * MongoDB queries can interpret keys prefixed with `$` as operators (e.g.,
 * `$gt`, `$ne`). If an attacker passes an object instead of a string in a JSON
 * payload (e.g., `{ "email": { "$ne": null }, "password": "..." }`), they
 * could bypass authentication or extract data.
 *
 * Security decisions
 * ------------------
 * - This middleware recursively inspects `req.body`, `req.query`, and
 *   `req.params` and immediately rejects the request if any key contains a
 *   dollar sign (`$`) or a period (`.`).
 * - Executed early in the middleware pipeline (before validation and routing)
 *   so no downstream code accidentally processes a malicious operator.
 */

import { AppError } from '../errors/AppError.js';

/**
 * Recursively check if an object contains keys with `$` or `.`.
 *
 * @param {unknown} value
 * @returns {boolean} `true` if an unsafe key is found.
 */
function hasUnsafeKey(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, nestedValue]) => key.includes('$') || key.includes('.') || hasUnsafeKey(nestedValue),
  );
}

/**
 * Middleware to reject requests containing NoSQL operators.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} _response
 * @param {import('express').NextFunction} next
 */
export function sanitizeInput(request, _response, next) {
  if (hasUnsafeKey(request.body) || hasUnsafeKey(request.query) || hasUnsafeKey(request.params)) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'One or more fields contain invalid characters.'));
  }
  return next();
}
