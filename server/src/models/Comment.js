import mongoose from 'mongoose';

/** Comment — Sprint 9 Part 5. Polymorphic, threaded comments across every commentable entity. */

const COMMENTABLE_TYPES = ['EMPLOYEE', 'RECOMMENDATION', 'INTERVENTION', 'TASK', 'REPORT', 'DECISION'];

const commentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    entityType: { type: String, enum: COMMENTABLE_TYPES, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    authorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    mentionedUserIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    attachmentIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Attachment', default: [] },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

commentSchema.index({ entityType: 1, entityId: 1, createdAt: 1 });
commentSchema.index({ parentCommentId: 1 });

export const Comment = mongoose.model('Comment', commentSchema);
export { COMMENTABLE_TYPES };
