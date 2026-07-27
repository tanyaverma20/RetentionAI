/**
 * @file response.js
 * @description Centralised HTTP response helpers.
 *
 * Why this file exists
 * --------------------
 * Every endpoint must produce the same JSON envelope so that clients can rely
 * on a predictable structure. Centralising the shape here means a single edit
 * propagates everywhere and no controller accidentally invents its own format.
 *
 * Envelope contract (from BADD §22 / §21):
 *
 *   Success  → { success: true,  data: {...}, meta: { requestId, timestamp } }
 *   Error    → { success: false, error: { code, message, details? },
 *                meta: { requestId, timestamp } }
 *
 * Security note: `details` is included only for correctable validation errors
 * (400 / 422). Authentication and authorization responses never include details
 * that could expose protected resource existence.
 */

/**
 * Send a successful JSON response.
 *
 * @param {import('express').Response} response - Express response object.
 * @param {number}                    statusCode - HTTP status code (2xx).
 * @param {unknown}                   data       - Payload to nest under `data`.
 * @param {string}                    requestId  - Correlation ID from requestId middleware.
 * @returns {import('express').Response}
 */
export function sendSuccess(response, statusCode, data, requestId) {
  return response.status(statusCode).json({
    success: true,
    data,
    meta: { requestId, timestamp: new Date().toISOString() },
  });
}

/**
 * Send an error JSON response.
 *
 * @param {import('express').Response}              response   - Express response object.
 * @param {number}                                  statusCode - HTTP status code (4xx / 5xx).
 * @param {string}                                  code       - Stable machine-readable error code.
 * @param {string}                                  message    - Safe user-facing message.
 * @param {string}                                  requestId  - Correlation ID.
 * @param {Array<{field:string,rule:string,message:string}>} [details] - Only for validation errors.
 * @returns {import('express').Response}
 */
export function sendError(response, statusCode, code, message, requestId, details) {
  const error = { code, message };
  if (Array.isArray(details) && details.length > 0) error.details = details;
  return response.status(statusCode).json({
    success: false,
    error,
    meta: { requestId, timestamp: new Date().toISOString() },
  });
}
