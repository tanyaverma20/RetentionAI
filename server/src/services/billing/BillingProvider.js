/**
 * @file BillingProvider.js
 * @description Provider-agnostic interface for external billing operations.
 */

export class BillingProvider {
  /**
   * Create customer reference with provider.
   * @param {Object} organization
   * @returns {Promise<{ providerCustomerId: string }>}
   */
  async createCustomer(organization) {
    throw new Error('createCustomer must be implemented by BillingProvider subclass');
  }

  /**
   * Create subscription with provider.
   * @param {Object} params
   * @returns {Promise<{ providerSubscriptionId: string, status: string }>}
   */
  async createSubscription(params) {
    throw new Error('createSubscription must be implemented by BillingProvider subclass');
  }

  /**
   * Update subscription plan.
   * @param {Object} params
   * @returns {Promise<{ providerSubscriptionId: string, status: string }>}
   */
  async updateSubscription(params) {
    throw new Error('updateSubscription must be implemented by BillingProvider subclass');
  }

  /**
   * Cancel subscription.
   * @param {Object} params
   * @returns {Promise<{ providerSubscriptionId: string, status: string }>}
   */
  async cancelSubscription(params) {
    throw new Error('cancelSubscription must be implemented by BillingProvider subclass');
  }

  /**
   * Verify webhook signature.
   * @param {string|Buffer} rawBody
   * @param {string} signatureHeader
   * @param {string} secret
   * @returns {Object} decoded event
   */
  verifyWebhookSignature(rawBody, signatureHeader, secret) {
    throw new Error('verifyWebhookSignature must be implemented by BillingProvider subclass');
  }
}
