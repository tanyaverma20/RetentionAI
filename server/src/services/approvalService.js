import { Approval, CHAIN_ROLES } from '../models/Approval.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from './auditService.js';

/**
 * Configurable approval chain resolution — Sprint 9 Part 3. Chain length
 * scales with priority so low-stakes interventions don't need CHRO sign-off.
 * Kept as a plain function (not a DB-driven config) since "configurable"
 * here means the organization can change the mapping in code without
 * touching the workflow engine itself — no UI-driven chain builder was
 * requested.
 */
export function resolveChainRoles(priority) {
  if (priority === 'HIGH') return CHAIN_ROLES; // HR_MANAGER -> HR_DIRECTOR -> CHRO
  if (priority === 'MEDIUM') return CHAIN_ROLES.slice(0, 2); // HR_MANAGER -> HR_DIRECTOR
  return CHAIN_ROLES.slice(0, 1); // HR_MANAGER only
}

/** Idempotent — re-requesting approval for the same entity returns the existing chain. */
export async function createChain(organizationId, entityType, entityId, priority, createdByUserId) {
  const existing = await Approval.findOne({ entityType, entityId });
  if (existing) return existing;

  const roles = resolveChainRoles(priority);
  const chain = roles.map((role, index) => ({ level: index + 1, role, decision: 'PENDING' }));

  return Approval.create({
    organizationId,
    entityType,
    entityId,
    chain,
    currentLevel: 1,
    overallStatus: 'PENDING',
    createdByUserId,
  });
}

export function getByEntity(entityType, entityId) {
  return Approval.findOne({ entityType, entityId }).lean();
}

export function getById(approvalId) {
  return Approval.findById(approvalId);
}

/**
 * Record one level's decision. The decider's role must match the chain's
 * current pending level exactly — this is the real enforcement point for
 * "HR Manager approval, HR Director approval, CHRO approval" (Part 3), not
 * just a generic permission string.
 */
export async function decide(approvalId, deciderUserId, deciderRole, decision, reason = '') {
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    throw new AppError(400, 'INVALID_DECISION', 'decision must be APPROVED or REJECTED.');
  }

  const approval = await Approval.findById(approvalId);
  if (!approval) throw new AppError(404, 'APPROVAL_NOT_FOUND', 'Approval chain not found.');
  if (approval.overallStatus !== 'PENDING') {
    throw new AppError(409, 'APPROVAL_ALREADY_DECIDED', `This approval chain is already ${approval.overallStatus}.`);
  }

  const level = approval.chain.find((c) => c.level === approval.currentLevel);
  if (!level) throw new AppError(500, 'APPROVAL_CHAIN_CORRUPT', 'Approval chain has no current level.');
  if (level.role !== deciderRole) {
    throw new AppError(403, 'WRONG_APPROVAL_LEVEL', `This approval currently requires a decision from ${level.role}.`);
  }

  level.decision = decision;
  level.approverUserId = deciderUserId;
  level.decidedAt = new Date();
  level.reason = reason;

  if (decision === 'REJECTED') {
    approval.overallStatus = 'REJECTED';
  } else if (approval.currentLevel >= approval.chain.length) {
    approval.overallStatus = 'APPROVED';
  } else {
    approval.currentLevel += 1;
  }

  await approval.save();
  await recordAudit(approval.organizationId, 'APPROVAL_SUBMITTED', deciderUserId, {
    entityType: approval.entityType,
    entityId: approval.entityId,
    context: { level: level.level, role: level.role, decision, reason },
  });

  return approval;
}

export const approvalService = { resolveChainRoles, createChain, getByEntity, getById, decide };
export default approvalService;
