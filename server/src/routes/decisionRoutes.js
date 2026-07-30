import express from 'express';
import { ROLE_NAMES } from '../config/roles.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import * as decisionController from '../controllers/decisionController.js';

export const decisionRouter = express.Router();

decisionRouter.use(authenticate);

// Registered BEFORE /:employeeId — otherwise these literal segments would be
// swallowed as an employeeId path parameter.
decisionRouter.get('/dashboard/summary', decisionController.getDashboardSummary);
decisionRouter.get('/dashboard/manager', decisionController.getManagerDashboard);

decisionRouter.get('/:employeeId', decisionController.getDecision);
decisionRouter.get('/:employeeId/history', decisionController.getDecisionHistory);

// HR Manager & Admin only — generate recommendations and act on them.
decisionRouter.use(authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER));
decisionRouter.post('/batch', decisionController.generateBatch);
decisionRouter.post('/:employeeId/generate', decisionController.generateDecision);
decisionRouter.patch('/status/:id', decisionController.updateDecisionStatus);
