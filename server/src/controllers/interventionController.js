import { interventionService } from '../services/interventionService.js';
import { decisionService } from '../services/decisionService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export async function createIntervention(req, res, next) {
  try {
    const result = await interventionService.createManual(extractOrgId(req), req.body || {}, req.auth.userId);
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function createFromDecision(req, res, next) {
  try {
    const decision = await decisionService.getStored(req.body.employeeId);
    if (!decision) throw new AppError(404, 'DECISION_NOT_FOUND', 'No AI recommendation found for this employee.');
    const result = await interventionService.createFromDecision(extractOrgId(req), decision, req.auth.userId, req.body || {});
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listInterventions(req, res, next) {
  try {
    const result = await interventionService.list(extractOrgId(req), req.query);
    return sendSuccess(res, 200, { interventions: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getIntervention(req, res, next) {
  try {
    const result = await interventionService.getById(req.params.id);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function transitionIntervention(req, res, next) {
  try {
    const { status, note, assignedToUserId, cancelReason } = req.body || {};
    if (!status) throw new AppError(422, 'VALIDATION_ERROR', 'status is required.');
    const result = await interventionService.transition(req.params.id, status, req.auth.userId, { note, assignedToUserId, cancelReason });
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listOverdueInterventions(req, res, next) {
  try {
    const result = await interventionService.listOverdue(extractOrgId(req));
    return sendSuccess(res, 200, { interventions: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}
