import { Router } from 'express';
import * as organizationController from '../controllers/organizationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { signupSchema } from '../validators/organizationValidators.js';
import { signupRateLimit } from '../middlewares/rateLimits.js';

import { authorize } from '../middlewares/authorize.js';
import * as organizationAdminController from '../controllers/organizationAdminController.js';

export const organizationRouter = Router();

// Public — deliberately NOT behind `authenticate`. This endpoint is how an
// account first comes to exist; requiring a token to reach it would be
// circular.
organizationRouter.post('/signup', signupRateLimit, validate(signupSchema), organizationController.signup);

organizationRouter.get('/me', authenticate, organizationController.getMe);

// Admin-only tenant management endpoints
organizationRouter.get('/settings', authenticate, authorize('ADMIN'), organizationAdminController.getSettings);
organizationRouter.patch('/settings', authenticate, authorize('ADMIN'), organizationAdminController.updateSettings);

organizationRouter.get('/onboarding', authenticate, organizationAdminController.getOnboardingState);
organizationRouter.post('/onboarding/advance', authenticate, authorize('ADMIN'), organizationAdminController.advanceOnboardingState);

organizationRouter.post('/deactivate', authenticate, authorize('ADMIN'), organizationAdminController.deactivateOrganization);
organizationRouter.post('/reactivate', authenticate, authorize('ADMIN'), organizationAdminController.reactivateOrganization);
