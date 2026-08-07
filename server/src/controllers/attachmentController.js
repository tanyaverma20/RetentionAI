import { attachmentService } from '../services/attachmentService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

export async function uploadAttachment(req, res, next) {
  try {
    const { entityType, entityId } = req.body || {};
    if (!req.file) throw new AppError(422, 'VALIDATION_ERROR', 'A file is required.');
    const result = await attachmentService.create(
      req.auth.organizationId,
      { entityType, entityId, file: req.file, attachmentId: req.attachmentId },
      req.auth.userId,
    );
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listAttachments(req, res, next) {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) throw new AppError(422, 'VALIDATION_ERROR', 'entityType and entityId are required.');
    const result = await attachmentService.listForEntity(entityType, entityId);
    return sendSuccess(res, 200, { attachments: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function downloadAttachment(req, res, next) {
  try {
    const attachment = await attachmentService.getById(req.params.id);
    return res.download(attachmentService.absolutePath(attachment), attachment.originalName);
  } catch (error) {
    return next(error);
  }
}
