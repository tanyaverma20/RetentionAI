/**
 * @file errorHandler.js
 * @description Centralised Express error-handling middleware.
 *
 * Why this file exists
 * --------------------
 * Express requires a final middleware with an arity of 4 to catch errors passed
 * to `next()`. Centralising error handling ensures that no route leaks internal
 * stack traces to the client and that every error adheres strictly to the
 * JSON response contract defined in BADD.
 *
 * Security decisions
 * ------------------
 * - Explicitly surfaces known `AppError` instances, which contain safe,
 *   curated user-facing messages.
 * - Catches MongoDB duplicate key errors (code 11000) and transforms them into
 *   a safe 409 Conflict. It checks the error message to determine if it's an
 *   email uniqueness violation or a generic one, preventing database schema
 *   details from leaking.
 * - Catches Mongoose validation/cast errors and transforms them into 400 Bad
 *   Request errors.
 * - All other errors are caught as "500 Internal Server Error", logged
 *   server-side (with correlation ID), and a generic safe message is returned.
 *   This ensures a crash never exposes source code, paths, or dependencies.
 */

import { AppError } from '../errors/AppError.js';
import { sendError } from '../utils/response.js';

/**
 * 404 Handler for undefined routes.
 * Must be attached after all valid routes but before the main error handler.
 */
export function notFoundHandler(request, response) {
  return sendError(
    response,
    404,
    'NOT_FOUND',
    'The requested resource was not found.',
    request.requestId,
  );
}

/**
 * Main error-handling middleware.
 *
 * @param {Error} error
 * @param {import('express').Request} request
 * @param {import('express').Response} response
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(error, request, response, _next) {
  // 1. Handled application errors (safe to surface)
  if (error instanceof AppError) {
    return sendError(
      response,
      error.statusCode,
      error.code,
      error.message,
      request.requestId,
      error.details,
    );
  }

  // 2. MongoDB duplicate key errors
  if (error?.code === 11000) {
    // If the index involves email, return a specific error.
    if (error.message?.includes('email_1')) {
      return sendError(
        response,
        409,
        'EMAIL_EXISTS',
        'An account with this email already exists.',
        request.requestId,
      );
    }
    // Generic duplicate key
    return sendError(
      response,
      409,
      'CONFLICT',
      'The resource already exists and must be unique.',
      request.requestId,
    );
  }

  // 3. Mongoose schema cast/validation errors
  if (error?.name === 'CastError' || error?.name === 'ValidationError') {
    return sendError(
      response,
      400,
      'VALIDATION_ERROR',
      'One or more fields are structurally invalid.',
      request.requestId,
    );
  }

  // 4. Unhandled runtime exceptions (do not leak details)
  console.error(`[RequestId: ${request.requestId}] Internal Error:`, error?.message || error);
  
  return sendError(
    response,
    500,
    'INTERNAL_ERROR',
    'An unexpected error occurred.',
    request.requestId,
  );
}
