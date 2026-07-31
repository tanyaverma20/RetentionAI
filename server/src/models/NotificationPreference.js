import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from './Notification.js';

/** NotificationPreference — Sprint 9 Part 4. One document per user; per-type in-app/email toggles. */

function defaultChannelMap() {
  const map = {};
  for (const type of NOTIFICATION_TYPES) {
    map[type] = { inApp: true, email: true };
  }
  return map;
}

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    channels: { type: mongoose.Schema.Types.Mixed, default: defaultChannelMap },
  },
  { timestamps: true },
);

export const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);
export { defaultChannelMap };
