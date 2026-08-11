import { employeeIntelligenceService } from '../services/employeeIntelligenceService.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from '../services/auditService.js';


/**
 * POST /api/v1/employee-intelligence/:id
 * Generate or refresh the Employee Intelligence profile for one employee.
 */
export const generateEmployeeIntelligence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const result = await employeeIntelligenceService.generateForEmployee(id, req.auth.organizationId, forceRefresh);
    if (req.auth?.userId) {
      await recordAudit(req.auth.organizationId, 'EMPLOYEE_INTELLIGENCE_GENERATED', req.auth.userId, { entityType: 'EMPLOYEE', entityId: id });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EMPLOYEE_INTELLIGENCE_ERROR', error.message));
  }
};

/**
 * GET /api/v1/employee-intelligence/:id
 * Fetch the latest cached Employee Intelligence profile. 404 if never generated.
 */
export const getEmployeeIntelligence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await employeeIntelligenceService.getStored(id, req.auth.organizationId);
    if (!result) {
      return next(new AppError(404, 'EMPLOYEE_INTELLIGENCE_NOT_FOUND', 'No Employee Intelligence profile found. Generate one first.'));
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EMPLOYEE_INTELLIGENCE_ERROR', error.message));
  }
};

/**
 * POST /api/v1/employee-intelligence/batch
 * Generate Employee Intelligence profiles for many employees at once
 * (explicit employeeIds, a department, or — with neither — every ACTIVE employee).
 */
export const generateEmployeeIntelligenceBatch = async (req, res, next) => {
  try {
    const { employeeIds, departmentId } = req.body || {};
    const result = await employeeIntelligenceService.generateBatch(req.auth.organizationId, employeeIds, departmentId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EMPLOYEE_INTELLIGENCE_ERROR', error.message));
  }
};

/**
 * GET /api/v1/employee-intelligence/dashboard/summary
 * Workforce-wide sentiment/burnout/emotion/topic/department aggregation.
 */
export const getEmployeeIntelligenceDashboard = async (req, res, next) => {
  try {
    const result = await employeeIntelligenceService.getDashboardSummary(req.auth.organizationId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 502, error.code || 'EMPLOYEE_INTELLIGENCE_ERROR', error.message));
  }
};

/**
 * POST /api/v1/employees/:employeeId/feedback
 * Submit textual feedback for an employee with tenant scoping and NLP auto-analysis.
 */
export const createFeedback = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.params.id || req.body?.employeeId;
    const result = await employeeIntelligenceService.createFeedback(req.auth.organizationId, employeeId, req.body || {});
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 400, error.code || 'FEEDBACK_ERROR', error.message));
  }
};

/**
 * GET /api/v1/employees/:employeeId/feedback
 * Fetch feedback history for an employee within the authenticated organization.
 */
export const getEmployeeFeedback = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.params.id;
    const result = await employeeIntelligenceService.getEmployeeFeedback(req.auth.organizationId, employeeId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 400, error.code || 'FEEDBACK_ERROR', error.message));
  }
};

/**
 * POST /api/v1/employees/:employeeId/feedback/:feedbackId/analyze
 * Run or re-run NLP sentiment analysis on a specific feedback record.
 */
export const analyzeFeedback = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.params.id;
    const feedbackId = req.params.feedbackId;
    const result = await employeeIntelligenceService.analyzeFeedback(req.auth.organizationId, employeeId, feedbackId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 400, error.code || 'FEEDBACK_ANALYSIS_ERROR', error.message));
  }
};

/**
 * GET /api/v1/employees/:employeeId/sentiment-timeline
 * Retrieve chronological sentiment history and aggregate profiles.
 */
export const getSentimentTimeline = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.params.id;
    const result = await employeeIntelligenceService.getSentimentTimeline(employeeId, req.auth.organizationId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.statusCode || 400, error.code || 'SENTIMENT_TIMELINE_ERROR', error.message));
  }
};
