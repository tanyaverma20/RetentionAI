import { Intervention, INTERVENTION_STATUSES, ALLOWED_TRANSITIONS } from '../models/Intervention.js';
import { Employee } from '../models/Employee.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from './auditService.js';
import { logger } from '../utils/logger.js';
import { createChain, getByEntity, resolveChainRoles } from './approvalService.js';
import { notify } from './notificationService.js';

async function createManual(organizationId, payload, createdByUserId) {
  const { employeeId, decisionId, departmentId, title, description, interventionType, priority, dueDate } = payload;
  if (!employeeId || !title || !priority) {
    throw new AppError(422, 'VALIDATION_ERROR', 'employeeId, title, and priority are required.');
  }
  // Part 9/11 — previously unscoped: an Intervention could be created
  // tagged with the caller's organizationId but referencing another org's
  // employeeId, both leaking that employee's data into the response and
  // corrupting cross-tenant data integrity.
  const employee = await Employee.findOne({ _id: employeeId, organizationId }).lean();
  if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');

  const intervention = await Intervention.create({
    organizationId,
    employeeId,
    decisionId: decisionId || null,
    departmentId: departmentId || employee.departmentId || null,
    title,
    description: description || '',
    interventionType: interventionType || 'GENERAL',
    priority,
    status: 'DRAFT',
    statusHistory: [{ status: 'DRAFT', changedBy: createdByUserId, changedAt: new Date(), note: 'Created' }],
    dueDate: dueDate ? new Date(dueDate) : null,
    createdByUserId,
  });

  await recordAudit(organizationId, 'INTERVENTION_CREATED', createdByUserId, {
    entityType: 'INTERVENTION',
    entityId: intervention._id,
    context: { employeeId, priority, title },
  });

  return intervention;
}

/** Creates a DRAFT intervention pre-populated from an existing AI recommendation (Decision). */
async function createFromDecision(organizationId, decision, createdByUserId, overrides = {}) {
  const action = decision.recommendedActions?.[0];
  return createManual(
    organizationId,
    {
      employeeId: decision.employeeId,
      decisionId: decision._id,
      title: overrides.title || action?.description || decision.recommendationType,
      description: overrides.description || decision.reasoning || '',
      interventionType: decision.recommendationType,
      priority: overrides.priority || decision.priority,
      dueDate: overrides.dueDate,
    },
    createdByUserId,
  );
}

function list(organizationId, { status, priority, assignedToUserId, employeeId, departmentId, limit = 100 } = {}) {
  const filter = { organizationId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedToUserId) filter.assignedToUserId = assignedToUserId;
  if (employeeId) filter.employeeId = employeeId;
  if (departmentId) filter.departmentId = departmentId;
  return Intervention.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .populate('employeeId', 'firstName lastName employeeCode')
    .populate('assignedToUserId', 'name email')
    .lean();
}

// Prompt 1, Part 9/11 — previously unscoped: any org's authenticated user
// could view another org's intervention (employee name, AI decision
// reasoning, evidence) by ID alone. organizationId now comes from the
// authenticated caller (Part 10); a mismatch is reported as 404, same as a
// genuinely unknown ID (Part 14).
async function getById(interventionId, organizationId) {
  const intervention = await Intervention.findOne({ _id: interventionId, organizationId })
    .populate('employeeId', 'firstName lastName employeeCode departmentId')
    .populate('assignedToUserId', 'name email')
    .populate('createdByUserId', 'name email')
    .lean();
  if (!intervention) throw new AppError(404, 'INTERVENTION_NOT_FOUND', 'Intervention not found.');
  const approval = await getByEntity('INTERVENTION', interventionId, intervention.organizationId);
  return { ...intervention, approval };
}

/**
 * The single lifecycle transition entry point (Part 1). Every jump is
 * checked against ALLOWED_TRANSITIONS so an intervention can never skip a
 * required step (e.g. DRAFT straight to COMPLETED), and every transition is
 * appended to statusHistory — the audit trail the spec requires.
 */
// organizationId required — Part 9/11/14: previously any org could
// transition/reassign/cancel another org's intervention by ID alone.
async function transition(interventionId, organizationId, targetStatus, userId, { note = '', assignedToUserId, cancelReason } = {}) {
  if (!INTERVENTION_STATUSES.includes(targetStatus)) {
    throw new AppError(400, 'INVALID_STATUS', `Status must be one of: ${INTERVENTION_STATUSES.join(', ')}`);
  }
  const intervention = await Intervention.findOne({ _id: interventionId, organizationId });
  if (!intervention) throw new AppError(404, 'INTERVENTION_NOT_FOUND', 'Intervention not found.');

  const allowed = ALLOWED_TRANSITIONS[intervention.status] || [];
  if (!allowed.includes(targetStatus)) {
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot move an intervention from ${intervention.status} to ${targetStatus}.`);
  }

  if (targetStatus === 'PENDING_APPROVAL') {
    await createChain(intervention.organizationId, 'INTERVENTION', intervention._id, intervention.priority, userId);
  }

  if (targetStatus === 'APPROVED') {
    const approval = await getByEntity('INTERVENTION', intervention._id, intervention.organizationId);
    if (!approval || approval.overallStatus !== 'APPROVED') {
      throw new AppError(409, 'APPROVAL_INCOMPLETE', 'This intervention has not completed its approval chain yet.');
    }
  }

  if (targetStatus === 'ASSIGNED') {
    if (!assignedToUserId) throw new AppError(422, 'VALIDATION_ERROR', 'assignedToUserId is required to assign an intervention.');
    intervention.assignedToUserId = assignedToUserId;
    await notify(intervention.organizationId, assignedToUserId, {
      type: 'INTERVENTION_ASSIGNED',
      severity: 'MEDIUM',
      title: 'New intervention assigned to you',
      message: intervention.title,
      entityType: 'INTERVENTION',
      entityId: intervention._id,
    });
  }

  if (targetStatus === 'COMPLETED') intervention.completedAt = new Date();
  if (targetStatus === 'CANCELLED') intervention.cancelReason = cancelReason || note || '';

  const fromStatus = intervention.status;
  intervention.status = targetStatus;
  intervention.statusHistory.push({ status: targetStatus, changedBy: userId, changedAt: new Date(), note });
  await intervention.save();

  await recordAudit(intervention.organizationId, 'INTERVENTION_STATUS_CHANGED', userId, {
    entityType: 'INTERVENTION',
    entityId: intervention._id,
    changes: { old: fromStatus, new: targetStatus },
    context: { note },
  });
  logger.info('workflow_event', { entity: 'INTERVENTION', entityId: String(intervention._id), from: fromStatus, to: targetStatus, userId });

  return intervention;
}

/** Called by approvalService's controller after an approval decision resolves the chain. */
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
  return Intervention.find({
    organizationId,
    status: { $nin: ['COMPLETED', 'REJECTED', 'CANCELLED'] },
    dueDate: { $ne: null, $lt: new Date() },
  })
    .populate('assignedToUserId', 'name email')
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
