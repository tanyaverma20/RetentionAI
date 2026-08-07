import { notificationService } from '../services/notificationService.js';
import { sendSuccess } from '../utils/response.js';

export async function listNotifications(req, res, next) {
  try {
    const { isRead, isArchived, limit } = req.query;
    const filter = {};
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (isArchived !== undefined) filter.isArchived = isArchived === 'true';
    if (limit) filter.limit = Number(limit);
    const [notifications, unreadCount] = await Promise.all([
      notificationService.listNotifications(req.auth.userId, filter),
      notificationService.unreadCount(req.auth.userId),
    ]);
    return sendSuccess(res, 200, { notifications, unreadCount }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function markRead(req, res, next) {
  try {
    const result = await notificationService.markRead(req.params.id, req.auth.userId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await notificationService.markAllRead(req.auth.userId);
    return sendSuccess(res, 200, { success: true }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function archiveNotification(req, res, next) {
  try {
    const result = await notificationService.archive(req.params.id, req.auth.userId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function dismissNotification(req, res, next) {
  try {
    const result = await notificationService.dismiss(req.params.id, req.auth.userId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getPreferences(req, res, next) {
  try {
    const result = await notificationService.getPreferences(req.auth.userId, req.auth.organizationId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function updatePreferences(req, res, next) {
  try {
    const { channels } = req.body || {};
    const result = await notificationService.updatePreferences(req.auth.userId, req.auth.organizationId, channels || {});
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}
