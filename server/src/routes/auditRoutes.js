import { Router } from 'express';
import * as auditController from '../controllers/auditController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { AUDIT_VIEWER_ROLES } from '../config/roles.js';

export const auditRouter = Router();

auditRouter.use(authenticate, authorize(...AUDIT_VIEWER_ROLES));

auditRouter.get('/', auditController.listAuditLog);
auditRouter.get('/export', auditController.exportAuditLog);
auditRouter.get('/timeline', auditController.getActivityTimeline);
