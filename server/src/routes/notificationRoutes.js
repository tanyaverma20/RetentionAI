import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/authenticate.js';

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get('/', notificationController.listNotifications);
notificationRouter.patch('/read-all', notificationController.markAllRead);
notificationRouter.patch('/:id/read', notificationController.markRead);
notificationRouter.patch('/:id/archive', notificationController.archiveNotification);
notificationRouter.patch('/:id/dismiss', notificationController.dismissNotification);
notificationRouter.get('/preferences', notificationController.getPreferences);
notificationRouter.patch('/preferences', notificationController.updatePreferences);
