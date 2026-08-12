import mongoose from 'mongoose';

/**
 * AuditLog — Sprint 8 Part 11, extended in Sprint 9 Part 6/9 into the
 * combined backing store for both the enterprise Activity Timeline and the
 * Audit Log viewer. One append-only collection rather than two, since an
 * "activity" and an "audit entry" are the same fact (who did what, when) —
 * only the read-side query/filter shape differs between the two UIs.
 */

const AUDIT_ACTIONS = [
  // Phase 1 — SaaS multi-tenancy (docs/PLATFORM_BLUEPRINT.md)
  'ORGANIZATION_CREATED',
  // Sprint 8 — executive
  'EXECUTIVE_DASHBOARD_EXPORT',
  'EXECUTIVE_REPORT_GENERATED',
  'EXECUTIVE_FORECAST_GENERATED',
  'EXECUTIVE_ALERT_ACKNOWLEDGED',
  'EXECUTIVE_ALERT_TRANSITIONED',
  'EXECUTIVE_ALERT_CREATED',
  'EXECUTIVE_ALERT_GENERATED',
  // Sprint 9 — AI pipeline events (Node-side, recorded where Node persists the result)
  'PREDICTION_GENERATED',
  'SHAP_GENERATED',
  'EMPLOYEE_INTELLIGENCE_GENERATED',
  'KNOWLEDGE_REFERENCED',
  'RECOMMENDATION_GENERATED',
  'RECOMMENDATION_STATUS_CHANGED',
  // Sprint 9 — workflow
  'INTERVENTION_CREATED',
  'INTERVENTION_STATUS_CHANGED',
  'TASK_CREATED',
  'TASK_STATUS_CHANGED',
  'TASK_ASSIGNED',
  'TASK_ESCALATED',
  'APPROVAL_SUBMITTED',
  'COMMENT_CREATED',
  'NOTIFICATION_CREATED',
  'ATTACHMENT_UPLOADED',
  'AUTOMATION_JOB_RUN',
  'REPORT_EXPORTED',
  // Sprint 9 — identity / access
  'USER_LOGIN',
  'USER_LOGOUT',
  'RBAC_DENIED',
  // Prompt 9 — AI Observability & Governance
  'AI_TELEMETRY_EXPORT',
  'DRIFT_ALERT_TRIGGERED',
  'EVAL_RUN',
  // Prompt 10 — Enterprise AI Safety & Governance
  'GUARDRAIL_VIOLATION_BLOCKED',
  'BIAS_AUDIT_EXECUTED',
  'GOVERNANCE_POLICY_UPDATED',
  'HITL_REVIEW_COMPLETED',
  'REDTEAM_EVAL_RUN',
  'GOVERNANCE_EVIDENCE_EXPORTED',
];

const auditLogSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    userId: { type: mongoose.Schema.Types.Mixed, required: false },
    entityType: { type: String, default: null, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    ip: { type: String, default: null },
    changes: {
      old: { type: mongoose.Schema.Types.Mixed, default: undefined },
      new: { type: mongoose.Schema.Types.Mixed, default: undefined },
    },
    // Free-form context for the action (e.g. { format: 'PDF', filters: {...} }).
    context: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export { AUDIT_ACTIONS };
