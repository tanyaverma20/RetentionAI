import mongoose from 'mongoose';

const aiBiasAuditLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    auditVersion: {
      type: Number,
      default: 1,
    },
    modelVersion: {
      type: String,
      required: true,
    },
    policyVersion: {
      type: Number,
      required: true,
    },
    demographicCategory: {
      type: String,
      enum: ['GENDER', 'AGE_GROUP', 'DEPARTMENT', 'TENURE_COHORT'],
      required: true,
    },
    disparateImpactRatio: {
      type: Number,
      required: true,
    },
    demographicParityScore: {
      type: Number,
      required: true,
    },
    equalizedOddsScore: {
      type: Number,
      default: null,
    },
    sampleSize: {
      type: Number,
      required: true,
    },
    cohortDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['PASS', 'WARNING', 'FAIL', 'INSUFFICIENT_DATA'],
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

aiBiasAuditLogSchema.index({ organizationId: 1, calculatedAt: -1 });

export const AiBiasAuditLog = mongoose.models.AiBiasAuditLog || mongoose.model('AiBiasAuditLog', aiBiasAuditLogSchema);
