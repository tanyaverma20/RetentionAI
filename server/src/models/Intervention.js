import mongoose from 'mongoose';

/**
 * Intervention — Sprint 9 Part 1.
 *
 * The operational HR action created FROM an AI recommendation (Decision).
 * Decision = "what the AI suggests"; Intervention = "the HR workflow that
 * carries it out". Kept as a distinct collection from Decision so the AI
 * recommendation history (Decision, insert-per-generation) is never mutated
 * by operational workflow state.
 */

const INTERVENTION_STATUSES = [
  'PROPOSED',
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

// Transitions allowed out of each status. Enforced in interventionService so
// the timeline can never contain an impossible jump (e.g. DRAFT -> COMPLETED).
const ALLOWED_TRANSITIONS = {
  PROPOSED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  DRAFT: ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ASSIGNED', 'IN_PROGRESS', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: INTERVENTION_STATUSES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    action: { type: String, default: 'STATUS_CHANGED' },
  },
  { _id: false },
);

const aiEvidenceSnapshotSchema = new mongoose.Schema(
  {
    predictionId: { type: String, default: null },
    explanationId: { type: String, default: null },
    decisionTraceId: { type: String, default: null },
    riskScore: { type: Number, default: null },
    riskLevel: { type: String, default: null },
    shapDrivers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    nlpObservations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    policyCitations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    recommendedActionId: { type: String, default: null },
  },
  { _id: false },
);

const interventionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    decisionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Decision', default: null, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 4000 },
    interventionType: { type: String, default: 'GENERAL' },
    priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], required: true, index: true },
    status: { type: String, enum: INTERVENTION_STATUSES, default: 'PROPOSED', index: true },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    requestedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    idempotencyKey: { type: String, default: null, index: true },
    aiEvidenceSnapshot: { type: aiEvidenceSnapshotSchema, default: null },
    baselineRisk: { type: Number, default: null },
    currentRisk: { type: Number, default: null },
    riskDelta: { type: Number, default: null },
    estimatedCost: { type: Number, default: 0 },
    actualCost: { type: Number, default: 0 },
    employeeRetained: { type: Boolean, default: null },
    roiPercentage: { type: Number, default: null },
    outcomeNotes: { type: String, default: '' },
    targetSlaDays: { type: Number, default: 14 },
    slaStatus: { type: String, enum: ['ON_TRACK', 'DUE_SOON', 'OVERDUE', 'COMPLETED'], default: 'ON_TRACK', index: true },
  },
  { timestamps: true },
);

interventionSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
interventionSchema.index({ organizationId: 1, status: 1, priority: 1 });
interventionSchema.index({ organizationId: 1, createdAt: -1 });
interventionSchema.index({ assignedToUserId: 1, status: 1 });
interventionSchema.index({ employeeId: 1, createdAt: -1 });

export const Intervention = mongoose.model('Intervention', interventionSchema);
export { INTERVENTION_STATUSES, ALLOWED_TRANSITIONS };
