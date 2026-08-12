/**
 * @file billing.integration.test.js
 * @description Comprehensive Prompt 13 integration test suite for Enterprise Billing, Subscription Lifecycle & Revenue Operations.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import crypto from 'crypto';
import mongoose from 'mongoose';

import { app } from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Subscription } from '../src/models/Subscription.js';
import { Invoice } from '../src/models/Invoice.js';
import { BillingEvent } from '../src/models/BillingEvent.js';
import { TenantEntitlement } from '../src/models/TenantEntitlement.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { createAccessToken } from '../src/utils/tokens.js';
import { hashPassword } from '../src/utils/password.js';

describe('Prompt 13 — Enterprise Billing, Subscription Lifecycle & Revenue Operations Integration Suite', () => {
  let orgA, orgB;
  let adminUserA, employeeUserA, adminUserB;
  let adminTokenA, employeeTokenA, adminTokenB;
  let adminRole, employeeRole;

  before(async () => {
    await connectDatabase();

    // Roles
    adminRole = await Role.findOne({ name: 'ADMIN' });
    if (!adminRole) {
      adminRole = await Role.create({ name: 'ADMIN', permissions: ['*'] });
    }

    employeeRole = await Role.findOne({ name: 'EMPLOYEE' });
    if (!employeeRole) {
      employeeRole = await Role.create({ name: 'EMPLOYEE', permissions: ['READ_SELF'] });
    }

    // Tenant Org A
    orgA = await Organization.create({
      name: 'Billing Test Alpha Corp',
      slug: `billing-alpha-${Date.now()}`,
      status: 'ACTIVE',
    });

    // Tenant Org B (For Cross-Tenant Isolation)
    orgB = await Organization.create({
      name: 'Billing Test Beta Corp',
      slug: `billing-beta-${Date.now()}`,
      status: 'ACTIVE',
    });

    const passHash = await hashPassword('Password123!');

    adminUserA = await User.create({
      organizationId: orgA._id,
      name: 'Alice Billing Admin',
      email: `admin.billing.a.${Date.now()}@alpha.com`,
      passwordHash: passHash,
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    employeeUserA = await User.create({
      organizationId: orgA._id,
      name: 'Bob Employee',
      email: `employee.a.${Date.now()}@alpha.com`,
      passwordHash: passHash,
      roleId: employeeRole._id,
      status: 'ACTIVE',
    });

    adminUserB = await User.create({
      organizationId: orgB._id,
      name: 'Charlie Beta Admin',
      email: `admin.billing.b.${Date.now()}@beta.com`,
      passwordHash: passHash,
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    adminTokenA = createAccessToken({ id: adminUserA._id, role: { name: 'ADMIN' }, organizationId: orgA._id });
    employeeTokenA = createAccessToken({ id: employeeUserA._id, role: { name: 'EMPLOYEE' }, organizationId: orgA._id });
    adminTokenB = createAccessToken({ id: adminUserB._id, role: { name: 'ADMIN' }, organizationId: orgB._id });
  });

  after(async () => {
    if (orgA) {
      await Subscription.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await Invoice.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await BillingEvent.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await TenantEntitlement.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await User.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await Organization.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
    }
    await disconnectDatabase();
  });

  it('1. Lazy provision FREE_TRIAL subscription for new organization', async () => {
    const res = await request(app)
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${adminTokenA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.subscription.planCode, 'FREE_TRIAL');
    assert.equal(res.body.data.subscription.status, 'TRIALING');

    // Verify Audit Event
    const audit = await AuditLog.findOne({
      organizationId: orgA._id,
      action: 'TRIAL_STARTED',
    });
    assert.ok(audit);
  });

  it('2. Plan Catalog endpoint exposes configuration-driven tiers', async () => {
    const res = await request(app).get('/api/v1/billing/plans');

    assert.equal(res.status, 200);
    assert.equal(res.body.data.plans.length, 4);
    const codes = res.body.data.plans.map((p) => p.code);
    assert.ok(codes.includes('FREE_TRIAL'));
    assert.ok(codes.includes('STARTER'));
    assert.ok(codes.includes('PROFESSIONAL'));
    assert.ok(codes.includes('ENTERPRISE'));
  });

  it('3. Upgrade plan to PROFESSIONAL updates subscription & syncs entitlements', async () => {
    const res = await request(app)
      .patch('/api/v1/billing/subscription/plan')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ newPlanCode: 'PROFESSIONAL', billingInterval: 'MONTHLY' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.subscription.planCode, 'PROFESSIONAL');
    assert.equal(res.body.data.subscription.status, 'ACTIVE');

    // Verify Entitlement Sync
    const entitlement = await TenantEntitlement.findOne({ organizationId: orgA._id });
    assert.equal(entitlement.maxUsers, 50);
    assert.equal(entitlement.maxEmployees, 1000);

    // Verify Invoice Generated
    const invoice = await Invoice.findOne({ organizationId: orgA._id });
    assert.ok(invoice);
    assert.equal(invoice.totalCents, 89900);
    assert.equal(invoice.status, 'PAID');
  });

  it('4. Downgrade plan to STARTER updates subscription without deleting data', async () => {
    const res = await request(app)
      .patch('/api/v1/billing/subscription/plan')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ newPlanCode: 'STARTER', billingInterval: 'MONTHLY' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.subscription.planCode, 'STARTER');

    // Verify Entitlement Sync
    const entitlement = await TenantEntitlement.findOne({ organizationId: orgA._id });
    assert.equal(entitlement.maxUsers, 15);
    assert.equal(entitlement.maxEmployees, 250);
  });

  it('5. RBAC Protection: EMPLOYEE role is blocked from billing management (403)', async () => {
    const res = await request(app)
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${employeeTokenA}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('6. Cross-Tenant Isolation: Org B cannot access Org A billing data', async () => {
    const subA = await Subscription.findOne({ organizationId: orgA._id });
    assert.ok(subA);

    // Org B requesting subscription retrieves Org B's own subscription (lazy provisioned)
    const resB = await request(app)
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${adminTokenB}`);

    assert.equal(resB.status, 200);
    assert.equal(resB.body.data.subscription.organizationId, String(orgB._id));
    assert.notEqual(resB.body.data.subscription.organizationId, String(orgA._id));
  });

  it('7. Cancel subscription transitions state to CANCELLED', async () => {
    const res = await request(app)
      .post('/api/v1/billing/subscription/cancel')
      .set('Authorization', `Bearer ${adminTokenA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.subscription.status, 'CANCELLED');
    assert.ok(res.body.data.subscription.cancelledAt);
  });

  it('8. Reactivate subscription transitions state to ACTIVE', async () => {
    const res = await request(app)
      .post('/api/v1/billing/subscription/reactivate')
      .set('Authorization', `Bearer ${adminTokenA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.subscription.status, 'ACTIVE');
  });

  it('9. Webhook signature verification and payment failure dispatching', async () => {
    const eventId = `evt_test_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'invoice.payment_failed',
      organizationId: String(orgA._id),
      data: { status: 'failed' },
    });

    const secret = 'mock_secret';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const res = await request(app)
      .post('/api/v1/billing/webhooks/MOCK?secret=mock_secret')
      .set('x-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'PROCESSED');

    // Verify subscription transitioned to PAST_DUE
    const sub = await Subscription.findOne({ organizationId: orgA._id });
    assert.equal(sub.status, 'PAST_DUE');
  });

  it('10. Webhook replay protection blocks duplicate event delivery', async () => {
    const eventId = `evt_dup_${Date.now()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: 'customer.subscription.updated',
      organizationId: String(orgA._id),
      data: { status: 'active' },
    });

    const secret = 'mock_secret';
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // First delivery
    const res1 = await request(app)
      .post('/api/v1/billing/webhooks/MOCK?secret=mock_secret')
      .set('x-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);
    assert.equal(res1.status, 200);

    // Duplicate delivery
    const res2 = await request(app)
      .post('/api/v1/billing/webhooks/MOCK?secret=mock_secret')
      .set('x-signature', signature)
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.status, 'REPLAY_IGNORED');

    // Verify replay audit event
    const audit = await AuditLog.findOne({
      organizationId: orgA._id,
      action: 'WEBHOOK_REPLAY_BLOCKED',
    });
    assert.ok(audit);
  });

  it('11. Invalid webhook signature is rejected with 400', async () => {
    const payload = JSON.stringify({ id: 'evt_invalid', type: 'test' });
    const res = await request(app)
      .post('/api/v1/billing/webhooks/MOCK?secret=mock_secret')
      .set('x-signature', 'invalid_signature_hash')
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'WEBHOOK_SIGNATURE_INVALID');
  });

  it('12. Read-only billing reconciliation endpoint verifies quota sync', async () => {
    const res = await request(app)
      .post('/api/v1/billing/reconcile')
      .set('Authorization', `Bearer ${adminTokenA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.synchronized, true);
    assert.equal(res.body.data.discrepancies.length, 0);

    // Audit Event
    const audit = await AuditLog.findOne({
      organizationId: orgA._id,
      action: 'BILLING_RECONCILED',
    });
    assert.ok(audit);
  });
});
