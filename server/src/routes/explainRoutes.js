import express from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  explainSingle,
  getExplanation,
  explainBatch,
  getGlobalFeatureImportance,
  getDepartmentRiskDrivers,
} from '../controllers/explainController.js';

export const explainRouter = express.Router();

// All routes require authentication
explainRouter.use(authenticate);

// Available to all authenticated users — used by Employee Profile / Dashboard
explainRouter.get('/global/feature-importance', getGlobalFeatureImportance);
explainRouter.get('/global/department-drivers', getDepartmentRiskDrivers);
explainRouter.get('/:id', getExplanation);

// HR Manager & Admin only — trigger new explanations
explainRouter.use(authorize('HR_MANAGER', 'ADMIN'));
explainRouter.post('/batch', explainBatch);
explainRouter.post('/:id', explainSingle);
