import { AuditLog } from '../models/AuditLog.js';
import { parse } from 'json2csv';
import { logger } from '../utils/logger.js';

/**
 * Writes one audit entry. Never throws into the caller's request flow — a
 * failed audit write must not break the underlying action it's recording.
 * This single collection backs both the Sprint 9 Activity Timeline (Part 6)
 * and the Audit Log viewer (Part 9); `entityType`/`entityId`/`ip`/`changes`
 * are optional so Sprint 8's simpler call sites keep working unchanged.
 */
export async function recordAudit(organizationId, action, userId, options = {}) {
  const { entityType = null, entityId = null, ip = null, changes = undefined, context = {} } = options;
  try {
    await AuditLog.create({ organizationId, action, userId, entityType, entityId, ip, changes, context });
  } catch (err) {
    logger.error('audit_write_failed', { action, message: err.message });
  }
}

export async function listAuditLog(organizationId, { action, entityType, entityId, userId, startDate, endDate, limit = 100 } = {}) {
  const filter = { organizationId };
  if (action) filter.action = action;
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (userId) filter.userId = userId;
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  return AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).populate('userId', 'name email').lean();
}

/** Same query as listAuditLog, rendered as a CSV buffer for the Part 9 "export audit logs" requirement. */
export async function exportAuditLogCsv(organizationId, filters = {}) {
  const rows = await listAuditLog(organizationId, { ...filters, limit: filters.limit || 5000 });
  const data = rows.map((r) => ({
    Timestamp: new Date(r.createdAt).toISOString(),
    Action: r.action,
    User: r.userId?.name || 'Unknown',
    UserEmail: r.userId?.email || '',
    EntityType: r.entityType || '',
    EntityId: r.entityId || '',
    IP: r.ip || '',
    OldValue: r.changes?.old !== undefined ? JSON.stringify(r.changes.old) : '',
    NewValue: r.changes?.new !== undefined ? JSON.stringify(r.changes.new) : '',
    Context: JSON.stringify(r.context || {}),
  }));
  if (data.length === 0) return 'Timestamp,Action,User,UserEmail,EntityType,EntityId,IP,OldValue,NewValue,Context\n';
  return parse(data);
}

/**
 * Activity Timeline (Part 6) — the same underlying log, read chronologically
 * across the broad set of "everything that happened" action types rather
 * than filtered to one action, department, or user like the Part 9 viewer.
 */
export async function listActivityTimeline(organizationId, { departmentId, entityType, limit = 100 } = {}) {
  const filter = { organizationId };
  if (entityType) filter.entityType = entityType;
  const rows = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).populate('userId', 'name email').lean();
  if (!departmentId) return rows;
  // Department scoping is best-effort: only entries whose context/changes carry a matching departmentId are kept.
  return rows.filter((r) => String(r.context?.departmentId || '') === String(departmentId));
}

export const auditService = { recordAudit, listAuditLog, exportAuditLogCsv, listActivityTimeline };
export default auditService;
