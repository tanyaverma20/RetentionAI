import { Router } from 'express';
import { getHealth, getDetailedHealth } from '../controllers/healthController.js';

export const healthRouter = Router();

healthRouter.get('/health', getHealth);
healthRouter.get('/health/deep', getDetailedHealth);
