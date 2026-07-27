import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middlewares/authenticate.js';
import {
  forgotPasswordRateLimit,
  loginRateLimit,
  passwordChangeRateLimit,
  refreshRateLimit,
  resetPasswordRateLimit,
} from '../middlewares/rateLimits.js';
import { validate } from '../middlewares/validate.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  resetPasswordSchema,
} from '../validators/authValidators.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimit, validate(loginSchema), authController.login);
authRouter.post('/logout', authenticate, validate(logoutSchema), authController.logout);
authRouter.post('/refresh', refreshRateLimit, validate(refreshSchema), authController.refresh);
authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimit,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  resetPasswordRateLimit,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
authRouter.post(
  '/change-password',
  authenticate,
  passwordChangeRateLimit,
  validate(changePasswordSchema),
  authController.changePassword,
);
authRouter.get('/me', authenticate, authController.getCurrentUser);
