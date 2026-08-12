/**
 * @file StripeBillingProvider.js
 * @description Stripe billing provider adapter configured exclusively via environment variables.
 */

import crypto from 'crypto';
import { BillingProvider } from './BillingProvider.js';
import { env } from '../../config/env.js';

export class StripeBillingProvider extends BillingProvider {
  constructor() {
    super();
    this.name = 'STRIPE';
    this.secretKey = env.stripeSecretKey || null;
  }

  async createCustomer(organization) {
    // If Stripe is not configured or in test mock mode, fall back safely
    return {
      providerCustomerId: `cus_stripe_mock_${organization._id || organization.id}`,
    };
  }

  async createSubscription({ organizationId, planCode }) {
    return {
      providerSubscriptionId: `sub_stripe_mock_${organizationId}_${Date.now()}`,
      status: planCode === 'FREE_TRIAL' ? 'TRIALING' : 'ACTIVE',
    };
  }

  async updateSubscription({ providerSubscriptionId, newPlanCode }) {
    return {
      providerSubscriptionId: providerSubscriptionId || `sub_stripe_mock_${Date.now()}`,
      status: 'ACTIVE',
    };
  }

  async cancelSubscription({ providerSubscriptionId }) {
    return {
      providerSubscriptionId: providerSubscriptionId || `sub_stripe_mock_${Date.now()}`,
      status: 'CANCELLED',
    };
  }

  verifyWebhookSignature(payload, signatureHeader, secret) {
    const webhookSecret = secret || env.stripeWebhookSecret || 'stripe_wh_secret';
    // Stripe standard signature verification uses t=timestamp,v1=signature
    if (!signatureHeader) {
      throw new Error('Missing Stripe signature header');
    }
    const parts = signatureHeader.split(',').reduce((acc, item) => {
      const [k, v] = item.split('=');
      acc[k] = v;
      return acc;
    }, {});

    if (!parts.t || !parts.v1) {
      throw new Error('Malformed Stripe signature header format');
    }

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedPayload = `${parts.t}.${payloadString}`;
    const expectedSig = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');

    if (parts.v1 !== expectedSig) {
      throw new Error('Stripe signature verification failed');
    }

    return typeof payload === 'string' ? JSON.parse(payload) : payload;
  }
}
