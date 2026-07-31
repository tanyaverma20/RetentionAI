import { Router } from 'express';
import * as workflowController from '../controllers/workflowController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { WORKFLOW_DASHBOARD_ROLES } from '../config/roles.js';

export const workflowRouter = Router();

workflowRouter.use(authenticate, authorize(...WORKFLOW_DASHBOARD_ROLES));

workflowRouter.get('/dashboard', workflowController.getDashboard);
