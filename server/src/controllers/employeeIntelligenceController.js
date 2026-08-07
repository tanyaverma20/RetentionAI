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
    const result = await employeeIntelligenceService.getStored(id);
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
