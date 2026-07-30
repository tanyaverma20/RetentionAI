import { decisionService } from '../services/decisionService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

// Mirrors hrController.js's extractOrgId — req.auth (set by authenticate.js)
// does not carry organizationId in this single-tenant MVP.
function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export async function generateDecision(req, res, next) {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await decisionService.generateForEmployee(
      req.params.employeeId,
      extractOrgId(req),
      req.auth.userId,
      forceRefresh,
    );
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getDecision(req, res, next) {
  try {
    const result = await decisionService.getStored(req.params.employeeId);
    if (!result) {
      return next(new AppError(404, 'DECISION_NOT_FOUND', 'No AI recommendation found. Generate one first.'));
    }
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getDecisionHistory(req, res, next) {
  try {
    const result = await decisionService.getHistory(req.params.employeeId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function generateBatch(req, res, next) {
  try {
    const { employeeIds, departmentId } = req.body || {};
    const result = await decisionService.generateBatch(extractOrgId(req), employeeIds, departmentId, req.auth.userId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function updateDecisionStatus(req, res, next) {
  try {
    const { status, note } = req.body || {};
    if (!status) {
      throw new AppError(422, 'VALIDATION_ERROR', 'status is required.');
    }
    const result = await decisionService.updateStatus(req.params.id, status, req.auth.userId, note);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getDashboardSummary(req, res, next) {
  try {
    const result = await decisionService.getDashboardSummary(extractOrgId(req));
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getManagerDashboard(req, res, next) {
  try {
    const departmentId = req.query.departmentId || req.auth.departmentId;
    if (!departmentId) {
      throw new AppError(400, 'DEPARTMENT_REQUIRED', 'No department scope available for this user.');
    }
    const result = await decisionService.getManagerDashboard(extractOrgId(req), departmentId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}
