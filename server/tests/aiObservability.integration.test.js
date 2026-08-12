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
const { Prediction } = await import('../src/models/Prediction.js');
const { PredictionHistory } = await import('../src/models/PredictionHistory.js');
const { Decision } = await import('../src/models/Decision.js');
const { AiTelemetry } = await import('../src/models/AiTelemetry.js');
const { ModelDriftLog } = await import('../src/models/ModelDriftLog.js');
const { AgentTraceLog } = await import('../src/models/AgentTraceLog.js');
const request = (await import('supertest')).default;
const { app } = await import('../src/app.js');

function createTestToken(user, orgId, roleName) {
  return createAccessToken({
    id: String(user._id),
    role: { name: roleName },
    organizationId: String(orgId),
  });
}

test.describe('Prompt 9 — AI Observability, Continuous Evaluation & Model Drift Hardening', () => {
  let orgAId, orgBId;
  let adminUser, execUser, hrUser, empUser, orgBAdminUser;
  let adminToken, execToken, hrToken, empToken, orgBAdminToken;
  let testEmployee, testDecision;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    const orgA = await Organization.create({
      name: 'Obs Test Org A',
      slug: `obs-a-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      domain: `obs-a-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.com`,
    });
    orgAId = orgA._id;

    const orgB = await Organization.create({
      name: 'Obs Test Org B',
      slug: `obs-b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      domain: `obs-b-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.com`,
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

    adminUser = await User.create({
      organizationId: orgAId,
      name: 'Obs Admin',
      email: `obs-admin-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'ADMIN',
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    execUser = await User.create({
      organizationId: orgAId,
      name: 'Obs Exec',
      email: `obs-exec-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'EXECUTIVE',
      roleId: execRole._id,
      status: 'ACTIVE',
    });

    hrUser = await User.create({
      organizationId: orgAId,
      name: 'Obs HR',
      email: `obs-hr-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'HR_MANAGER',
      roleId: hrRole._id,
      status: 'ACTIVE',
    });

    empUser = await User.create({
      organizationId: orgAId,
      name: 'Obs Emp',
      email: `obs-emp-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'EMPLOYEE',
      roleId: empRole._id,
      status: 'ACTIVE',
    });

    orgBAdminUser = await User.create({
      organizationId: orgBId,
      name: 'Org B Admin',
      email: `orgb-admin-${Date.now()}@test.com`,
      passwordHash: 'hashed123',
      role: 'ADMIN',
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    adminToken = createTestToken(adminUser, orgAId, 'ADMIN');
    execToken = createTestToken(execUser, orgAId, 'EXECUTIVE');
    hrToken = createTestToken(hrUser, orgAId, 'HR_MANAGER');
    empToken = createTestToken(empUser, orgAId, 'EMPLOYEE');
    orgBAdminToken = createTestToken(orgBAdminUser, orgBId, 'ADMIN');

    const dept = await Department.create({
      organizationId: orgAId,
      name: 'AI Engineering',
      code: `AIE-${Date.now()}`,
    });

    testEmployee = await Employee.create({
      organizationId: orgAId,
      departmentId: dept._id,
      firstName: 'Alan',
      lastName: 'Turing',
      email: `alan.${Date.now()}@test.com`,
      employeeCode: `EMP-${Date.now()}`,
      designation: 'Senior AI Research Scientist',
      joiningDate: new Date('2022-01-15'),
      salary: 120000,
      status: 'ACTIVE',
    });

    const scores = [0.15, 0.22, 0.45, 0.68, 0.78, 0.85];
    for (const score of scores) {
      await PredictionHistory.create({
        organizationId: orgAId,
        employeeId: testEmployee._id,
        modelId: 'catboost-v1.0.0',
        riskScore: score,
        riskLevel: score >= 0.7 ? 'HIGH' : (score >= 0.4 ? 'MEDIUM' : 'LOW'),
        runId: `run_${Date.now()}`,
      });
    }
    await Prediction.create({
      organizationId: orgAId,
      employeeId: testEmployee._id,
      modelId: 'catboost-v1.0.0',
      riskScore: 0.85,
      riskLevel: 'HIGH',
    });

    testDecision = await Decision.create({
      organizationId: orgAId,
      employeeId: testEmployee._id,
      riskScore: 0.78,
      priority: 'HIGH',
      recommendationType: 'RETENTION_PLAN',
      recommendedIntervention: 'Leadership Coaching',
      status: 'PENDING',
    });

    await AiTelemetry.create({
      organizationId: orgAId,
      requestId: `req_${Date.now()}_1`,
      serviceType: 'RAG',
      latencyMs: 320,
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700,
      estimatedCostUsd: 0.00042,
      groundednessScore: 0.92,
      citationCount: 3,
      status: 'SUCCESS',
    });
  });

  test.after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoServer.stop();
  });

  test('1. RBAC Enforcement: HR_MANAGER & EMPLOYEE cannot access AI Observability metrics (403 Forbidden)', async () => {
    const hrRes = await request(app)
      .get('/api/v1/observability/telemetry')
      .set('Authorization', `Bearer ${hrToken}`);
    assert.equal(hrRes.status, 403);

    const empRes = await request(app)
      .get('/api/v1/observability/telemetry')
      .set('Authorization', `Bearer ${empToken}`);
    assert.equal(empRes.status, 403);

    const adminRes = await request(app)
      .get('/api/v1/observability/telemetry')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.status, 'success');
  });

  test('2. Telemetry Aggregations & Tenant Scoping', async () => {
    const res = await request(app)
      .get('/api/v1/observability/telemetry')
      .set('Authorization', `Bearer ${execToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.data.summary);
    assert.ok(res.body.data.summary.totalRequests >= 1);
    assert.equal(res.body.data.summary.totalTokens, 700);
  });

  test('3. Model Drift Calculation (PSI) & Idempotency', async () => {
    const firstRes = await request(app)
      .post('/api/v1/observability/drift/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ modelVersion: '1.0.0' });

    assert.equal(firstRes.status, 200);
    assert.ok(firstRes.body.data.psiScore != null);
    assert.ok(firstRes.body.data.driftStatus);

    const secondRes = await request(app)
      .post('/api/v1/observability/drift/calculate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ modelVersion: '1.0.0' });

    assert.equal(secondRes.status, 200);
    assert.equal(secondRes.body.data._id, firstRes.body.data._id);
  });

  test('4. LangGraph Agent Trace Retrieval', async () => {
    const res = await request(app)
      .get(`/api/v1/observability/agent-traces/${testDecision._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.ok(Array.isArray(res.body.data.nodeTraces));
    assert.ok(res.body.data.nodeTraces.length >= 5);
  });

  test('5. Continuous RAG Evaluation Bench Run', async () => {
    const res = await request(app)
      .post('/api/v1/observability/eval/run')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.ok(res.body.data.groundednessScore >= 0);
    assert.ok(res.body.data.citationPrecision >= 0);
  });

  test('6. Multi-Tenant Telemetry Report CSV Export Isolation', async () => {
    const resOrgA = await request(app)
      .get('/api/v1/observability/export/csv')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resOrgA.status, 200);
    assert.equal(resOrgA.headers['content-type'], 'text/csv; charset=utf-8');

    const resOrgB = await request(app)
      .get('/api/v1/observability/export/csv')
      .set('Authorization', `Bearer ${orgBAdminToken}`);

    assert.equal(resOrgB.status, 200);
    assert.equal(resOrgB.text.includes(testEmployee._id.toString()), false);
  });
});
