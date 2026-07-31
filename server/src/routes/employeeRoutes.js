/**
 * @file employeeRoutes.js
 * @description Express router for Employee management endpoints.
 *
 * Why this file exists
 * --------------------
 * Defines HTTP routes for employee listing, profile access, editing, soft-deletion,
 * restoration, and CSV bulk import.
 */

import { Router } from 'express';
import { ROLE_NAMES } from '../config/roles.js';
import * as employeeController from '../controllers/employeeController.js';
import { AppError } from '../errors/AppError.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { handleProfilePictureUpload } from '../middlewares/uploadMiddleware.js';
import { validate } from '../middlewares/validate.js';
import { objectIdSchema } from '../validators/common.js';
import {
  bulkImportSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
} from '../validators/employeeValidators.js';

export const employeeRouter = Router();

const validateEmployeeIdParam = (req, _res, next) => {
  const result = objectIdSchema.safeParse(req.params.employeeId);
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid employee ID parameter.'));
  }
  next();
};

// All employee endpoints require authentication
employeeRouter.use(authenticate);

// Bulk import endpoint (restricted to ADMIN and HR_MANAGER)
employeeRouter.post(
  '/bulk-import',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  validate(bulkImportSchema),
  employeeController.bulkImport,
);

// Delete all — soft-deletes every active employee at once (reversible, same
// as the single-employee delete below). Registered on the collection root
// (DELETE /), distinct from DELETE /:employeeId — no route-ordering conflict.
employeeRouter.delete(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  employeeController.bulkSoftDeleteAllEmployees,
);

// List employees (scope enforced inside controller/service based on user role)
employeeRouter.get('/', employeeController.listEmployees);

// 360° profile — aggregates all HR sub-collections for one employee
employeeRouter.get('/:employeeId/360', validateEmployeeIdParam, employeeController.getEmployee360);

// AI Explainability — fetch SHAP insights for attrition risk
employeeRouter.get('/:employeeId/explain', validateEmployeeIdParam, employeeController.explainEmployeeRisk);

// Merged AI surface — Prediction + Explanation + Employee Intelligence in one response
employeeRouter.get('/:employeeId/ai-insights', validateEmployeeIdParam, employeeController.getEmployeeAiInsights);

// View employee profile (scope checked inside service layer)
employeeRouter.get('/:employeeId', validateEmployeeIdParam, employeeController.getEmployeeProfile);

// Write endpoints: restricted to ADMIN and HR_MANAGER
employeeRouter.post(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  validate(createEmployeeSchema),
  employeeController.createEmployee,
);

employeeRouter.patch(
  '/:employeeId',
  validateEmployeeIdParam,
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  validate(updateEmployeeSchema),
  employeeController.updateEmployee,
);

employeeRouter.delete(
  '/:employeeId',
  validateEmployeeIdParam,
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  employeeController.softDeleteEmployee,
);

employeeRouter.post(
  '/:employeeId/restore',
  validateEmployeeIdParam,
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  employeeController.restoreEmployee,
);

// Avatar upload
employeeRouter.post(
  '/:employeeId/avatar',
  validateEmployeeIdParam,
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  handleProfilePictureUpload,
  employeeController.uploadAvatar,
);

// Employee Timeline
employeeRouter.get(
  '/:employeeId/timeline',
  validateEmployeeIdParam,
  employeeController.getEmployeeTimeline,
);
