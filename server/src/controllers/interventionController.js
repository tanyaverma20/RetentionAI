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
    const { employeeId, decisionId, overrides } = req.body || {};
    if (!employeeId) throw new AppError(422, 'VALIDATION_ERROR', 'employeeId is required.');

    let decision;
    if (decisionId) {
      decision = await decisionService.getStored(employeeId, req.auth.organizationId);
    } else {
      decision = await decisionService.getStored(employeeId, req.auth.organizationId);
    }
    if (!decision) throw new AppError(404, 'DECISION_NOT_FOUND', 'No AI recommendation found for this employee.');

    const result = await interventionService.createFromDecision(req.auth.organizationId, decision, req.auth.userId, overrides || req.body || {});
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
    const { status, note, assignedToUserId, cancelReason, currentRisk, actualCost, employeeRetained, outcomeNotes } = req.body || {};
    if (!status) throw new AppError(422, 'VALIDATION_ERROR', 'status is required.');
    const result = await interventionService.transition(req.params.id, req.auth.organizationId, status, req.auth.userId, {
      note,
      assignedToUserId,
      cancelReason,
      currentRisk,
      actualCost,
      employeeRetained,
      outcomeNotes,
    });
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function approveIntervention(req, res, next) {
  try {
    const { note } = req.body || {};
    const result = await interventionService.transition(req.params.id, req.auth.organizationId, 'APPROVED', req.auth.userId, { note });
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function rejectIntervention(req, res, next) {
  try {
    const { note } = req.body || {};
    const result = await interventionService.transition(req.params.id, req.auth.organizationId, 'REJECTED', req.auth.userId, { note });
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function startIntervention(req, res, next) {
  try {
    const { note, assignedToUserId } = req.body || {};
    const result = await interventionService.transition(req.params.id, req.auth.organizationId, 'IN_PROGRESS', req.auth.userId, { note, assignedToUserId });
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function completeIntervention(req, res, next) {
  try {
    const { note, currentRisk, actualCost, employeeRetained, outcomeNotes } = req.body || {};
    const result = await interventionService.transition(req.params.id, req.auth.organizationId, 'COMPLETED', req.auth.userId, {
      note,
      currentRisk,
      actualCost,
      employeeRetained,
      outcomeNotes,
    });
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function cancelIntervention(req, res, next) {
  try {
    const { cancelReason, note } = req.body || {};
    const result = await interventionService.transition(req.params.id, req.auth.organizationId, 'CANCELLED', req.auth.userId, { cancelReason, note });
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
