/**
 * @file requestId.js
 * @description Express middleware for request correlation.
 *
 * Why this file exists
 * --------------------
 * To debug errors across logs, API responses, and downstream services, every
 * request needs a unique identifier. This middleware ensures every request
 * gets one, either by generating a UUID or accepting an existing one from an
 * upstream gateway (e.g. Nginx, API Gateway) via the `X-Request-Id` header.
 *
 * Security decisions
 * ------------------
 * - The accepted `X-Request-Id` header is length-limited to 128 characters to
 *   prevent log-injection or memory-exhaustion attacks from malicious headers.
 * - The ID is always attached to the HTTP response (`X-Request-Id`) so the
 *   client can provide it to support when reporting an error.
 * - The ID is included in all structured JSON responses (both success and error)
 *   in the `meta` object.
 */

import crypto from 'crypto';

/**
 * Middleware to assign and inject a correlation ID.
 *
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @param {import('express').NextFunction} next
 */
export function requestId(request, response, next) {
  const suppliedRequestId = request.get('X-Request-Id');
  
  // Use supplied ID if safe length, otherwise generate a secure v4 UUID.
  request.requestId =
    suppliedRequestId && suppliedRequestId.length <= 128
      ? suppliedRequestId
      : crypto.randomUUID();
      
  response.set('X-Request-Id', request.requestId);
  next();
}
