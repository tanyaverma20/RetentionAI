import { Router } from 'express';
import * as commentController from '../controllers/commentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

export const commentRouter = Router();

commentRouter.use(authenticate);

commentRouter.get('/', authorize('permission:comment.write'), commentController.listComments);
commentRouter.post('/', authorize('permission:comment.write'), commentController.createComment);
commentRouter.delete('/:id', authorize('permission:comment.write'), commentController.deleteComment);
