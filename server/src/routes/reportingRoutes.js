import { Router } from 'express';
import * as reportingController from '../controllers/reportingController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

export const reportingRouter = Router();

// Only Admins and HR Managers can export reports
reportingRouter.use(authenticate);
reportingRouter.use(authorize('ADMIN', 'HR_MANAGER'));

reportingRouter.get('/employees/csv', reportingController.exportEmployeeSummary);
reportingRouter.get('/departments/csv', reportingController.exportDepartmentSummary);
reportingRouter.get('/attendance/csv', reportingController.exportAttendanceReport);
reportingRouter.get('/performance/csv', reportingController.exportPerformanceReport);
reportingRouter.get('/training/csv', reportingController.exportTrainingReport);
reportingRouter.get('/promotions/csv', reportingController.exportPromotionReport);
