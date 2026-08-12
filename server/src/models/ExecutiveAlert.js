import mongoose from 'mongoose';

/**
 * ExecutiveAlert — Sprint 8, Part 8.
 *
 * Rule-based alerts synthesized from EXISTING data (Prediction, Decision,
 * EmployeeIntelligence, PromotionHistory) — no new ML model, no new data
 * collection. Insert-per-generation is intentionally NOT used here (unlike
 * Explanation/Decision/EmployeeIntelligence's history-preserving pattern) —
 * an alert is a single mutable workflow item (like a support ticket), not a
 * point-in-time AI output, so it is updated in place as HR triages it.
 */

const ALERT_TYPES = [
  'CRITICAL_ATTRITION_SPIKE',
  'DEPARTMENT_BURNOUT',
  'PROMOTION_DELAY',
  'NEGATIVE_SENTIMENT_SURGE',
  'POLICY_VIOLATION_TREND',
  'REPEATED_MANAGER_COMPLAINTS',
  'SLA_BREACH_ESCALATION',
];

const SEVERITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_VALUES = ['OPEN', 'ACKNOWLEDGED', 'IN_REVIEW', 'RESOLVED', 'DISMISSED', 'REVIEWED'];

const ALLOWED_ALERT_TRANSITIONS = {
  OPEN: ['ACKNOWLEDGED', 'IN_REVIEW', 'DISMISSED', 'REVIEWED'],
  ACKNOWLEDGED: ['IN_REVIEW', 'RESOLVED', 'DISMISSED'],
  IN_REVIEW: ['RESOLVED', 'DISMISSED'],
  REVIEWED: ['IN_REVIEW', 'RESOLVED', 'DISMISSED'],
  RESOLVED: ['OPEN'],
  DISMISSED: ['OPEN'],
};

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: { type: String, enum: STATUS_VALUES, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    action: { type: String, default: 'STATUS_CHANGED' },
  },
  { _id: false },
);

const executiveAlertSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    alertType: { type: String, enum: ALERT_TYPES, required: true, index: true },
    severity: { type: String, enum: SEVERITY_VALUES, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    interventionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Intervention', default: null, index: true },
    idempotencyKey: { type: String, default: null, index: true },
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: STATUS_VALUES, default: 'OPEN', index: true },
    statusHistory: { type: [statusHistoryEntrySchema], default: [] },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acknowledgedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acknowledgedAt: { type: Date, default: null },
    reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    resolvedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: '' },
    dismissedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dismissedAt: { type: Date, default: null },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

executiveAlertSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
executiveAlertSchema.index({ organizationId: 1, status: 1, severity: -1, generatedAt: -1 });
executiveAlertSchema.index({ organizationId: 1, alertType: 1, departmentId: 1, employeeId: 1, status: 1 });

export const ExecutiveAlert = mongoose.model('ExecutiveAlert', executiveAlertSchema);
export { ALERT_TYPES, SEVERITY_VALUES, STATUS_VALUES as ALERT_STATUS_VALUES, ALLOWED_ALERT_TRANSITIONS };
