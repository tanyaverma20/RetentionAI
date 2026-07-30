import express from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  generateEmployeeIntelligence,
  generateEmployeeIntelligenceBatch,
  getEmployeeIntelligence,
  getEmployeeIntelligenceDashboard,
} from '../controllers/employeeIntelligenceController.js';

export const employeeIntelligenceRouter = express.Router();

// All routes require authentication
employeeIntelligenceRouter.use(authenticate);

// Available to all authenticated users — used by Dashboard / Employee Profile
employeeIntelligenceRouter.get('/dashboard/summary', getEmployeeIntelligenceDashboard);
employeeIntelligenceRouter.get('/:id', getEmployeeIntelligence);

// HR Manager & Admin only — trigger new analysis
employeeIntelligenceRouter.use(authorize('HR_MANAGER', 'ADMIN'));
// Registered BEFORE POST /:id — otherwise "batch" would be swallowed as :id.
employeeIntelligenceRouter.post('/batch', generateEmployeeIntelligenceBatch);
employeeIntelligenceRouter.post('/:id', generateEmployeeIntelligence);
