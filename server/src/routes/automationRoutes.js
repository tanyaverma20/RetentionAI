import { Router } from 'express';
import * as automationController from '../controllers/automationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { AUTOMATION_ADMIN_ROLES } from '../config/roles.js';

export const automationRouter = Router();

automationRouter.use(authenticate, authorize(...AUTOMATION_ADMIN_ROLES));

automationRouter.get('/jobs', automationController.listJobs);
automationRouter.post('/jobs/:jobName/run', automationController.runJobNow);
