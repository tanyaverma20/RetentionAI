import { taskService } from '../services/taskService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';


export async function createTask(req, res, next) {
  try {
    const result = await taskService.create(req.auth.organizationId, req.body || {}, req.auth.userId);
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listTasks(req, res, next) {
  try {
    const result = await taskService.list(req.auth.organizationId, req.query);
    return sendSuccess(res, 200, { tasks: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getTask(req, res, next) {
  try {
    const result = await taskService.getById(req.params.id);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function assignTask(req, res, next) {
  try {
    const { ownerUserId, note } = req.body || {};
    if (!ownerUserId) throw new AppError(422, 'VALIDATION_ERROR', 'ownerUserId is required.');
    const result = await taskService.assign(req.params.id, ownerUserId, req.auth.userId, note);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function completeTask(req, res, next) {
  try {
    const result = await taskService.complete(req.params.id, req.auth.userId, req.body?.note);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function cancelTask(req, res, next) {
  try {
    const result = await taskService.cancel(req.params.id, req.auth.userId, req.body?.note);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function escalateTask(req, res, next) {
  try {
    const { escalateToUserId, note } = req.body || {};
    if (!escalateToUserId) throw new AppError(422, 'VALIDATION_ERROR', 'escalateToUserId is required.');
    const result = await taskService.escalate(req.params.id, escalateToUserId, req.auth.userId, note);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listOverdueTasks(req, res, next) {
  try {
    const result = await taskService.listOverdue(req.auth.organizationId);
    return sendSuccess(res, 200, { tasks: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listTasksDueToday(req, res, next) {
  try {
    const result = await taskService.listDueToday(req.auth.organizationId);
    return sendSuccess(res, 200, { tasks: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}
