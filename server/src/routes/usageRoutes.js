/**
 * @file usageRoutes.js
 * @description Router for tenant usage and entitlement summary.
 */

import { Router } from 'express';
import * as usageController from '../controllers/usageController.js';
import { authenticate } from '../middlewares/authenticate.js';

export const usageRouter = Router();

usageRouter.get('/summary', authenticate, usageController.getUsageSummary);
