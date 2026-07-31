import { auditService } from '../services/auditService.js';
import { sendSuccess } from '../utils/response.js';
import { logger } from '../utils/logger.js';

function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export async function listAuditLog(req, res, next) {
  try {
    const { action, entityType, entityId, userId, startDate, endDate, limit } = req.query;
    const result = await auditService.listAuditLog(extractOrgId(req), {
      action, entityType, entityId, userId, startDate, endDate, limit: limit ? Number(limit) : undefined,
    });
    return sendSuccess(res, 200, { entries: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function exportAuditLog(req, res, next) {
  try {
    const { action, entityType, entityId, userId, startDate, endDate } = req.query;
    const csv = await auditService.exportAuditLogCsv(extractOrgId(req), { action, entityType, entityId, userId, startDate, endDate });
    logger.info('audit_export', { filters: { action, entityType, entityId, userId, startDate, endDate }, requestedBy: req.auth?.userId });
    res.header('Content-Type', 'text/csv');
    res.attachment(`audit-log_${new Date().toISOString().split('T')[0]}.csv`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
}

export async function getActivityTimeline(req, res, next) {
  try {
    const { departmentId, entityType, limit } = req.query;
    const result = await auditService.listActivityTimeline(extractOrgId(req), {
      departmentId, entityType, limit: limit ? Number(limit) : undefined,
    });
    return sendSuccess(res, 200, { activity: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}
