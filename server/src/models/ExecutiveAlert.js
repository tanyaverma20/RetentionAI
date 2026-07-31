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
];

const SEVERITY_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUS_VALUES = ['OPEN', 'REVIEWED', 'DISMISSED'];

const executiveAlertSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    alertType: { type: String, enum: ALERT_TYPES, required: true, index: true },
    severity: { type: String, enum: SEVERITY_VALUES, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    // Which department/employee this alert concerns, if applicable — both
    // optional since some alerts (e.g. a company-wide sentiment surge) are
    // not scoped to a single department or employee.
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    // The raw metric(s) that triggered this alert, for auditability —
    // intentionally Mixed since each alert type cites different evidence.
    evidence: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: STATUS_VALUES, default: 'OPEN', index: true },
    assignedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    dismissedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dismissedAt: { type: Date, default: null },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

executiveAlertSchema.index({ organizationId: 1, status: 1, severity: -1, generatedAt: -1 });
// Prevents duplicate alerts for the exact same (type, department/employee)
// pair from piling up on every dashboard load — the generator upserts by
// this key while an alert is still OPEN.
executiveAlertSchema.index({ organizationId: 1, alertType: 1, departmentId: 1, employeeId: 1, status: 1 });

export const ExecutiveAlert = mongoose.model('ExecutiveAlert', executiveAlertSchema);
export { ALERT_TYPES, SEVERITY_VALUES, STATUS_VALUES as ALERT_STATUS_VALUES };
