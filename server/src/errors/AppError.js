/**
 * @file AppError.js
 * @description Domain-aware application error class.
 *
 * Why this file exists
 * --------------------
 * Express's default error handling conflates all errors into untyped `Error`
 * objects, making it impossible for the centralised error handler to distinguish
 * a deliberate business-rule rejection (e.g. invalid credentials → 401) from an
 * unexpected runtime crash (→ 500). `AppError` is the single agreed signal for
 * intentional, safe-to-surface errors across all service and repository layers.
 *
 * Usage
 * -----
 * Services throw `new AppError(statusCode, code, message)` and let the error
 * propagate through controllers to the centralised error handler in
 * `middlewares/errorHandler.js`, which formats it into the BADD-compliant
 * error envelope. No controller writes its own error response.
 *
 * Security note
 * -------------
 * `message` must be a safe, user-facing string — never a database error detail,
 * stack trace, internal identifier, or token value. Sensitive diagnostic
 * information belongs in server-side logs, not in HTTP responses.
 */

export class AppError extends Error {
  /**
   * Create a new application-level error.
   *
   * @param {number}   statusCode - HTTP status code to send (4xx or 5xx).
   * @param {string}   code       - Stable machine-readable error code (e.g. `'INVALID_CREDENTIALS'`).
   * @param {string}   message    - Safe, user-facing description of the problem.
   * @param {Array<{field:string,rule:string,message:string}>} [details]
   *   Optional field-level validation details (400 / 422 responses only).
   */
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    /** @type {Array<{field:string,rule:string,message:string}> | undefined} */
    this.details = details;
  }
}
