/**
 * @file MockBillingProvider.js
 * @description Deterministic, network-free mock billing provider for automated tests and CI.
 */

import crypto from 'crypto';
import { BillingProvider } from './BillingProvider.js';

export class MockBillingProvider extends BillingProvider {
  constructor() {
    super();
    this.name = 'MOCK';
  }

  async createCustomer(organization) {
    return {
      providerCustomerId: `mock_cus_${organization._id || organization.id}_${Date.now()}`,
    };
  }

  async createSubscription({ organizationId, planCode, billingInterval }) {
    return {
      providerSubscriptionId: `mock_sub_${organizationId}_${Date.now()}`,
      status: planCode === 'FREE_TRIAL' ? 'TRIALING' : 'ACTIVE',
    };
  }

  async updateSubscription({ providerSubscriptionId, newPlanCode }) {
    return {
      providerSubscriptionId: providerSubscriptionId || `mock_sub_${Date.now()}`,
      status: newPlanCode === 'FREE_TRIAL' ? 'TRIALING' : 'ACTIVE',
    };
  }

  async cancelSubscription({ providerSubscriptionId }) {
    return {
      providerSubscriptionId: providerSubscriptionId || `mock_sub_${Date.now()}`,
      status: 'CANCELLED',
    };
  }

  verifyWebhookSignature(payload, signatureHeader, secret) {
    if (!signatureHeader) {
      throw new Error('Missing webhook signature header');
    }
    const expectedSecret = secret || 'mock_secret';
    const computedSig = crypto.createHmac('sha256', expectedSecret).update(typeof payload === 'string' ? payload : JSON.stringify(payload)).digest('hex');
    
    if (signatureHeader !== computedSig) {
      throw new Error('Invalid HMAC signature');
    }
    return typeof payload === 'string' ? JSON.parse(payload) : payload;
  }
}
