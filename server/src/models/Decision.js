import mongoose from 'mongoose';

const RECOMMENDATION_TYPES = [
  'RETENTION_PLAN',
  'PROMOTION_REVIEW',
  'COMPENSATION_REVIEW',
  'TRAINING_RECOMMENDATION',
  'MENTORSHIP_ASSIGNMENT',
  'MANAGER_INTERVENTION',
  'CAREER_DEVELOPMENT',
  'RECOGNITION_PROGRAM',
  'WORKLOAD_ADJUSTMENT',
  'WELLBEING_SUPPORT',
  'ROLE_CHANGE_SUGGESTION',
  'NO_ACTION_REQUIRED',
];

const STATUS_VALUES = ['PENDING', 'ACCEPTED', 'DISMISSED', 'UNDER_REVIEW'];

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_VALUES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const recommendedActionSchema = new mongoose.Schema(
  {
    category: String,
    description: String,
    priority: String,
    policyReference: String,
    expectedImpact: String,
  },
  { _id: false },
);

const decisionSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    recommendationType: {
      type: String,
      enum: RECOMMENDATION_TYPES,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['HIGH', 'MEDIUM', 'LOW'],
      required: true,
      index: true,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    reasoning: {
      type: String,
      default: '',
    },
    // Structured evidence citing Prediction, SHAP, Employee Intelligence,
    // Knowledge Base, and Business Rules — shape is intentionally flexible
    // (Mixed) since each source contributes a different sub-shape and new
    // evidence sources may be added later without a schema migration.
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    affectedFactors: {
      type: [String],
      default: [],
    },
    relatedPolicies: {
      type: [String],
      default: [],
    },
    recommendedActions: {
      type: [recommendedActionSchema],
      default: [],
    },
    expectedOutcome: {
      type: String,
      default: '',
    },
    reviewDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: STATUS_VALUES,
      default: 'PENDING',
      index: true,
    },
    statusHistory: {
      type: [statusHistoryEntrySchema],
      default: [],
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    generatedBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  },
);

// Insert-per-generation (never upserted/overwritten) so decision history is
// preserved — same pattern as Explanation/EmployeeIntelligence.
decisionSchema.index({ employeeId: 1, generatedAt: -1 });
decisionSchema.index({ organizationId: 1, generatedAt: -1 });
decisionSchema.index({ organizationId: 1, status: 1, priority: 1 });

export const Decision = mongoose.model('Decision', decisionSchema);
export { RECOMMENDATION_TYPES, STATUS_VALUES };
