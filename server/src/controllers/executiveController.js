import * as executiveService from '../services/executiveService.js';
import * as executiveReportService from '../services/executiveReportService.js';
import { recordAudit } from '../services/auditService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

// Mirrors hrController.js/employeeController.js's extractOrgId — req.auth
// doesn't carry organizationId in this single-tenant MVP.
function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

/** Part 4 — Executive Filtering: builds a plain filter object from query params. */
function extractFilter(req) {
  const q = req.query || {};
  const filter = {};
  if (q.departmentId) filter.departmentId = q.departmentId;
  if (q.location) filter.location = q.location;
  if (q.role) filter.role = q.role;
  if (q.managerId) filter.managerId = q.managerId;
  if (q.gender) filter.gender = q.gender;
  if (q.minExperienceYears) filter.minExperienceYears = q.minExperienceYears;
  if (q.maxExperienceYears) filter.maxExperienceYears = q.maxExperienceYears;
  if (q.minPerformance) filter.minPerformance = q.minPerformance;
  if (q.riskLevel) filter.riskLevel = q.riskLevel;
  if (q.burnoutRisk) filter.burnoutRisk = q.burnoutRisk;
  if (q.sentiment) filter.sentiment = q.sentiment;
  if (q.startDate) filter.startDate = q.startDate;
  if (q.endDate) filter.endDate = q.endDate;
  return filter;
}

export async function getDashboard(req, res, next) {
  try {
    const data = await executiveService.getExecutiveDashboard(extractOrgId(req), extractFilter(req));
    return sendSuccess(res, 200, data, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getInsights(req, res, next) {
  try {
    const data = await executiveService.generateExecutiveInsights(extractOrgId(req), extractFilter(req));
    return sendSuccess(res, 200, { insights: data }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getInterventionAnalytics(req, res, next) {
  try {
    const data = await executiveService.getInterventionAnalytics(extractOrgId(req), extractFilter(req));
    return sendSuccess(res, 200, data, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getRoiAnalytics(req, res, next) {
  try {
    const data = await executiveService.getRoiAnalytics(extractOrgId(req), extractFilter(req));
    return sendSuccess(res, 200, data, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getForecast(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    const filter = extractFilter(req);
    const data = await executiveService.generateForecast(orgId, filter);
    await recordAudit(orgId, 'EXECUTIVE_FORECAST_GENERATED', req.auth.userId, { context: { filter } });
    return sendSuccess(res, 200, data, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function exportReport(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    const filter = extractFilter(req);
    const format = (req.params.format || '').toLowerCase();

    let buffer;
    let contentType;
    let filename;

    if (format === 'pdf') {
      buffer = await executiveReportService.generatePdfReport(orgId, filter);
      contentType = 'application/pdf';
      filename = 'executive-report.pdf';
    } else if (format === 'docx') {
      buffer = await executiveReportService.generateDocxReport(orgId, filter);
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filename = 'executive-report.docx';
    } else if (format === 'csv') {
      buffer = await executiveReportService.generateCsvReport(orgId, filter);
      contentType = 'text/csv';
      filename = 'executive-report.csv';
    } else {
      throw new AppError(400, 'INVALID_FORMAT', 'Format must be one of: pdf, docx, csv.');
    }

    await recordAudit(orgId, 'EXECUTIVE_REPORT_GENERATED', req.auth.userId, { context: { format, filter } });
    await recordAudit(orgId, 'EXECUTIVE_DASHBOARD_EXPORT', req.auth.userId, { context: { format, filter } });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    return next(error);
  }
}

export async function listAlerts(req, res, next) {
  try {
    const data = await executiveService.listAlerts(extractOrgId(req), { status: req.query.status });
    return sendSuccess(res, 200, { alerts: data }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function generateAlerts(req, res, next) {
  try {
    const data = await executiveService.generateAlerts(extractOrgId(req), extractFilter(req));
    return sendSuccess(res, 200, { created: data.length, alerts: data }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function dismissAlert(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    const alert = await executiveService.dismissAlert(req.params.id, req.auth.userId);
    await recordAudit(orgId, 'EXECUTIVE_ALERT_ACKNOWLEDGED', req.auth.userId, { entityType: 'EXECUTIVE_ALERT', entityId: req.params.id, context: { action: 'DISMISSED' } });
    return sendSuccess(res, 200, alert, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function reviewAlert(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    const alert = await executiveService.markAlertReviewed(req.params.id, req.auth.userId);
    await recordAudit(orgId, 'EXECUTIVE_ALERT_ACKNOWLEDGED', req.auth.userId, { entityType: 'EXECUTIVE_ALERT', entityId: req.params.id, context: { action: 'REVIEWED' } });
    return sendSuccess(res, 200, alert, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function assignAlert(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    if (!req.body?.assignedToUserId) {
      throw new AppError(422, 'VALIDATION_ERROR', 'assignedToUserId is required.');
    }
    const alert = await executiveService.assignAlertOwner(req.params.id, req.body.assignedToUserId);
    await recordAudit(orgId, 'EXECUTIVE_ALERT_ACKNOWLEDGED', req.auth.userId, { entityType: 'EXECUTIVE_ALERT', entityId: req.params.id, context: { action: 'ASSIGNED', assignedToUserId: req.body.assignedToUserId } });
    return sendSuccess(res, 200, alert, req.requestId);
  } catch (error) {
    return next(error);
  }
}
