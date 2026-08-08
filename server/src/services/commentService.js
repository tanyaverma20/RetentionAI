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

// Prompt 1, Part 9/11 — previously unscoped: any authenticated user of ANY
// organization could list another org's comments just by knowing/guessing
// an entityId (e.g. an employee ObjectId), a real cross-tenant content leak.
// organizationId now comes from the authenticated caller (Part 10), never
// from the entity itself, so this can't be bypassed by picking an entityId
// that happens to belong to a different org.
function listForEntity(organizationId, entityType, entityId) {
  return Comment.find({ organizationId, entityType, entityId, isDeleted: false })
    .sort({ createdAt: 1 })
    .populate('authorUserId', 'name email')
    .populate('mentionedUserIds', 'name email')
    .lean();
}

async function softDelete(commentId, organizationId, requesterUserId, requesterRole) {
  // Same fix as listForEntity: previously only checked the comment ID and
  // author/role, never organization — an ADMIN of org A could delete org
  // B's comments by ID. Ownership mismatch is reported identically to
  // "not found" (Part 14) so it can't be used to confirm a comment ID
  // belongs to another org.
  const comment = await Comment.findOne({ _id: commentId, organizationId });
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
