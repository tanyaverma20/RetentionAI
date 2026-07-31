import mongoose from 'mongoose';

/**
 * Approval — Sprint 9 Part 3.
 *
 * One document per approval CHAIN attached to an Intervention (polymorphic
 * entityType/entityId so it can later gate Tasks too without a new model).
 * The chain's required roles are resolved by approvalService based on the
 * entity's priority (configurable in code, not hard-coded per-entity), and
 * each level records who decided, when, what, and why — the Part 3 mandate.
 */

const CHAIN_ROLES = ['HR_MANAGER', 'HR_DIRECTOR', 'CHRO'];
const LEVEL_DECISIONS = ['PENDING', 'APPROVED', 'REJECTED'];
const OVERALL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const chainLevelSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    role: { type: String, enum: CHAIN_ROLES, required: true },
    decision: { type: String, enum: LEVEL_DECISIONS, default: 'PENDING' },
    approverUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    reason: { type: String, default: '' },
  },
  { _id: false },
);

const approvalSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    entityType: { type: String, enum: ['INTERVENTION', 'TASK'], required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    chain: { type: [chainLevelSchema], default: [] },
    currentLevel: { type: Number, default: 0 },
    overallStatus: { type: String, enum: OVERALL_STATUSES, default: 'PENDING', index: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

approvalSchema.index({ entityType: 1, entityId: 1 }, { unique: true });
approvalSchema.index({ organizationId: 1, overallStatus: 1, createdAt: -1 });

export const Approval = mongoose.model('Approval', approvalSchema);
export { CHAIN_ROLES, LEVEL_DECISIONS, OVERALL_STATUSES };
