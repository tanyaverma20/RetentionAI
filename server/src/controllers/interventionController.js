import { interventionService } from '../services/interventionService.js';
import { decisionService } from '../services/decisionService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

export async function createIntervention(req, res, next) {
  try {
    const result = await interventionService.createManual(req.auth.organizationId, req.body || {}, req.auth.userId);
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function createFromDecision(req, res, next) {
  try {
    const decision = await decisionService.getStored(req.body.employeeId, req.auth.organizationId);
    if (!decision) throw new AppError(404, 'DECISION_NOT_FOUND', 'No AI recommendation found for this employee.');
    const result = await interventionService.createFromDecision(req.auth.organizationId, decision, req.auth.userId, req.body || {});
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listInterventions(req, res, next) {
  try {
    const result = await interventionService.list(req.auth.organizationId, req.query);
    return sendSuccess(res, 200, { interventions: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getIntervention(req, res, next) {
  try {
    const result = await interventionService.getById(req.params.id, req.auth.organizationId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function transitionIntervention(req, res, next) {
  try {
    const { status, note, assignedToUserId, cancelReason } = req.body || {};
    if (!status) throw new AppError(422, 'VALIDATION_ERROR', 'status is required.');
    const result = await interventionService.transition(req.params.id, req.auth.organizationId, status, req.auth.userId, { note, assignedToUserId, cancelReason });
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listOverdueInterventions(req, res, next) {
  try {
    const result = await interventionService.listOverdue(req.auth.organizationId);
    return sendSuccess(res, 200, { interventions: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}
