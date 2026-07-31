import { Comment, COMMENTABLE_TYPES } from '../models/Comment.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from './auditService.js';
import { notify } from './notificationService.js';

async function create(organizationId, payload, authorUserId) {
  const { entityType, entityId, body, parentCommentId, mentionedUserIds } = payload;
  if (!COMMENTABLE_TYPES.includes(entityType)) {
    throw new AppError(400, 'INVALID_ENTITY_TYPE', `entityType must be one of: ${COMMENTABLE_TYPES.join(', ')}`);
  }
  if (!entityId || !body?.trim()) {
    throw new AppError(422, 'VALIDATION_ERROR', 'entityId and body are required.');
  }

  const comment = await Comment.create({
    organizationId,
    entityType,
    entityId,
    authorUserId,
    body: body.trim(),
    mentionedUserIds: mentionedUserIds || [],
    parentCommentId: parentCommentId || null,
  });

  for (const mentionedUserId of comment.mentionedUserIds) {
    if (String(mentionedUserId) === String(authorUserId)) continue;
    await notify(organizationId, mentionedUserId, {
      type: 'GENERIC',
      severity: 'LOW',
      title: 'You were mentioned in a comment',
      message: comment.body.slice(0, 200),
      entityType,
      entityId,
    });
  }

  await recordAudit(organizationId, 'COMMENT_CREATED', authorUserId, { entityType, entityId, context: { commentId: comment._id } });

  return Comment.findById(comment._id).populate('authorUserId', 'name email').lean();
}

function listForEntity(entityType, entityId) {
  return Comment.find({ entityType, entityId, isDeleted: false })
    .sort({ createdAt: 1 })
    .populate('authorUserId', 'name email')
    .populate('mentionedUserIds', 'name email')
    .lean();
}

async function softDelete(commentId, requesterUserId, requesterRole) {
  const comment = await Comment.findById(commentId);
  if (!comment) throw new AppError(404, 'COMMENT_NOT_FOUND', 'Comment not found.');
  if (String(comment.authorUserId) !== String(requesterUserId) && requesterRole !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'You can only delete your own comments.');
  }
  comment.isDeleted = true;
  comment.body = '[deleted]';
  await comment.save();
  return comment;
}

export const commentService = { create, listForEntity, softDelete };
export default commentService;
