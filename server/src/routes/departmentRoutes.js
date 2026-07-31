/**
 * @file departmentRoutes.js
 * @description Express router for Department management endpoints.
 *
 * Why this file exists
 * --------------------
 * Defines HTTP routes, applies JWT authentication, attaches Zod validation,
 * and enforces Role-Based Access Control (RBAC).
 */

import { Router } from 'express';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });
import { ROLE_NAMES } from '../config/roles.js';
import * as departmentController from '../controllers/departmentController.js';
import { AppError } from '../errors/AppError.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { objectIdSchema } from '../validators/common.js';
import {
  assignDepartmentManagerSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
} from '../validators/departmentValidators.js';

export const departmentRouter = Router();

// Middleware to validate departmentId parameter
const validateDepartmentIdParam = (req, _res, next) => {
  const result = objectIdSchema.safeParse(req.params.departmentId);
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid department ID parameter.'));
  }
  next();
};

// All department endpoints require authentication
departmentRouter.use(authenticate);

// Read endpoints: accessible to authenticated roles
departmentRouter.get('/', departmentController.listDepartments);
departmentRouter.get('/:departmentId', validateDepartmentIdParam, departmentController.getDepartment);

// Write endpoints: restricted to ADMIN and HR_MANAGER
departmentRouter.post(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  validate(createDepartmentSchema),
  departmentController.createDepartment,
);

departmentRouter.post(
  '/bulk',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  upload.single('file'),
  departmentController.bulkUploadDepartments,
);

departmentRouter.patch(
  '/:departmentId',
  validateDepartmentIdParam,
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  validate(updateDepartmentSchema),
  departmentController.updateDepartment,
);

departmentRouter.delete(
  '/:departmentId',
  validateDepartmentIdParam,
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  departmentController.deleteDepartment,
);

// Delete all — same per-department "no active employees" guard as the
// single-delete route above; departments still holding employees are
// skipped and reported, never force-deleted. Registered on the collection
// root (DELETE /), distinct from DELETE /:departmentId.
departmentRouter.delete(
  '/',
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  departmentController.deleteAllDepartments,
);

departmentRouter.post(
  '/:departmentId/manager',
  validateDepartmentIdParam,
  authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER),
  validate(assignDepartmentManagerSchema),
  departmentController.assignManager,
);
