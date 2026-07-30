/**
 * @file employeeController.js
 * @description HTTP request handlers for Employee management endpoints.
 *
 * Why this file exists
 * --------------------
 * Extracts HTTP parameters, query options, pagination options, and validated request payloads,
 * invokes `employeeService` functions, and formats standardized responses.
 */

import { AppError } from '../errors/AppError.js';
import * as employeeService from '../services/employeeService.js';
import { aiService } from '../services/aiService.js';
import { explainService } from '../services/explainService.js';
import { employeeIntelligenceService } from '../services/employeeIntelligenceService.js';
import { decisionService } from '../services/decisionService.js';
import { getProfilePictureUrl } from '../middlewares/uploadMiddleware.js';
import { sendSuccess } from '../utils/response.js';

// Mirrors hrController.js's extractOrgId — req.auth (set by authenticate.js)
// does not carry organizationId in this single-tenant MVP.
function extractOrgId(request) {
  return request.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export async function createEmployee(request, response, next) {
  try {
    const employee = await employeeService.createEmployee(request.validatedBody);
    return sendSuccess(response, 201, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listEmployees(request, response, next) {
  try {
    const {
      page = 1,
      limit = 10,
      departmentId,
      designation,
      status,
      includeDeleted = 'false',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      sentiment,
      burnoutRisk,
      emotion,
    } = request.query;

    const queryOptions = {
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 10, 100),
      departmentId,
      designation,
      status,
      includeDeleted: includeDeleted === 'true',
      search: search ? String(search).trim() : undefined,
      sortBy,
      sortOrder,
      sentiment,
      burnoutRisk,
      emotion,
    };

    const result = await employeeService.listEmployees(queryOptions, request.auth);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployeeProfile(request, response, next) {
  try {
    const employee = await employeeService.getEmployeeProfile(request.params.employeeId, request.auth);
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployee360(request, response, next) {
  try {
    const data = await employeeService.getEmployee360(request.params.employeeId, request.auth);
    return sendSuccess(response, 200, data, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function explainEmployeeRisk(request, response, next) {
  try {
    // Enforces the same RBAC scope as GET /:employeeId (an EMPLOYEE may only
    // explain their own risk) — this endpoint had no scope check at all
    // before, and SHAP explanations include raw feature values like salary,
    // so this was a PII leak equivalent to the unscoped profile read.
    await employeeService.getEmployeeProfile(request.params.employeeId, request.auth);

    // Delegates to the canonical explain service (same one backing /api/v1/explain/:id)
    // instead of duplicating SHAP-calling logic here.
    const forceRefresh = request.query.refresh === 'true';
    const explanation = await explainService.explainSingle(
      request.params.employeeId,
      extractOrgId(request),
      forceRefresh,
    );
    return sendSuccess(response, 200, explanation, request.requestId);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/employees/:employeeId/ai-insights
 * Read-only aggregation of every AI surface for one employee — Prediction
 * (who's at risk), Explanation (why), Employee Intelligence (how they
 * feel), and Decision (what HR should do next) — as ONE response, without
 * modifying any of those four modules. This is the single AI request the
 * Employee Profile needs (Decision Intelligence sprint requirement).
 * Missing pieces (nothing predicted/explained/analyzed/decided yet) are
 * returned as null rather than failing the whole request.
 */
export async function getEmployeeAiInsights(request, response, next) {
  try {
    const { employeeId } = request.params;
    // Same RBAC scope as GET /:employeeId — this merged endpoint had no
    // scope check at all before, letting any EMPLOYEE read any other
    // employee's prediction/SHAP/intelligence/decision data.
    await employeeService.getEmployeeProfile(employeeId, request.auth);

    const [prediction, explanation, intelligence, decision] = await Promise.all([
      aiService.getPredictionForEmployee(employeeId).catch(() => null),
      explainService.getStoredExplanation(employeeId).catch(() => null),
      employeeIntelligenceService.getStored(employeeId).catch(() => null),
      decisionService.getStored(employeeId).catch(() => null),
    ]);

    return sendSuccess(
      response,
      200,
      { employeeId, prediction, explanation, intelligence, decision },
      request.requestId,
    );
  } catch (error) {
    return next(error);
  }
}

export async function updateEmployee(request, response, next) {
  try {
    const employee = await employeeService.updateEmployee(
      request.params.employeeId,
      request.validatedBody,
    );
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function softDeleteEmployee(request, response, next) {
  try {
    const employee = await employeeService.softDeleteEmployee(request.params.employeeId);
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function restoreEmployee(request, response, next) {
  try {
    const employee = await employeeService.restoreEmployee(request.params.employeeId);
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function bulkImport(request, response, next) {
  try {
    const { csvText, records } = request.validatedBody || {};
    let rowsToImport = [];

    if (csvText) {
      rowsToImport = employeeService.parseCSVText(csvText);
    } else if (Array.isArray(records)) {
      rowsToImport = records;
    }

    const result = await employeeService.bulkImportEmployees(rowsToImport);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function uploadAvatar(request, response, next) {
  try {
    if (!request.file) {
      return next(new AppError(400, 'NO_FILE', 'No file was uploaded.'));
    }
    const url = getProfilePictureUrl(request.file.filename);
    const employee = await employeeService.updateEmployee(
      request.params.employeeId,
      { profilePicture: url },
    );
    return sendSuccess(response, 200, { profilePicture: url, employee }, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployeeTimeline(request, response, next) {
  try {
    const timeline = await employeeService.getEmployeeTimeline(
      request.params.employeeId,
      request.auth,
    );
    return sendSuccess(response, 200, timeline, request.requestId);
  } catch (error) {
    return next(error);
  }
}
