import * as authService from '../services/authService.js';
import { sendSuccess } from '../utils/response.js';

export async function login(request, response, next) {
  try {
    const session = await authService.login(request.validatedBody);
    return sendSuccess(response, 200, session, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function logout(request, response, next) {
  try {
    await authService.logout(request.auth.userId, request.validatedBody.refreshToken);
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function refresh(request, response, next) {
  try {
    const session = await authService.refreshSession(request.validatedBody.refreshToken);
    return sendSuccess(response, 200, session, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getCurrentUser(request, response, next) {
  try {
    return sendSuccess(
      response,
      200,
      await authService.getCurrentUser(request.auth.userId),
      request.requestId,
    );
  } catch (error) {
    return next(error);
  }
}

export async function changePassword(request, response, next) {
  try {
    await authService.changePassword(request.auth.userId, request.validatedBody);
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
}

export async function forgotPassword(request, response, next) {
  try {
    await authService.requestPasswordReset(request.validatedBody.email);
    return sendSuccess(
      response,
      202,
      { message: 'If eligible, reset instructions were sent.' },
      request.requestId,
    );
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(request, response, next) {
  try {
    await authService.resetPassword(request.validatedBody);
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
}
