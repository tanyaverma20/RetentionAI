import { explainService } from '../services/explainService.js';
import { AppError } from '../errors/AppError.js';

// Mirrors hrController.js's extractOrgId / aiController.js — req.auth (set by
// authenticate.js) does not carry organizationId in this single-tenant MVP.
function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

/**
 * POST /api/v1/explain/:id
 * Generate or refresh a SHAP explanation for a single employee.
 */
export const explainSingle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const result = await explainService.explainSingle(id, extractOrgId(req), forceRefresh);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EXPLAIN_SERVICE_ERROR', error.message));
  }
};

/**
 * GET /api/v1/explain/:id
 * Fetch cached SHAP explanation for a single employee.
 * Returns 404 if not yet generated.
 */
export const getExplanation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await explainService.getStoredExplanation(id);
    if (!result) {
      return next(new AppError(404, 'EXPLANATION_NOT_FOUND', 'No explanation found. Generate one first.'));
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EXPLAIN_SERVICE_ERROR', error.message));
  }
};

/**
 * POST /api/v1/explain/batch
 * Generate SHAP explanations for the whole workforce (or a subset).
 */
export const explainBatch = async (req, res, next) => {
  try {
    const { employeeIds } = req.body;
    const result = await explainService.explainBatch(extractOrgId(req), employeeIds);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EXPLAIN_SERVICE_ERROR', error.message));
  }
};

/**
 * GET /api/v1/explain/global/feature-importance
 * Fetch global SHAP feature importance ranking from FastAPI.
 */
export const getGlobalFeatureImportance = async (req, res, next) => {
  try {
    const result = await explainService.getGlobalFeatureImportance();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EXPLAIN_SERVICE_ERROR', error.message));
  }
};

/**
 * GET /api/v1/explain/global/department-drivers
 * Aggregate already-generated explanations by department to surface the
 * top attrition-risk driver per department (Dashboard widget).
 */
export const getDepartmentRiskDrivers = async (req, res, next) => {
  try {
    const result = await explainService.getDepartmentRiskDrivers(extractOrgId(req));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EXPLAIN_SERVICE_ERROR', error.message));
  }
};
