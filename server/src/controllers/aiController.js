import { aiService } from '../services/aiService.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from '../services/auditService.js';
import { logger } from '../utils/logger.js';

// Mirrors hrController.js's extractOrgId — this MVP is single-tenant; req.auth
// (set by authenticate.js) does not carry organizationId, so we fall back to
// the seeded demo org the same way the rest of the codebase does.
function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export const trainModel = async (req, res, next) => {
  try {
    const result = await aiService.trainModel();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'AI_TRAIN_FAILED', error.message));
  }
};

export const getPrediction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prediction = await aiService.getPredictionForEmployee(id);
    if (!prediction) {
      return next(new AppError(404, 'PREDICTION_NOT_FOUND', 'No prediction has been generated for this employee yet.'));
    }
    res.status(200).json({ success: true, data: prediction });
  } catch (error) {
    next(new AppError(error.statusCode || 500, error.code || 'AI_GET_PREDICTION_FAILED', error.message));
  }
};

export const predictSingle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prediction = await aiService.predictSingle(id);
    if (req.auth?.userId) {
      await recordAudit(extractOrgId(req), 'PREDICTION_GENERATED', req.auth.userId, { entityType: 'EMPLOYEE', entityId: id });
    }
    logger.info('ai_call', { call: 'predict_single', employeeId: id, riskLevel: prediction?.riskLevel, userId: req.auth?.userId });
    res.status(200).json({ success: true, data: prediction });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'AI_PREDICT_FAILED', error.message));
  }
};

export const predictBatch = async (req, res, next) => {
  try {
    const { departmentId, employeeIds } = req.body;
    const result = await aiService.predictBatch(departmentId, employeeIds);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'AI_PREDICT_BATCH_FAILED', error.message));
  }
};

export const getModelInfo = async (req, res, next) => {
  try {
    const info = await aiService.getModelInfo();
    res.status(200).json({ success: true, data: info });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'AI_MODEL_INFO_FAILED', error.message));
  }
};

export const getModelMetrics = async (req, res, next) => {
  try {
    const metrics = await aiService.getModelMetrics();
    res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'AI_MODEL_METRICS_FAILED', error.message));
  }
};

export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const { counts, topHighRisk } = await aiService.getDashboardRiskCounts(extractOrgId(req));
    res.status(200).json({ success: true, data: { riskCounts: counts, topHighRisk } });
  } catch (error) {
    next(new AppError(error.statusCode || 500, error.code || 'AI_DASHBOARD_FAILED', error.message));
  }
};
