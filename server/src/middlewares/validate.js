/**
 * @file validate.js
 * @description Express middleware for Zod schema validation.
 *
 * Why this file exists
 * --------------------
 * Request payloads must be structurally validated before they reach business logic.
 * This middleware binds a Zod schema to a route, executing it against `request.body`.
 * If validation fails, it immediately returns a 400 response with actionable
 * field-level details. If it succeeds, the safe, typed data is attached to
 * `request.validatedBody`.
 *
 * Security decisions
 * ------------------
 * - Only the properties explicitly declared in the schema are retained in
 *   `validatedBody` (because Zod strips unknown keys by default, or rejects
 *   them if `.strict()` is used).
 * - Controllers MUST read from `request.validatedBody`, never `request.body`.
 *   This ensures that mass-assignment attacks (where an attacker sends
 *   unexpected fields like `role="ADMIN"`) are structurally impossible.
 */

import { AppError } from '../errors/AppError.js';

/**
 * Create a validation middleware for a given Zod schema.
 *
 * @param {import('zod').ZodTypeAny} schema - Zod schema to validate against `req.body`.
 * @returns {import('express').RequestHandler}
 */
export function validate(schema) {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      return next(
        new AppError(
          400,
          'VALIDATION_ERROR',
          'One or more fields are invalid.',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            rule: issue.code,
            message: issue.message,
          })),
        ),
      );
    }

    // Attach the validated, stripped, and typed data for the controller.
    request.validatedBody = result.data;
    return next();
  };
}
