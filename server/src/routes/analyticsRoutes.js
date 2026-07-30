/**
 * @file analyticsRoutes.js
 * @description Express router for workforce analytics, KPI cards, Recharts chart datasets, and employee insights.
 *
 * Why this file exists
 * --------------------
 * Defines HTTP routes for analytics endpoints and enforces JWT authentication middleware.
 */

import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authenticate } from '../middlewares/authenticate.js';

export const analyticsRouter = Router();

// All analytics endpoints require authentication
analyticsRouter.use(authenticate);

analyticsRouter.get('/dashboard-summary', analyticsController.getDashboardSummary);
analyticsRouter.get('/kpis', analyticsController.getKpis);
analyticsRouter.get('/departments', analyticsController.getDepartmentStats);
analyticsRouter.get('/monthly-trends', analyticsController.getMonthlyTrends);
analyticsRouter.get('/demographics', analyticsController.getDemographics);
analyticsRouter.get('/employees', analyticsController.getEmployeeInsights);
analyticsRouter.get('/hr-metrics', analyticsController.getHrMetrics);

// Sprint 2 workforce intelligence contract. These aliases are also mounted at
// /api/v1/dashboard so clients can use the concise dashboard endpoints.
analyticsRouter.get('/overview', analyticsController.getDashboardSummary);
analyticsRouter.get('/performance', analyticsController.getPerformanceAnalytics);
analyticsRouter.get('/attendance', analyticsController.getAttendanceAnalytics);
analyticsRouter.get('/training', analyticsController.getTrainingAnalytics);

// AI Global Analytics Routes
analyticsRouter.get('/ai/feature-importance', analyticsController.getAiFeatureImportance);
analyticsRouter.get('/ai/plots/global/:plotType', analyticsController.getAiGlobalPlot);
