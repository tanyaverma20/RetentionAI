import { Task, TASK_STATUSES } from '../models/Task.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from './auditService.js';
import { logger } from '../utils/logger.js';
import { notify } from './notificationService.js';

async function create(organizationId, payload, createdByUserId) {
  const { title, description, priority, ownerUserId, departmentId, dueDate, sourceType, sourceId, employeeId } = payload;
  if (!title) throw new AppError(422, 'VALIDATION_ERROR', 'title is required.');

  const task = await Task.create({
    organizationId,
    title,
    description: description || '',
    priority: priority || 'MEDIUM',
    ownerUserId: ownerUserId || null,
    departmentId: departmentId || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    sourceType: sourceType || 'MANUAL',
    sourceId: sourceId || null,
    employeeId: employeeId || null,
    status: 'OPEN',
    history: [{ action: 'CREATED', byUserId: createdByUserId, at: new Date() }],
    createdByUserId,
  });

  if (ownerUserId) {
    await notify(organizationId, ownerUserId, {
      type: 'TASK_ASSIGNED',
      severity: 'MEDIUM',
      title: 'New task assigned to you',
      message: title,
      entityType: 'TASK',
      entityId: task._id,
    });
  }

  await recordAudit(organizationId, 'TASK_CREATED', createdByUserId, {
    entityType: 'TASK',
    entityId: task._id,
    context: { title, priority: task.priority },
  });
  logger.info('workflow_event', { entity: 'TASK', entityId: String(task._id), action: 'CREATED', priority: task.priority, userId: createdByUserId });

  return task;
}

function list(organizationId, { status, priority, ownerUserId, departmentId, dueBefore, limit = 100 } = {}) {
  const filter = { organizationId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (ownerUserId) filter.ownerUserId = ownerUserId;
  if (departmentId) filter.departmentId = departmentId;
  if (dueBefore) filter.dueDate = { $lte: new Date(dueBefore) };
  return Task.find(filter)
    .sort({ dueDate: 1, createdAt: -1 })
    .limit(Number(limit))
    .populate('ownerUserId', 'name email')
    .populate('employeeId', 'firstName lastName')
    .lean();
}

// Prompt 1, Part 9/11/14 — previously unscoped: any org's authenticated
// user could view/assign/complete/cancel/escalate another org's task by ID
// alone (and could even direct a reassignment/escalation notification at an
// arbitrary user in the victim org). organizationId now required and
// comes from the authenticated caller (Part 10); a mismatch is reported as
// 404, identical to a genuinely unknown ID (Part 14).
async function getById(taskId, organizationId) {
  const task = await Task.findOne({ _id: taskId, organizationId })
    .populate('ownerUserId', 'name email')
    .populate('createdByUserId', 'name email')
    .populate('escalatedToUserId', 'name email')
    .populate('employeeId', 'firstName lastName')
    .lean();
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
  return task;
}

async function assign(taskId, organizationId, ownerUserId, byUserId, note = '') {
  const task = await Task.findOne({ _id: taskId, organizationId });
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
  const action = task.ownerUserId ? 'REASSIGNED' : 'ASSIGNED';
  const fromValue = task.ownerUserId ? String(task.ownerUserId) : null;
  task.ownerUserId = ownerUserId;
  task.history.push({ action, byUserId, at: new Date(), note, fromValue, toValue: String(ownerUserId) });
  await task.save();

  await notify(task.organizationId, ownerUserId, {
    type: 'TASK_ASSIGNED',
    severity: 'MEDIUM',
    title: action === 'REASSIGNED' ? 'Task reassigned to you' : 'New task assigned to you',
    message: task.title,
    entityType: 'TASK',
    entityId: task._id,
  });
  await recordAudit(task.organizationId, 'TASK_ASSIGNED', byUserId, { entityType: 'TASK', entityId: task._id, context: { ownerUserId, action } });
  return task;
}

async function updateStatus(taskId, organizationId, status, byUserId, note = '') {
  if (!TASK_STATUSES.includes(status)) {
    throw new AppError(400, 'INVALID_STATUS', `Status must be one of: ${TASK_STATUSES.join(', ')}`);
  }
  const task = await Task.findOne({ _id: taskId, organizationId });
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
  if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
    throw new AppError(409, 'TASK_ALREADY_CLOSED', `Task is already ${task.status} and cannot be changed.`);
  }

  const fromStatus = task.status;
  task.status = status;
  if (status === 'COMPLETED') task.completedAt = new Date();
  task.history.push({ action: 'STATUS_CHANGED', byUserId, at: new Date(), note, fromValue: fromStatus, toValue: status });
  await task.save();

  await recordAudit(task.organizationId, 'TASK_STATUS_CHANGED', byUserId, {
    entityType: 'TASK',
    entityId: task._id,
    changes: { old: fromStatus, new: status },
  });

  return task;
}

const complete = (taskId, organizationId, byUserId, note) => updateStatus(taskId, organizationId, 'COMPLETED', byUserId, note);
const cancel = (taskId, organizationId, byUserId, note) => updateStatus(taskId, organizationId, 'CANCELLED', byUserId, note);

async function escalate(taskId, organizationId, escalateToUserId, byUserId, note = '') {
  const task = await Task.findOne({ _id: taskId, organizationId });
  if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found.');
  if (['COMPLETED', 'CANCELLED'].includes(task.status)) {
    throw new AppError(409, 'TASK_ALREADY_CLOSED', `Task is already ${task.status} and cannot be escalated.`);
  }

  task.status = 'ESCALATED';
  task.escalatedToUserId = escalateToUserId;
  task.escalatedAt = new Date();
  task.history.push({ action: 'ESCALATED', byUserId, at: new Date(), note, toValue: String(escalateToUserId) });
  await task.save();

  await notify(task.organizationId, escalateToUserId, {
    type: 'TASK_ESCALATED',
    severity: 'HIGH',
    title: 'Task escalated to you',
    message: task.title,
    entityType: 'TASK',
    entityId: task._id,
  });
  await recordAudit(task.organizationId, 'TASK_ESCALATED', byUserId, { entityType: 'TASK', entityId: task._id, context: { escalateToUserId, note } });

  return task;
}

function listOverdue(organizationId) {
  return Task.find({ organizationId, status: { $nin: ['COMPLETED', 'CANCELLED'] }, dueDate: { $ne: null, $lt: new Date() } })
    .populate('ownerUserId', 'name email')
    .lean();
}

function listDueToday(organizationId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return Task.find({ organizationId, status: { $nin: ['COMPLETED', 'CANCELLED'] }, dueDate: { $gte: start, $lte: end } })
    .populate('ownerUserId', 'name email')
    .lean();
}

export const taskService = { create, list, getById, assign, updateStatus, complete, cancel, escalate, listOverdue, listDueToday };
export default taskService;
