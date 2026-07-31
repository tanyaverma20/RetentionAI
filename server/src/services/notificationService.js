import { Notification, NOTIFICATION_TYPES } from '../models/Notification.js';
import { NotificationPreference, defaultChannelMap } from '../models/NotificationPreference.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { AppError } from '../errors/AppError.js';
import { sendMockEmail } from './mockEmailService.js';

async function getPreference(userId) {
  let pref = await NotificationPreference.findOne({ userId }).lean();
  if (!pref) return { channels: defaultChannelMap() };
  return pref;
}

/**
 * Create and deliver one notification. Respects the recipient's per-type
 * channel preferences: in-app is skipped if disabled, and the "email" leg
 * is simulated via mockEmailService only if the recipient has email enabled
 * for that notification type.
 */
export async function notify(organizationId, recipientUserId, { type, severity = 'LOW', title, message = '', entityType = null, entityId = null }) {
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new AppError(400, 'INVALID_NOTIFICATION_TYPE', `type must be one of: ${NOTIFICATION_TYPES.join(', ')}`);
  }
  const pref = await getPreference(recipientUserId);
  const channelPref = pref.channels?.[type] || { inApp: true, email: true };

  const doc = {
    organizationId,
    recipientUserId,
    type,
    severity,
    title,
    message,
    entityType,
    entityId,
    channel: channelPref.email ? 'EMAIL_READY' : 'IN_APP',
  };

  if (channelPref.email) {
    const recipient = await User.findById(recipientUserId).select('name email').lean();
    if (recipient) {
      const emailPayload = sendMockEmail({ to: recipient.email, subject: title, body: message });
      doc.emailPayload = emailPayload;
      doc.emailSentAt = emailPayload.sentAt;
    }
  }

  // in-app suppressed entirely -> still record the row (audit trail) but
  // callers listing "in-app" notifications filter isArchived/isDismissed,
  // not this preference, since a fully-disabled type simply won't be created
  // when neither channel is enabled.
  if (!channelPref.inApp && !channelPref.email) return null;

  return Notification.create(doc);
}

/**
 * Notify every user holding one of `roleNames`. Deliberately not filtered by
 * User.organizationId — this single-tenant MVP stamps organizationId on
 * workflow documents (via each controller's extractOrgId fallback) but not
 * reliably on User docs themselves (seeded accounts never set it), so
 * filtering the recipient query by it would silently match zero users.
 */
export async function notifyByRole(organizationId, roleNames, payload) {
  const roles = await Role.find({ name: { $in: roleNames } }).select('_id').lean();
  const roleIds = roles.map((r) => r._id);
  const users = await User.find({ roleId: { $in: roleIds }, status: 'ACTIVE' }).select('_id').lean();
  return Promise.all(users.map((u) => notify(organizationId, u._id, payload)));
}

export async function listNotifications(recipientUserId, { isRead, isArchived = false, limit = 50 } = {}) {
  const filter = { recipientUserId, isArchived, isDismissed: false };
  if (isRead !== undefined) filter.isRead = isRead;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

export async function unreadCount(recipientUserId) {
  return Notification.countDocuments({ recipientUserId, isRead: false, isArchived: false, isDismissed: false });
}

async function mutateOwned(notificationId, recipientUserId, update) {
  const notification = await Notification.findOneAndUpdate({ _id: notificationId, recipientUserId }, update, { new: true });
  if (!notification) throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
  return notification;
}

export function markRead(notificationId, recipientUserId) {
  return mutateOwned(notificationId, recipientUserId, { isRead: true, readAt: new Date() });
}

export function markAllRead(recipientUserId) {
  return Notification.updateMany({ recipientUserId, isRead: false }, { isRead: true, readAt: new Date() });
}

export function archive(notificationId, recipientUserId) {
  return mutateOwned(notificationId, recipientUserId, { isArchived: true });
}

export function dismiss(notificationId, recipientUserId) {
  return mutateOwned(notificationId, recipientUserId, { isDismissed: true });
}

export async function getPreferences(userId, organizationId) {
  let pref = await NotificationPreference.findOne({ userId }).lean();
  if (!pref) {
    pref = await NotificationPreference.create({ userId, organizationId, channels: defaultChannelMap() });
    pref = pref.toObject();
  }
  return pref;
}

export async function updatePreferences(userId, organizationId, channels) {
  return NotificationPreference.findOneAndUpdate(
    { userId },
    { userId, organizationId, channels },
    { upsert: true, new: true },
  );
}

export const notificationService = {
  notify,
  notifyByRole,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  archive,
  dismiss,
  getPreferences,
  updatePreferences,
};
export default notificationService;
