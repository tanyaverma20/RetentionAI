import crypto from 'crypto';
import { Intervention, INTERVENTION_STATUSES, ALLOWED_TRANSITIONS } from '../models/Intervention.js';
import { Employee } from '../models/Employee.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from './auditService.js';
import { logger } from '../utils/logger.js';
import { createChain, getByEntity, resolveChainRoles } from './approvalService.js';
import { notify } from './notificationService.js';

function computeSlaStatus(dueDate, status) {
  if (status === 'COMPLETED') return 'COMPLETED';
  if (!dueDate) return 'ON_TRACK';
  const now = new Date();
  const due = new Date(dueDate);
  if (now > due) return 'OVERDUE';
  const hoursLeft = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursLeft <= 48) return 'DUE_SOON';
  return 'ON_TRACK';
}

async function createManual(organizationId, payload, createdByUserId) {
  const { employeeId, decisionId, departmentId, title, description, interventionType, priority, dueDate, targetSlaDays, requestedByUserId } = payload;
  if (!employeeId || !title || !priority) {
    throw new AppError(422, 'VALIDATION_ERROR', 'employeeId, title, and priority are required.');
  }

  const employee = await Employee.findOne({ _id: employeeId, organizationId }).lean();
  if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');

  const calculatedDueDate = dueDate
    ? new Date(dueDate)
    : targetSlaDays
    ? new Date(Date.now() + targetSlaDays * 24 * 60 * 60 * 1000)
    : null;

  const initialStatus = payload.status || 'PROPOSED';

  const intervention = await Intervention.create({
    organizationId,
    employeeId,
    decisionId: decisionId || null,
    departmentId: departmentId || employee.departmentId || null,
    title,
    description: description || '',
    interventionType: interventionType || 'GENERAL',
    priority,
    status: initialStatus,
    statusHistory: [{ status: initialStatus, changedBy: createdByUserId, changedAt: new Date(), note: 'Created', action: 'CREATED' }],
    targetSlaDays: targetSlaDays || 14,
    dueDate: calculatedDueDate,
    slaStatus: computeSlaStatus(calculatedDueDate, initialStatus),
    createdByUserId,
    requestedByUserId: requestedByUserId || createdByUserId,
    idempotencyKey: payload.idempotencyKey || null,
    aiEvidenceSnapshot: payload.aiEvidenceSnapshot || null,
    baselineRisk: payload.baselineRisk ?? null,
    estimatedCost: payload.estimatedCost || 0,
  });

  await recordAudit(organizationId, 'INTERVENTION_CREATED', createdByUserId, {
    entityType: 'INTERVENTION',
    entityId: intervention._id,
    context: { employeeId, priority, title, status: initialStatus },
  });

  return intervention;
}

/** Creates a PROPOSED intervention pre-populated from an existing AI recommendation (Decision) with idempotency & snapshot protection. */
async function createFromDecision(organizationId, decision, createdByUserId, overrides = {}) {
  const action = decision.recommendedActions?.[0] || {};
  const actionId = overrides.actionId || action.actionId || action.id || 'DEFAULT_ACTION';

  // Deterministic Idempotency Key
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(`${organizationId}_${decision.employeeId}_${decision._id}_${actionId}`)
    .digest('hex');

  // Idempotency check: return existing intervention if already converted
  const existing = await Intervention.findOne({ organizationId, idempotencyKey }).lean();
  if (existing) {
    logger.info('intervention_idempotent_duplicate_prevented', { organizationId, idempotencyKey, interventionId: existing._id });
    return existing;
  }

  // Immutable AI Evidence Snapshot
  const aiEvidenceSnapshot = {
    predictionId: decision.predictionId ? String(decision.predictionId) : null,
    explanationId: decision.explanationId ? String(decision.explanationId) : null,
    decisionTraceId: decision.decisionTraceId ? String(decision.decisionTraceId) : null,
    riskScore: decision.confidence || decision.riskAssessment?.riskScore || null,
    riskLevel: decision.priority || decision.riskAssessment?.riskLevel || null,
    shapDrivers: decision.affectedFactors || decision.shapDrivers || [],
    nlpObservations: decision.nlpObservations || [],
    policyCitations: decision.relatedPolicies || decision.policyCitations || [],
    recommendedActionId: actionId,
  };

  return createManual(
    organizationId,
    {
      employeeId: decision.employeeId,
      decisionId: decision._id,
      title: overrides.title || action.title || action.action || decision.recommendationType || 'AI Retention Action',
      description: overrides.description || action.action || decision.reasoning || '',
      interventionType: overrides.interventionType || action.interventionType || decision.recommendationType || 'GENERAL',
      priority: overrides.priority || decision.priority || 'MEDIUM',
      dueDate: overrides.dueDate,
      targetSlaDays: overrides.targetSlaDays || action.targetSlaDays || 14,
      estimatedCost: overrides.estimatedCost || action.estimatedCost || 0,
      baselineRisk: decision.confidence || null,
      status: 'PROPOSED',
      requestedByUserId: createdByUserId,
      idempotencyKey,
      aiEvidenceSnapshot,
    },
    createdByUserId,
  );
}

function list(organizationId, { status, priority, assignedToUserId, employeeId, departmentId, slaStatus, limit = 100 } = {}) {
  const filter = { organizationId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedToUserId) filter.assignedToUserId = assignedToUserId;
  if (employeeId) filter.employeeId = employeeId;
  if (departmentId) filter.departmentId = departmentId;
  if (slaStatus) filter.slaStatus = slaStatus;

  return Intervention.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('employeeId', 'firstName lastName employeeCode')
    .populate('assignedToUserId', 'name email')
    .lean();
}

async function getById(interventionId, organizationId) {
  const intervention = await Intervention.findOne({ _id: interventionId, organizationId })
    .populate('employeeId', 'firstName lastName employeeCode departmentId')
    .populate('assignedToUserId', 'name email')
    .populate('createdByUserId', 'name email')
    .populate('requestedByUserId', 'name email')
    .lean();

  if (!intervention) throw new AppError(404, 'INTERVENTION_NOT_FOUND', 'Intervention not found.');
  const approval = await getByEntity('INTERVENTION', interventionId, intervention.organizationId);
  return { ...intervention, approval };
}

/**
 * Concurrency-safe transition entry point enforcing:
 * 1. Allowed state transitions
 * 2. Separation of duties / self-approval prevention
 * 3. Atomic state updates via findOneAndUpdate
 * 4. Outcome & riskDelta metrics
 */
async function transition(
  interventionId,
  organizationId,
  targetStatus,
  userId,
  { note = '', assignedToUserId, cancelReason, currentRisk, actualCost, employeeRetained, outcomeNotes } = {},
) {
  if (!INTERVENTION_STATUSES.includes(targetStatus)) {
    throw new AppError(400, 'INVALID_STATUS', `Status must be one of: ${INTERVENTION_STATUSES.join(', ')}`);
  }

  const intervention = await Intervention.findOne({ _id: interventionId, organizationId });
  if (!intervention) throw new AppError(404, 'INTERVENTION_NOT_FOUND', 'Intervention not found.');

  const allowed = ALLOWED_TRANSITIONS[intervention.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(400, 'INVALID_TRANSITION', `Cannot move an intervention from ${intervention.status} to ${targetStatus}.`);
  }

  // Separation of Duties / Self-Approval Prevention (Safeguard 1)
  if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
    const creatorStr = String(intervention.createdByUserId || '');
    const requesterStr = String(intervention.requestedByUserId || '');
    const actorStr = String(userId || '');
    if (actorStr === creatorStr || actorStr === requesterStr) {
      throw new AppError(403, 'SELF_APPROVAL_FORBIDDEN', 'Users cannot approve or reject their own intervention requests due to separation of duties.');
    }
  }

  if (targetStatus === 'ASSIGNED' && !assignedToUserId) {
    throw new AppError(422, 'VALIDATION_ERROR', 'assignedToUserId is required to assign an intervention.');
  }

  // Build atomic update payload
  const updateFields = {
    status: targetStatus,
    slaStatus: computeSlaStatus(intervention.dueDate, targetStatus),
  };

  if (targetStatus === 'ASSIGNED') {
    updateFields.assignedToUserId = assignedToUserId;
    await notify(intervention.organizationId, assignedToUserId, {
      type: 'INTERVENTION_ASSIGNED',
      severity: 'MEDIUM',
      title: 'New intervention assigned to you',
      message: intervention.title,
      entityType: 'INTERVENTION',
      entityId: intervention._id,
    });
  }

  if (targetStatus === 'COMPLETED') {
    updateFields.completedAt = new Date();
    if (typeof currentRisk === 'number') {
      updateFields.currentRisk = currentRisk;
      updateFields.riskDelta = (intervention.baselineRisk ?? currentRisk) - currentRisk;
    }
    if (typeof actualCost === 'number') updateFields.actualCost = actualCost;
    if (typeof employeeRetained === 'boolean') updateFields.employeeRetained = employeeRetained;
    if (outcomeNotes) updateFields.outcomeNotes = outcomeNotes;

    // Compute ROI if costs and risk reduction exist
    if (updateFields.actualCost > 0 && typeof updateFields.riskDelta === 'number') {
      const estimatedSavings = updateFields.riskDelta * 50000; // estimated replacement cost savings
      updateFields.roiPercentage = Math.round(((estimatedSavings - updateFields.actualCost) / updateFields.actualCost) * 100);
    }
  }

  if (targetStatus === 'CANCELLED') {
    updateFields.cancelReason = cancelReason || note || '';
  }

  const historyEntry = {
    status: targetStatus,
    changedBy: userId,
    changedAt: new Date(),
    note: note || '',
    action: `TRANSITION_TO_${targetStatus}`,
  };

  // Concurrency-safe atomic transition (Safeguard 4)
  const updatedIntervention = await Intervention.findOneAndUpdate(
    { _id: interventionId, organizationId, status: intervention.status },
    {
      $set: updateFields,
      $push: { statusHistory: historyEntry },
    },
    { new: true },
  );

  if (!updatedIntervention) {
    throw new AppError(409, 'CONCURRENCY_CONFLICT', 'Intervention status was modified concurrently by another request.');
  }

  await recordAudit(organizationId, 'INTERVENTION_STATUS_CHANGED', userId, {
    entityType: 'INTERVENTION',
    entityId: updatedIntervention._id,
    changes: { old: intervention.status, new: targetStatus },
    context: { note },
  });

  logger.info('workflow_event', {
    entity: 'INTERVENTION',
    entityId: String(updatedIntervention._id),
    from: intervention.status,
    to: targetStatus,
    userId,
  });

  return updatedIntervention;
}

async function syncFromApproval(interventionId, approval, userId) {
  if (approval.overallStatus === 'APPROVED') {
    return transition(interventionId, approval.organizationId, 'APPROVED', userId, { note: 'Approval chain completed.' });
  }
  if (approval.overallStatus === 'REJECTED') {
    return transition(interventionId, approval.organizationId, 'REJECTED', userId, { note: 'Rejected during approval.' });
  }
  return Intervention.findOne({ _id: interventionId, organizationId: approval.organizationId });
}

async function listOverdue(organizationId) {
  const now = new Date();
  // Update SLA statuses dynamically for overdue items
  await Intervention.updateMany(
    { organizationId, status: { $nin: ['COMPLETED', 'REJECTED', 'CANCELLED'] }, dueDate: { $ne: null, $lt: now } },
    { $set: { slaStatus: 'OVERDUE' } },
  );

  return Intervention.find({
    organizationId,
    status: { $nin: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
    dueDate: { $ne: null, $lt: now },
  })
    .populate('assignedToUserId', 'name email')
    .populate('employeeId', 'firstName lastName employeeCode')
    .lean();
}

export const interventionService = {
  createManual,
  createFromDecision,
  list,
  getById,
  transition,
  syncFromApproval,
  listOverdue,
  resolveChainRoles,
};
export default interventionService;
