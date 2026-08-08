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
    // Part 9/11 — scoped by organizationId too: without this, a caller
    // could upload a file tagged entityType:'TASK' with another org's task
    // ID as entityId and get their attachment linked into that foreign
    // task's attachmentIds array — an unauthorized cross-tenant write, even
    // though the Attachment record itself stayed correctly org-tagged.
    await Task.findOneAndUpdate({ _id: entityId, organizationId }, { $addToSet: { attachmentIds: attachment._id } });
  }

  await recordAudit(organizationId, 'ATTACHMENT_UPLOADED', uploadedByUserId, {
    entityType,
    entityId,
    context: { filename: file.originalname, sizeBytes: file.size },
  });

  return attachment;
}

// Prompt 1, Part 9/11/15 — previously unscoped by organization on both
// listing and single-record lookup. getById() in particular backs
// downloadAttachment(), which was letting any authenticated user of ANY
// org download ANY org's uploaded file by ID (Part 15: file upload/access
// security) — this is the highest-severity fix in this pass since it's a
// direct cross-tenant file content leak, not just metadata.
function listForEntity(organizationId, entityType, entityId) {
  return Attachment.find({ organizationId, entityType, entityId }).sort({ uploadedAt: -1 }).populate('uploadedByUserId', 'name email').lean();
}

async function getById(attachmentId, organizationId) {
  const attachment = await Attachment.findOne({ _id: attachmentId, organizationId }).lean();
  if (!attachment) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Attachment not found.');
  return attachment;
}

function absolutePath(attachment) {
  return path.join(WORKFLOW_ATTACHMENTS_DIR, attachment.filename);
}

export const attachmentService = { create, listForEntity, getById, absolutePath };
export default attachmentService;
