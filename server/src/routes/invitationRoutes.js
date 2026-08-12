/**
 * @file invitationRoutes.js
 * @description Express router for user invitation management.
 */

import { Router } from 'express';
import * as invitationController from '../controllers/invitationController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

export const invitationRouter = Router();

// Public acceptance endpoint
invitationRouter.post('/accept', invitationController.acceptInvitation);

// Admin-only invitation management
invitationRouter.post('/', authenticate, authorize('ADMIN'), invitationController.createInvitation);
invitationRouter.get('/', authenticate, authorize('ADMIN'), invitationController.listInvitations);
invitationRouter.delete('/:id', authenticate, authorize('ADMIN'), invitationController.revokeInvitation);
