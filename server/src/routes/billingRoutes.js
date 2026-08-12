/**
 * @file billingRoutes.js
 * @description API router for commercial SaaS subscriptions, invoices, reconciliation, & webhooks.
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { enforceActiveOrganization } from '../middlewares/enforceActiveOrganization.js';
import {
  getPlanCatalogHandler,
  getSubscriptionHandler,
  updatePlanHandler,
  cancelSubscriptionHandler,
  reactivateSubscriptionHandler,
  listInvoicesHandler,
  reconcileBillingHandler,
  handleWebhookHandler,
} from '../controllers/billingController.js';

const router = Router();

// Unauthenticated signed Webhook endpoint
router.post('/webhooks/:provider', handleWebhookHandler);

// Public / Authenticated Plan Catalog
router.get('/plans', getPlanCatalogHandler);

// Protected Tenant-bound Routes (ADMIN / OWNER only)
router.use(authenticate);
router.use(enforceActiveOrganization);

router.get('/subscription', authorize('ADMIN'), getSubscriptionHandler);
router.patch('/subscription/plan', authorize('ADMIN'), updatePlanHandler);
router.post('/subscription/cancel', authorize('ADMIN'), cancelSubscriptionHandler);
router.post('/subscription/reactivate', authorize('ADMIN'), reactivateSubscriptionHandler);
router.get('/invoices', authorize('ADMIN'), listInvoicesHandler);
router.post('/reconcile', authorize('ADMIN'), reconcileBillingHandler);

export default router;
