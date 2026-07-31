import mongoose from 'mongoose';

/** Attachment — Sprint 9 Part 10. Metadata row for files uploaded to Tasks, Interventions, Reports, Comments. */

const ATTACHABLE_TYPES = ['TASK', 'INTERVENTION', 'REPORT', 'COMMENT'];

const attachmentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    entityType: { type: String, enum: ATTACHABLE_TYPES, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storagePath: { type: String, required: true },
    uploadedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

attachmentSchema.index({ entityType: 1, entityId: 1, uploadedAt: -1 });

export const Attachment = mongoose.model('Attachment', attachmentSchema);
export { ATTACHABLE_TYPES };
