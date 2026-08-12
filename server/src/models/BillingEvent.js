/**
 * @file BillingEvent.js
 * @description Webhook audit log and deduplication record enforcing replay protection.
 */

import mongoose from 'mongoose';

const billingEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ['MOCK', 'STRIPE'],
    },
    eventId: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['PROCESSED', 'IGNORED', 'FAILED'],
      default: 'PROCESSED',
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    correlationId: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

// Compound Unique Index on provider + eventId to strictly prevent webhook replays
billingEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const BillingEvent = mongoose.model('BillingEvent', billingEventSchema);
