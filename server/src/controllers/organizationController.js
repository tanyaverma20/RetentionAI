import * as organizationService from '../services/organizationService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

/** POST /organizations/signup — public; this endpoint IS how an account first comes to exist. */
export async function signup(req, res, next) {
  try {
    const result = await organizationService.signUp(req.validatedBody);
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(
      error instanceof AppError ? error : new AppError(error.statusCode || 500, error.code || 'SIGNUP_FAILED', error.message),
    );
  }
}

/** GET /organizations/me — authenticated; organizationId comes from req.auth, never a param. */
export async function getMe(req, res, next) {
  try {
    const result = await organizationService.getCurrentOrganization(req.auth.organizationId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(
      error instanceof AppError ? error : new AppError(error.statusCode || 500, error.code || 'ORGANIZATION_FETCH_FAILED', error.message),
    );
  }
}
