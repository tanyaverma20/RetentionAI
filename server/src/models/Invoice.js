/**
 * @file Invoice.js
 * @description Safe invoice tracking model storing non-sensitive billing metadata.
 */

import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true },
    amountCents: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    metricType: { type: String, default: 'BASE_PLAN' },
  },
  { _id: false },
);

const invoiceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE', 'FAILED'],
      default: 'OPEN',
      index: true,
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    billingPeriodStart: { type: Date, required: true },
    billingPeriodEnd: { type: Date, required: true },
    lineItems: [lineItemSchema],
    subtotalCents: { type: Number, required: true, min: 0 },
    taxCents: { type: Number, default: 0, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    providerInvoiceId: { type: String, default: null, index: true },
    hostedInvoiceUrl: { type: String, default: null },
    issuedAt: { type: Date, default: Date.now },
    dueAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Invoice = mongoose.model('Invoice', invoiceSchema);
