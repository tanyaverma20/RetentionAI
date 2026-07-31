/**
 * @file userRoutes.js
 * @description Express router for user-management endpoints.
 *
 * Why this file exists
 * --------------------
 * Defines the HTTP API surface for User management. These endpoints are strictly
 * administrative (creating, updating, assigning roles, and deactivating accounts).
 * Self-service actions (like changing one's own password) belong in `authRoutes`.
 *
 * Security decisions
 * ------------------
 * - Every route requires `authenticate` (must have a valid JWT session).
 * - Every route requires `authorize(ROLE_NAMES.ADMIN)` (strictly restricted to
 *   System Administrators).
 * - Every route with a body requires a strict Zod `validate` schema, preventing
 *   mass-assignment and structural attacks.
 * - Route parameters (userId) are validated strictly to prevent injection.
 */

import { Router } from 'express';
import { ROLE_NAMES } from '../config/roles.js';
import * as userController from '../controllers/userController.js';
import { AppError } from '../errors/AppError.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { validate } from '../middlewares/validate.js';
import { objectIdSchema } from '../validators/common.js';
import {
  assignRoleSchema,
  createUserSchema,
  deactivateUserSchema,
  updateUserSchema,
} from '../validators/userValidators.js';

export const userRouter = Router();

// Middleware to validate userId param on specific routes
const validateUserIdParam = (req, _res, next) => {
  const result = objectIdSchema.safeParse(req.params.userId);
  if (!result.success) {
    return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid user ID parameter.'));
  }
  next();
};

// Apply authentication and admin-only authorization to all routes in this router.
userRouter.use(authenticate, authorize(ROLE_NAMES.ADMIN));

userRouter.post('/', validate(createUserSchema), userController.createUser);

userRouter.get('/', userController.listUsers);

userRouter.get('/:userId', validateUserIdParam, userController.getUser);

userRouter.patch(
  '/:userId',
  validateUserIdParam,
  validate(updateUserSchema),
  userController.updateUser,
);

userRouter.post(
  '/:userId/role',
  validateUserIdParam,
  validate(assignRoleSchema),
  userController.assignRole,
);

userRouter.post(
  '/:userId/deactivate',
  validateUserIdParam,
  validate(deactivateUserSchema),
  userController.deactivateUser,
);
