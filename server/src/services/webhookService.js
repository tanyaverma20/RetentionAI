/**
 * @file webhookService.js
 * @description Webhook event signature validation, deduplication & event dispatcher.
 */

import { BillingEvent } from '../models/BillingEvent.js';
import { getBillingProvider, updateSubscriptionStatus, createInvoice } from './billingService.js';
import { recordAudit } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export async function processWebhookEvent({ providerName = 'MOCK', rawBody, signatureHeader, secret }) {
  const provider = getBillingProvider();
  
  // 1. Signature Verification
  let eventPayload;
  try {
    eventPayload = provider.verifyWebhookSignature(rawBody, signatureHeader, secret);
  } catch (err) {
    logger.warn('webhook_signature_failed', { providerName, error: err.message });
    throw new AppError(400, 'WEBHOOK_SIGNATURE_INVALID', `Webhook signature verification failed: ${err.message}`);
  }

  const { id: eventId, type: eventType, organizationId, data } = eventPayload;

  if (!eventId || !eventType) {
    throw new AppError(400, 'MALFORMED_WEBHOOK', 'Webhook payload missing required id or type.');
  }

  // 2. Replay Protection & Deduplication (Atomic Insert)
  let billingEvent;
  try {
    billingEvent = await BillingEvent.create({
      provider: providerName,
      eventId,
      eventType,
      organizationId: organizationId || null,
      status: 'PROCESSED',
    });
  } catch (err) {
    if (err.code === 11000) { // Duplicate key error
      logger.warn('webhook_replay_blocked', { providerName, eventId, eventType });
      if (organizationId) {
        await recordAudit(organizationId, 'WEBHOOK_REPLAY_BLOCKED', null, {
          context: { providerName, eventId, eventType },
        });
      }
      return { status: 'REPLAY_IGNORED', message: 'Webhook event was already processed.' };
    }
    throw err;
  }

  // 3. Dispatch Event to Business Logic State Transitions
  try {
    if (organizationId) {
      await recordAudit(organizationId, 'WEBHOOK_RECEIVED', null, {
        context: { eventId, eventType, providerName },
      });

      switch (eventType) {
        case 'customer.subscription.updated':
        case 'subscription.payment_succeeded':
          if (data?.status === 'active') {
            await updateSubscriptionStatus(organizationId, 'ACTIVE', 'Webhook payment success');
          }
          break;
        case 'invoice.payment_failed':
        case 'subscription.payment_failed':
          await updateSubscriptionStatus(organizationId, 'PAST_DUE', 'Webhook payment failed');
          await recordAudit(organizationId, 'PAYMENT_FAILED', null, { context: { eventId } });
          break;
        case 'customer.subscription.deleted':
          await updateSubscriptionStatus(organizationId, 'CANCELLED', 'Webhook subscription deleted');
          break;
        default:
          break;
      }
    }
  } catch (dispatchErr) {
    logger.error('webhook_dispatch_error', { eventId, error: dispatchErr.message });
    billingEvent.status = 'FAILED';
    billingEvent.errorCode = dispatchErr.code || 'DISPATCH_ERROR';
    await billingEvent.save();
  }

  return { status: 'PROCESSED', eventId };
}
