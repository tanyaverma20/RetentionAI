import { Router } from 'express';
import { getHealth, getDetailedHealth, getReadiness } from '../controllers/healthController.js';

export const healthRouter = Router();

healthRouter.get('/health', getHealth);
healthRouter.get('/ready', getReadiness);
healthRouter.get('/health/deep', getDetailedHealth);
