import { Router } from 'express';
import { EXECUTIVE_ROLES } from '../config/roles.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import * as executiveController from '../controllers/executiveController.js';

export const executiveRouter = Router();

// Part 10 — Security: the entire Executive Workforce Intelligence Center is
// restricted to ADMIN, HR_DIRECTOR, CHRO, CEO (see config/roles.js's
// EXECUTIVE_ROLES) — no operational HR_MANAGER/DEPARTMENT_MANAGER access,
// since this surface is strategic/company-wide, not per-employee HR action.
executiveRouter.use(authenticate, authorize(...EXECUTIVE_ROLES));

executiveRouter.get('/dashboard', executiveController.getDashboard);
executiveRouter.get('/insights', executiveController.getInsights);
executiveRouter.get('/intervention-analytics', executiveController.getInterventionAnalytics);
executiveRouter.get('/roi', executiveController.getRoiAnalytics);
executiveRouter.get('/forecast', executiveController.getForecast);
executiveRouter.get('/reports/:format', executiveController.exportReport);

executiveRouter.get('/alerts', executiveController.listAlerts);
executiveRouter.post('/alerts/generate', executiveController.generateAlerts);
executiveRouter.patch('/alerts/:id/transition', executiveController.transitionAlert);
executiveRouter.patch('/alerts/:id/dismiss', executiveController.dismissAlert);
executiveRouter.patch('/alerts/:id/review', executiveController.reviewAlert);
executiveRouter.patch('/alerts/:id/assign', executiveController.assignAlert);
