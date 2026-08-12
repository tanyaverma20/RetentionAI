/**
 * @file BillingPlan.js
 * @description Centralized declarative plan catalog schema for SaaS pricing tiers.
 */

import mongoose from 'mongoose';

const billingPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      enum: ['FREE_TRIAL', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    monthlyPriceCents: {
      type: Number,
      required: true,
      min: 0,
    },
    annualPriceCents: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    features: {
      maxUsers: { type: Number, required: true },
      maxEmployees: { type: Number, required: true },
      aiRequestQuota: { type: Number, required: true },
      ragQueryQuota: { type: Number, default: 500 },
      exportQuota: { type: Number, default: 100 },
      storageQuotaBytes: { type: Number, required: true },
      hasObservability: { type: Boolean, default: false },
      hasGovernance: { type: Boolean, default: false },
      hasExecutiveAnalytics: { type: Boolean, default: false },
      hasAdvancedAgents: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

export const BillingPlan = mongoose.model('BillingPlan', billingPlanSchema);
