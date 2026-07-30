import mongoose from 'mongoose';

const DOCUMENT_TYPES = [
  'HR_POLICY',
  'EMPLOYEE_HANDBOOK',
  'LEAVE_POLICY',
  'PROMOTION_POLICY',
  'COMPENSATION_POLICY',
  'PERFORMANCE_GUIDELINES',
  'TRAINING_DOCUMENT',
  'COMPLIANCE_DOCUMENT',
  'SOP',
  'OTHER',
];

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    documentType: {
      type: String,
      enum: DOCUMENT_TYPES,
      default: 'OTHER',
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadDate: {
      type: Date,
      default: Date.now,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    // Path relative to server/uploads/documents — never a client-controlled
    // path, and never passed to the AI service directly from a request body.
    filePath: {
      type: String,
      required: true,
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PROCESSING', 'INDEXED', 'FAILED'],
      default: 'PROCESSING',
      index: true,
    },
    chunkCount: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

knowledgeDocumentSchema.index({ organizationId: 1, uploadDate: -1 });
knowledgeDocumentSchema.index({ organizationId: 1, filename: 1 });

export const KnowledgeDocument = mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
export { DOCUMENT_TYPES };
