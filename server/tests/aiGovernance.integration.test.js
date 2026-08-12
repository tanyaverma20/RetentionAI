import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongoServer = await MongoMemoryServer.create();
const mongoUri = mongoServer.getUri();

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongoUri;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const { createAccessToken } = await import('../src/utils/tokens.js');
const { Organization } = await import('../src/models/Organization.js');
const { User } = await import('../src/models/User.js');
const { Role } = await import('../src/models/Role.js');
const { Department } = await import('../src/models/Department.js');
const { Employee } = await import('../src/models/Employee.js');
const { Decision } = await import('../src/models/Decision.js');
const { AiGuardrailLog } = await import('../src/models/AiGuardrailLog.js');
const { AiGovernancePolicy } = await import('../src/models/AiGovernancePolicy.js');
const request = (await import('supertest')).default;
const { app } = await import('../src/app.js');

function createTestToken(user, orgId, roleName) {
  return createAccessToken({
    id: String(user._id),
    role: { name: roleName },
    organizationId: String(orgId),
  });
}

test.describe('Prompt 10 — Enterprise AI Safety, Guardrails, Bias Auditing & Governance Suite', () => {
  let orgAId, orgBId;
  let adminUser, execUser, hrUser, empUser, complianceUser, orgBAdminUser;
  let adminToken, execToken, hrToken, empToken, complianceToken, orgBAdminToken;
  let testEmployee, testDecision;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    const orgA = await Organization.create({
      name: 'Gov Test Org A',
      slug: `gov-a-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      domain: `gov-a-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.com`,
    });
    orgAId = orgA._id;

    const orgB = await Organization.create({
      name: 'Gov Test Org B',
      slug: `gov-b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      domain: `gov-b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.com`,
    });
    orgBId = orgB._id;

    let adminRole = await Role.findOne({ name: 'ADMIN' });
    if (!adminRole) adminRole = await Role.create({ name: 'ADMIN', permissions: ['*'] });

    let execRole = await Role.findOne({ name: 'EXECUTIVE' });
    if (!execRole) execRole = await Role.create({ name: 'EXECUTIVE', permissions: ['READ_ALL'] });

    let hrRole = await Role.findOne({ name: 'HR_MANAGER' });
    if (!hrRole) hrRole = await Role.create({ name: 'HR_MANAGER', permissions: ['HR_READ'] });

    let empRole = await Role.findOne({ name: 'EMPLOYEE' });
    if (!empRole) empRole = await Role.create({ name: 'EMPLOYEE', permissions: ['SELF_READ'] });

    let complianceRole = await Role.findOne({ name: 'COMPLIANCE_OFFICER' });
    if (!complianceRole) complianceRole = await Role.create({ name: 'COMPLIANCE_OFFICER', permissions: ['governance.*'] });

    adminUser = await User.create({
      organizationId: orgAId,
      name: 'Gov Admin',
      email: `gov-admin-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'ADMIN',
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    execUser = await User.create({
      organizationId: orgAId,
      name: 'Gov Exec',
      email: `gov-exec-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'EXECUTIVE',
      roleId: execRole._id,
      status: 'ACTIVE',
    });

    hrUser = await User.create({
      organizationId: orgAId,
      name: 'Gov HR',
      email: `gov-hr-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'HR_MANAGER',
      roleId: hrRole._id,
      status: 'ACTIVE',
    });

    empUser = await User.create({
      organizationId: orgAId,
      name: 'Gov Emp',
      email: `gov-emp-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'EMPLOYEE',
      roleId: empRole._id,
      status: 'ACTIVE',
    });

    complianceUser = await User.create({
      organizationId: orgAId,
      name: 'Gov Compliance Officer',
      email: `gov-compliance-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'COMPLIANCE_OFFICER',
      roleId: complianceRole._id,
      status: 'ACTIVE',
    });

    orgBAdminUser = await User.create({
      organizationId: orgBId,
      name: 'Org B Admin',
      email: `orgb-gov-admin-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'ADMIN',
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    adminToken = createTestToken(adminUser, orgAId, 'ADMIN');
    execToken = createTestToken(execUser, orgAId, 'EXECUTIVE');
    hrToken = createTestToken(hrUser, orgAId, 'HR_MANAGER');
    empToken = createTestToken(empUser, orgAId, 'EMPLOYEE');
    complianceToken = createTestToken(complianceUser, orgAId, 'COMPLIANCE_OFFICER');
    orgBAdminToken = createTestToken(orgBAdminUser, orgBId, 'ADMIN');

    const dept = await Department.create({
      organizationId: orgAId,
      name: 'Governance AI Research',
      code: `GOV-${Date.now()}`,
    });

    testEmployee = await Employee.create({
      organizationId: orgAId,
      departmentId: dept._id,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: `ada.${Date.now()}@test.com`,
      employeeCode: `EMP-GOV-${Date.now()}`,
      designation: 'Principal AI Safety Engineer',
      joiningDate: new Date('2021-06-01'),
      salary: 150000,
      status: 'ACTIVE',
    });

    testDecision = await Decision.create({
      organizationId: orgAId,
      employeeId: testEmployee._id,
      riskScore: 0.82,
      priority: 'HIGH',
      recommendationType: 'RETENTION_PLAN',
      recommendedIntervention: 'Executive Mentorship & Stock Grant',
      status: 'PENDING',
    });

    await AiGuardrailLog.create({
      organizationId: orgAId,
      requestId: `req_gov_${Date.now()}`,
      serviceType: 'RAG',
      eventCategory: 'PROMPT_INJECTION',
      actionTaken: 'BLOCKED',
      severity: 'HIGH',
      sanitizedMetadata: { reason: 'System prompt override pattern detected' },
    });
  });

  test.after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  });

  test('1. RBAC Enforcement: HR_MANAGER & EMPLOYEE cannot access AI Governance endpoints (403 Forbidden)', async () => {
    const hrRes = await request(app)
      .get('/api/v1/governance/summary')
      .set('Authorization', `Bearer ${hrToken}`);
    assert.equal(hrRes.status, 403);

    const empRes = await request(app)
      .get('/api/v1/governance/summary')
      .set('Authorization', `Bearer ${empToken}`);
    assert.equal(empRes.status, 403);

    const adminRes = await request(app)
      .get('/api/v1/governance/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.status, 'success');

    const compRes = await request(app)
      .get('/api/v1/governance/summary')
      .set('Authorization', `Bearer ${complianceToken}`);
    assert.equal(compRes.status, 200);
  });

  test('2. Governance Summary & Safety Shield Status', async () => {
    const res = await request(app)
      .get('/api/v1/governance/summary')
      .set('Authorization', `Bearer ${execToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.safetyShield);
    assert.equal(res.body.data.safetyShield.status, 'ACTIVE');
    assert.ok(res.body.data.safetyShield.blockedViolations >= 1);
  });

  test('3. Demographic Bias Audit Calculation & Idempotency', async () => {
    const firstRes = await request(app)
      .post('/api/v1/governance/bias-audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ demographicCategory: 'DEPARTMENT', modelVersion: '1.0.0' });

    assert.equal(firstRes.status, 200);
    assert.ok(firstRes.body.data.disparateImpactRatio != null);
    assert.ok(firstRes.body.data.status);

    const secondRes = await request(app)
      .post('/api/v1/governance/bias-audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ demographicCategory: 'DEPARTMENT', modelVersion: '1.0.0' });

    assert.equal(secondRes.status, 200);
    assert.equal(secondRes.body.data._id, firstRes.body.data._id);
  });

  test('4. HITL Review Queue & Decision Action Workflow', async () => {
    const queueRes = await request(app)
      .get('/api/v1/governance/hitl-queue')
      .set('Authorization', `Bearer ${complianceToken}`);

    assert.equal(queueRes.status, 200);
    assert.ok(Array.isArray(queueRes.body.data));
    assert.ok(queueRes.body.data.length >= 1);

    const reviewRes = await request(app)
      .post(`/api/v1/governance/hitl-review/${testDecision._id}`)
      .set('Authorization', `Bearer ${complianceToken}`)
      .send({ action: 'APPROVE', reviewNote: 'Approved by Compliance Officer' });

    assert.equal(reviewRes.status, 200);
    assert.equal(reviewRes.body.data.status, 'ACCEPTED');
  });

  test('5. Synthetic Red-Team Evaluation Harness Run', async () => {
    const res = await request(app)
      .post('/api/v1/governance/redteam/run')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.defenseScorePercent, 100.0);
    assert.equal(res.body.data.status, 'PASS');
  });

  test('6. Multi-Tenant AI Governance Evidence Report Export Isolation', async () => {
    const resOrgA = await request(app)
      .get('/api/v1/governance/export/evidence?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resOrgA.status, 200);
    assert.equal(resOrgA.headers['content-type'], 'text/csv; charset=utf-8');

    const resOrgB = await request(app)
      .get('/api/v1/governance/export/evidence?format=json')
      .set('Authorization', `Bearer ${orgBAdminToken}`);

    assert.equal(resOrgB.status, 200);
    assert.equal(resOrgB.body.data.organizationId, String(orgBId));
    assert.equal(resOrgB.body.data.organizationId === String(orgAId), false);
  });
});
