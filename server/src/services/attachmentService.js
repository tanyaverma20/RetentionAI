import path from 'path';
import { Attachment, ATTACHABLE_TYPES } from '../models/Attachment.js';
import { Task } from '../models/Task.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from './auditService.js';
import { WORKFLOW_ATTACHMENTS_DIR } from '../middlewares/uploadMiddleware.js';

async function create(organizationId, { entityType, entityId, file, attachmentId }, uploadedByUserId) {
  if (!ATTACHABLE_TYPES.includes(entityType)) {
    throw new AppError(400, 'INVALID_ENTITY_TYPE', `entityType must be one of: ${ATTACHABLE_TYPES.join(', ')}`);
  }
  if (!entityId || !file) {
    throw new AppError(422, 'VALIDATION_ERROR', 'entityId and a file are required.');
  }

  const attachment = await Attachment.create({
    _id: attachmentId,
    organizationId,
    entityType,
    entityId,
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storagePath: path.join('attachments', file.filename),
    uploadedByUserId,
  });

  if (entityType === 'TASK') {
    await Task.findByIdAndUpdate(entityId, { $addToSet: { attachmentIds: attachment._id } });
  }

  await recordAudit(organizationId, 'ATTACHMENT_UPLOADED', uploadedByUserId, {
    entityType,
    entityId,
    context: { filename: file.originalname, sizeBytes: file.size },
  });

  return attachment;
}

function listForEntity(entityType, entityId) {
  return Attachment.find({ entityType, entityId }).sort({ uploadedAt: -1 }).populate('uploadedByUserId', 'name email').lean();
}

async function getById(attachmentId) {
  const attachment = await Attachment.findById(attachmentId).lean();
  if (!attachment) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
  return attachment;
}

function absolutePath(attachment) {
  return path.join(WORKFLOW_ATTACHMENTS_DIR, attachment.filename);
}

export const attachmentService = { create, listForEntity, getById, absolutePath };
export default attachmentService;
