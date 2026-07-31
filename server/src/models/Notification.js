import mongoose from 'mongoose';

/** Notification — Sprint 9 Part 4. In-app + "email-ready" (mocked) notification center. */

const NOTIFICATION_TYPES = [
  'HIGH_RISK_ALERT',
  'BURNOUT_ALERT',
  'INTERVENTION_ASSIGNED',
  'INTERVENTION_OVERDUE',
  'RECOMMENDATION_ACCEPTED',
  'RECOMMENDATION_REJECTED',
  'EXECUTIVE_ALERT',
  'TASK_ASSIGNED',
  'TASK_OVERDUE',
  'TASK_ESCALATED',
  'APPROVAL_REQUESTED',
  'APPROVAL_DECIDED',
  'DIGEST',
  'GENERIC',
];

const CHANNELS = ['IN_APP', 'EMAIL_READY'];

const notificationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true, index: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'LOW' },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    entityType: { type: String, default: null },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    channel: { type: String, enum: CHANNELS, default: 'IN_APP' },
    emailPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    emailSentAt: { type: Date, default: null },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false, index: true },
    isDismissed: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false },
);

notificationSchema.index({ recipientUserId: 1, isArchived: 1, isDismissed: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, isRead: 1 });
notificationSchema.index({ organizationId: 1, type: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);
export { NOTIFICATION_TYPES, CHANNELS };
