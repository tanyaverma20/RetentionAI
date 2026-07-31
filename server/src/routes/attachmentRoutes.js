import { Router } from 'express';
import * as attachmentController from '../controllers/attachmentController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { assignAttachmentId, handleAttachmentUpload } from '../middlewares/uploadMiddleware.js';

export const attachmentRouter = Router();

attachmentRouter.use(authenticate);

attachmentRouter.get('/', authorize('permission:task.read', 'permission:intervention.read', 'permission:comment.write'), attachmentController.listAttachments);
attachmentRouter.get('/:id/download', authorize('permission:task.read', 'permission:intervention.read', 'permission:comment.write'), attachmentController.downloadAttachment);
attachmentRouter.post(
  '/',
  authorize('permission:attachment.write'),
  assignAttachmentId,
  handleAttachmentUpload,
  attachmentController.uploadAttachment,
);
