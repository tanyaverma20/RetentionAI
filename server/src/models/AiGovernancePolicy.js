import mongoose from 'mongoose';

const aiGovernancePolicySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
      default: null,
    },
    hitlThreshold: {
      type: Number,
      default: 0.75,
    },
    disparateImpactMinThreshold: {
      type: Number,
      default: 0.80,
    },
    minCohortSize: {
      type: Number,
      default: 10,
    },
    promptInjectionGuardEnabled: {
      type: Boolean,
      default: true,
    },
    piiRedactionEnabled: {
      type: Boolean,
      default: true,
    },
    toxicityStrictness: {
      type: String,
      enum: ['STRICT', 'MODERATE', 'PERMISSIVE'],
      default: 'STRICT',
    },
    blockedTopics: {
      type: [String],
      default: ['salary_dump', 'unauthorized_export', 'ceo_private_data', 'prompt_exfiltration'],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

aiGovernancePolicySchema.index({ organizationId: 1, version: -1 }, { unique: true });

export const AiGovernancePolicy = mongoose.models.AiGovernancePolicy || mongoose.model('AiGovernancePolicy', aiGovernancePolicySchema);
