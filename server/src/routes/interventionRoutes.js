import { Router } from 'express';
import * as interventionController from '../controllers/interventionController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

export const interventionRouter = Router();

interventionRouter.use(authenticate);

interventionRouter.get('/', authorize('permission:intervention.read'), interventionController.listInterventions);
interventionRouter.get('/overdue', authorize('permission:intervention.read'), interventionController.listOverdueInterventions);
interventionRouter.get('/:id', authorize('permission:intervention.read'), interventionController.getIntervention);
interventionRouter.post('/', authorize('permission:intervention.write'), interventionController.createIntervention);
interventionRouter.post('/from-decision', authorize('permission:intervention.write'), interventionController.createFromDecision);
interventionRouter.patch('/:id/status', authorize('permission:intervention.write'), interventionController.transitionIntervention);
