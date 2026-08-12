/**
 * @file billingController.js
 * @description HTTP Controller for commercial SaaS subscriptions, plan catalog, invoices, & webhooks.
 */

import {
  getSubscription,
  changeSubscriptionPlan,
  updateSubscriptionStatus,
  reconcileBilling,
  PLAN_CATALOG,
} from '../services/billingService.js';
import { processWebhookEvent } from '../services/webhookService.js';
import { Invoice } from '../models/Invoice.js';
import { sendSuccess, sendError } from '../utils/response.js';

export async function getPlanCatalogHandler(req, res, next) {
  try {
    return sendSuccess(res, 200, { plans: PLAN_CATALOG }, req.id);
  } catch (err) {
    return next(err);
  }
}

export async function getSubscriptionHandler(req, res, next) {
  try {
    const organizationId = req.auth?.organizationId || req.user?.organizationId;
    const data = await getSubscription(organizationId);
    return sendSuccess(res, 200, data, req.id);
  } catch (err) {
    return next(err);
  }
}

export async function updatePlanHandler(req, res, next) {
  try {
    const organizationId = req.auth?.organizationId || req.user?.organizationId;
    const adminUserId = req.auth?.userId || req.user?.id;
    const { newPlanCode, billingInterval } = req.body;

    const subscription = await changeSubscriptionPlan(
      organizationId,
      { newPlanCode, billingInterval },
      adminUserId,
    );

    return sendSuccess(res, 200, { subscription }, req.id);
  } catch (err) {
    return next(err);
  }
}

export async function cancelSubscriptionHandler(req, res, next) {
  try {
    const organizationId = req.auth?.organizationId || req.user?.organizationId;
    const adminUserId = req.auth?.userId || req.user?.id;

    const subscription = await updateSubscriptionStatus(
      organizationId,
      'CANCELLED',
      'User requested cancellation',
      adminUserId,
    );

    return sendSuccess(res, 200, { subscription }, req.id);
  } catch (err) {
    return next(err);
  }
}

export async function reactivateSubscriptionHandler(req, res, next) {
  try {
    const organizationId = req.auth?.organizationId || req.user?.organizationId;
    const adminUserId = req.auth?.userId || req.user?.id;

    const subscription = await updateSubscriptionStatus(
      organizationId,
      'ACTIVE',
      'User requested reactivation',
      adminUserId,
    );

    return sendSuccess(res, 200, { subscription }, req.id);
  } catch (err) {
    return next(err);
  }
}

export async function listInvoicesHandler(req, res, next) {
  try {
    const organizationId = req.auth?.organizationId || req.user?.organizationId;
    const invoices = await Invoice.find({ organizationId }).sort({ createdAt: -1 }).lean();
    return sendSuccess(res, 200, { invoices }, req.id);
  } catch (err) {
    return next(err);
  }
}

export async function reconcileBillingHandler(req, res, next) {
  try {
    const organizationId = req.auth?.organizationId || req.user?.organizationId;
    const result = await reconcileBilling(organizationId);
    return sendSuccess(res, 200, result, req.id);
  } catch (err) {
    return next(err);
  }
}

export async function handleWebhookHandler(req, res, next) {
  try {
    const providerName = req.params.provider?.toUpperCase() || 'MOCK';
    const signatureHeader = req.headers['x-signature'] || req.headers['stripe-signature'] || req.headers['signature'];
    const secret = req.query.secret || req.headers['x-webhook-secret'];

    const result = await processWebhookEvent({
      providerName,
      rawBody: req.body,
      signatureHeader,
      secret,
    });

    return sendSuccess(res, 200, result, req.id);
  } catch (err) {
    return sendError(res, err.statusCode || 400, err.code || 'WEBHOOK_FAILED', err.message, req.id);
  }
}
