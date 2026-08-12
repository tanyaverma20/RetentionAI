/**
 * @file Invitation.js
 * @description Mongoose schema for secure, tenant-scoped user invitations.
 */

import mongoose from 'mongoose';

const invitationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
      default: 'PENDING',
    },
  },
  { timestamps: true },
);

invitationSchema.index({ organizationId: 1, email: 1, status: 1 });
invitationSchema.index({ tokenHash: 1 }, { unique: true });

export const Invitation = mongoose.model('Invitation', invitationSchema);
