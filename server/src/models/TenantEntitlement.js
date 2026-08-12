/**
 * @file TenantEntitlement.js
 * @description Provider-neutral Mongoose model for tenant entitlements and plan quotas.
 */

import mongoose from 'mongoose';

const tenantEntitlementSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['FREE', 'GROWTH', 'ENTERPRISE'],
      default: 'FREE',
    },
    maxEmployees: {
      type: Number,
      default: 50,
    },
    maxUsers: {
      type: Number,
      default: 5,
    },
    maxAiRequestsPerMonth: {
      type: Number,
      default: 100,
    },
    customEntitlements: {
      type: Map,
      of: Boolean,
      default: () => new Map([['ADVANCED_RAG', true], ['BIAS_AUDITING', true]]),
    },
  },
  { timestamps: true },
);

export const TenantEntitlement = mongoose.model('TenantEntitlement', tenantEntitlementSchema);
