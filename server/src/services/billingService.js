/**
 * @file billingService.js
 * @description Centralized commercial billing service, state machine, entitlement sync & invoice engine.
 */

import { BillingPlan } from '../models/BillingPlan.js';
import { Subscription } from '../models/Subscription.js';
import { Invoice } from '../models/Invoice.js';
import { TenantEntitlement } from '../models/TenantEntitlement.js';
import { recordAudit } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { MockBillingProvider } from './billing/MockBillingProvider.js';
import { StripeBillingProvider } from './billing/StripeBillingProvider.js';
import { env } from '../config/env.js';

// Default plan seed specifications
export const PLAN_CATALOG = [
  {
    code: 'FREE_TRIAL',
    name: 'Free Trial Plan',
    description: '14-day full feature trial with basic quotas',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    features: {
      maxUsers: 5,
      maxEmployees: 50,
      aiRequestQuota: 200,
      ragQueryQuota: 100,
      exportQuota: 20,
      storageQuotaBytes: 1073741824, // 1GB
      hasObservability: true,
      hasGovernance: true,
      hasExecutiveAnalytics: false,
      hasAdvancedAgents: false,
    },
  },
  {
    code: 'STARTER',
    name: 'Starter SaaS Plan',
    description: 'For small teams scaling employee retention',
    monthlyPriceCents: 29900,
    annualPriceCents: 299000,
    features: {
      maxUsers: 15,
      maxEmployees: 250,
      aiRequestQuota: 1000,
      ragQueryQuota: 500,
      exportQuota: 100,
      storageQuotaBytes: 10737418240, // 10GB
      hasObservability: true,
      hasGovernance: true,
      hasExecutiveAnalytics: false,
      hasAdvancedAgents: false,
    },
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional Enterprise Plan',
    description: 'Advanced AI intelligence, executive analytics & SLA escalations',
    monthlyPriceCents: 89900,
    annualPriceCents: 899000,
    features: {
      maxUsers: 50,
      maxEmployees: 1000,
      aiRequestQuota: 5000,
      ragQueryQuota: 2500,
      exportQuota: 500,
      storageQuotaBytes: 53687091200, // 50GB
      hasObservability: true,
      hasGovernance: true,
      hasExecutiveAnalytics: true,
      hasAdvancedAgents: true,
    },
  },
  {
    code: 'ENTERPRISE',
    name: 'Custom Enterprise Tier',
    description: 'Unlimited capacity, dedicated LLM evaluation & 24/7 SLA',
    monthlyPriceCents: 249900,
    annualPriceCents: 2499000,
    features: {
      maxUsers: 500,
      maxEmployees: 10000,
      aiRequestQuota: 50000,
      ragQueryQuota: 25000,
      exportQuota: 5000,
      storageQuotaBytes: 536870912000, // 500GB
      hasObservability: true,
      hasGovernance: true,
      hasExecutiveAnalytics: true,
      hasAdvancedAgents: true,
    },
  },
];

// Valid State Transitions Map
const VALID_STATE_TRANSITIONS = {
  TRIALING: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  ACTIVE: ['PAST_DUE', 'CANCELLED', 'SUSPENDED'],
  PAST_DUE: ['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'],
  GRACE_PERIOD: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: ['ACTIVE', 'EXPIRED'],
  EXPIRED: ['ACTIVE', 'TRIALING'],
};

export function getBillingProvider() {
  if (env.stripeSecretKey) {
    return new StripeBillingProvider();
  }
  return new MockBillingProvider();
}

/**
 * Seed plan catalog if not initialized.
 */
export async function ensurePlanCatalog() {
  for (const planData of PLAN_CATALOG) {
    await BillingPlan.updateOne({ code: planData.code }, { $setOnInsert: planData }, { upsert: true });
  }
}

/**
 * Sync TenantEntitlement with current Subscription plan features.
 */
export async function syncEntitlementsWithPlan(organizationId, planCode) {
  await ensurePlanCatalog();
  const plan = await BillingPlan.findOne({ code: planCode }).lean();
  if (!plan) return;

  await TenantEntitlement.updateOne(
    { organizationId },
    {
      $set: {
        maxUsers: plan.features.maxUsers,
        maxEmployees: plan.features.maxEmployees,
        maxAiRequestsPerMonth: plan.features.aiRequestQuota,
      },
    },
    { upsert: true },
  );
}

/**
 * Provision new organization trial subscription.
 */
export async function provisionTrialSubscription(organizationId, userId = null) {
  await ensurePlanCatalog();

  const existing = await Subscription.findOne({ organizationId });
  if (existing) {
    return existing; // Idempotent
  }

  const provider = getBillingProvider();
  const customer = await provider.createCustomer({ id: organizationId });

  const trialDays = 14;
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

  const subscription = await Subscription.create({
    organizationId,
    planCode: 'FREE_TRIAL',
    status: 'TRIALING',
    billingInterval: 'MONTHLY',
    currentPeriodStart: now,
    currentPeriodEnd: trialEndsAt,
    trialStartsAt: now,
    trialEndsAt,
    provider: provider.name,
    providerCustomerId: customer.providerCustomerId,
  });

  await syncEntitlementsWithPlan(organizationId, 'FREE_TRIAL');

  await recordAudit(organizationId, 'TRIAL_STARTED', userId, {
    entityType: 'SUBSCRIPTION',
    entityId: subscription._id,
    context: { planCode: 'FREE_TRIAL', trialEndsAt },
  });

  return subscription;
}

/**
 * Get subscription for organization.
 */
export async function getSubscription(organizationId) {
  await ensurePlanCatalog();
  let subscription = await Subscription.findOne({ organizationId }).lean();
  if (!subscription) {
    // Lazy provision if missing
    subscription = await provisionTrialSubscription(organizationId);
    subscription = subscription.toObject ? subscription.toObject() : subscription;
  }

  const plan = await BillingPlan.findOne({ code: subscription.planCode }).lean();
  return {
    subscription,
    plan,
  };
}

/**
 * Change subscription plan (Upgrade / Downgrade).
 */
export async function changeSubscriptionPlan(organizationId, { newPlanCode, billingInterval = 'MONTHLY' }, adminUserId) {
  await ensurePlanCatalog();
  const subscription = await Subscription.findOne({ organizationId });
  if (!subscription) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found for this organization.');
  }

  const targetPlan = await BillingPlan.findOne({ code: newPlanCode, isActive: true });
  if (!targetPlan) {
    throw new AppError(400, 'INVALID_PLAN', `Billing plan '${newPlanCode}' does not exist or is inactive.`);
  }

  const oldPlanCode = subscription.planCode;
  const isUpgrade = targetPlan.monthlyPriceCents > (subscription.monthlyPriceCents || 0);

  const provider = getBillingProvider();
  await provider.updateSubscription({
    providerSubscriptionId: subscription.providerSubscriptionId,
    newPlanCode,
  });

  const now = new Date();
  const periodEnd = new Date(now.getTime() + (billingInterval === 'ANNUAL' ? 365 : 30) * 24 * 60 * 60 * 1000);

  subscription.planCode = newPlanCode;
  subscription.status = 'ACTIVE';
  subscription.billingInterval = billingInterval;
  subscription.currentPeriodStart = now;
  subscription.currentPeriodEnd = periodEnd;
  await subscription.save();

  // Sync entitlements
  await syncEntitlementsWithPlan(organizationId, newPlanCode);

  // Generate invoice for paid plan transitions
  if (targetPlan.monthlyPriceCents > 0) {
    await createInvoice({
      organizationId,
      subscriptionId: subscription._id,
      amountCents: billingInterval === 'ANNUAL' ? targetPlan.annualPriceCents : targetPlan.monthlyPriceCents,
      description: `Subscription ${newPlanCode} (${billingInterval})`,
    });
  }

  const auditAction = isUpgrade ? 'SUBSCRIPTION_UPGRADED' : 'SUBSCRIPTION_DOWNGRADED';
  await recordAudit(organizationId, auditAction, adminUserId, {
    entityType: 'SUBSCRIPTION',
    entityId: subscription._id,
    context: { oldPlanCode, newPlanCode, billingInterval },
  });

  return subscription;
}

/**
 * Execute state machine transition.
 */
export async function updateSubscriptionStatus(organizationId, targetStatus, reason = '', adminUserId = null) {
  const subscription = await Subscription.findOne({ organizationId });
  if (!subscription) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription record not found.');
  }

  const allowed = VALID_STATE_TRANSITIONS[subscription.status];
  if (!allowed || !allowed.includes(targetStatus)) {
    throw new AppError(400, 'INVALID_STATE_TRANSITION', `Cannot transition subscription state from ${subscription.status} to ${targetStatus}.`);
  }

  const oldStatus = subscription.status;
  subscription.status = targetStatus;
  if (targetStatus === 'CANCELLED') {
    subscription.cancelledAt = new Date();
  }
  await subscription.save();

  let auditAction = 'SUBSCRIPTION_ACTIVATED';
  if (targetStatus === 'CANCELLED') auditAction = 'SUBSCRIPTION_CANCELLED';
  if (targetStatus === 'SUSPENDED') auditAction = 'SUBSCRIPTION_SUSPENDED';

  await recordAudit(organizationId, auditAction, adminUserId, {
    entityType: 'SUBSCRIPTION',
    entityId: subscription._id,
    context: { oldStatus, newStatus: targetStatus, reason },
  });

  return subscription;
}

/**
 * Create Invoice record.
 */
export async function createInvoice({ organizationId, subscriptionId, amountCents, description }) {
  const count = await Invoice.countDocuments({ organizationId });
  const invoiceNumber = `INV-${String(organizationId).slice(-6).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;

  const now = new Date();
  const dueAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const invoice = await Invoice.create({
    organizationId,
    subscriptionId,
    invoiceNumber,
    status: 'PAID',
    subtotalCents: amountCents,
    taxCents: 0,
    totalCents: amountCents,
    billingPeriodStart: now,
    billingPeriodEnd: dueAt,
    lineItems: [{ description, amountCents, quantity: 1, metricType: 'BASE_PLAN' }],
    dueAt,
    paidAt: now,
  });

  await recordAudit(organizationId, 'INVOICE_PAID', null, {
    entityType: 'INVOICE',
    entityId: invoice._id,
    context: { invoiceNumber, totalCents: amountCents },
  });

  return invoice;
}

/**
 * Read-only Billing Reconciliation Service.
 */
export async function reconcileBilling(organizationId) {
  const subscription = await Subscription.findOne({ organizationId }).lean();
  const entitlement = await TenantEntitlement.findOne({ organizationId }).lean();
  const plan = subscription ? await BillingPlan.findOne({ code: subscription.planCode }).lean() : null;

  const discrepancies = [];
  if (subscription && entitlement && plan) {
    if (entitlement.maxUsers !== plan.features.maxUsers) {
      discrepancies.push(`User quota mismatch: entitlement=${entitlement.maxUsers}, plan=${plan.features.maxUsers}`);
    }
    if (entitlement.maxAiRequestsPerMonth !== plan.features.aiRequestQuota) {
      discrepancies.push(`AI request quota mismatch: entitlement=${entitlement.maxAiRequestsPerMonth}, plan=${plan.features.aiRequestQuota}`);
    }
  }

  await recordAudit(organizationId, 'BILLING_RECONCILED', null, {
    context: { discrepancyCount: discrepancies.length, discrepancies },
  });

  return {
    synchronized: discrepancies.length === 0,
    discrepancies,
    subscription,
    plan,
  };
}
