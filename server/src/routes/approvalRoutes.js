import { Router } from 'express';
import * as approvalController from '../controllers/approvalController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

export const approvalRouter = Router();

approvalRouter.use(authenticate);

approvalRouter.get('/', authorize('permission:intervention.read', 'permission:task.read'), approvalController.getApprovalForEntity);
approvalRouter.patch('/:id/decide', authorize('permission:approval.decide'), approvalController.decideApproval);
