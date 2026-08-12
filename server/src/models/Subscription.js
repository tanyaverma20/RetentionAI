/**
 * @file Subscription.js
 * @description Tenant-scoped subscription model enforcing state machine & billing cycles.
 */

import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true, // One active subscription doc per organization
      index: true,
    },
    planCode: {
      type: String,
      required: true,
      enum: ['FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
    },
    status: {
      type: String,
      required: true,
      enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED'],
      default: 'TRIALING',
      index: true,
    },
    billingInterval: {
      type: String,
      enum: ['MONTHLY', 'ANNUAL'],
      default: 'MONTHLY',
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    trialStartsAt: {
      type: Date,
      default: Date.now,
    },
    trialEndsAt: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    provider: {
      type: String,
      enum: ['MOCK', 'STRIPE'],
      default: 'MOCK',
    },
    providerCustomerId: {
      type: String,
      default: null,
      index: true,
    },
    providerSubscriptionId: {
      type: String,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
