import { Router } from 'express';
import * as organizationController from '../controllers/organizationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { signupSchema } from '../validators/organizationValidators.js';
import { signupRateLimit } from '../middlewares/rateLimits.js';

export const organizationRouter = Router();

// Public — deliberately NOT behind `authenticate`. This endpoint is how an
// account first comes to exist; requiring a token to reach it would be
// circular.
organizationRouter.post('/signup', signupRateLimit, validate(signupSchema), organizationController.signup);

organizationRouter.get('/me', authenticate, organizationController.getMe);
