import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Integration test suite for SHAP Explainability & Tenant Isolation.
 * Verifies horizontal privilege escalation prevention (IDOR) across
 * explanation endpoints: explainSingle, getExplanation, explainBatch,
 * and getDepartmentRiskDrivers.
 */
test('SHAP explainability tenant isolation and IDOR protection', async () => {
  let mongod;
  let databaseUri = process.env.AUTH_TEST_MONGODB_URI || process.env.MONGODB_URI;

  if (!process.env.AUTH_TEST_MONGODB_URI && !process.env.MONGODB_URI) {
    const tmpDir = path.join(os.tmpdir(), `mongo-mem-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create({
      instance: { dbPath: tmpDir },
    });
    databaseUri = mongod.getUri();
  }

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = databaseUri;
  process.env.MONGODB_DB_NAME = 'retentionai_shap_test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
  process.env.CORS_ORIGINS = 'http://localhost:5173';

  const [
    { connectDatabase, disconnectDatabase },
    { ensureSystemRoles },
    { Role },
    { User },
    { Organization },
    { Employee },
    { Department },
    ExplanationModule,
    PredictionModule,
    { app },
  ] = await Promise.all([
    import('../src/config/database.js'),
    import('../src/services/roleService.js'),
    import('../src/models/Role.js'),
    import('../src/models/User.js'),
    import('../src/models/Organization.js'),
    import('../src/models/Employee.js'),
    import('../src/models/Department.js'),
    import('../src/models/Explanation.js'),
    import('../src/models/Prediction.js'),
    import('../src/app.js'),
  ]);

  const Explanation = ExplanationModule.default || ExplanationModule;
  const Prediction = PredictionModule.Prediction;

  await connectDatabase();
  for (const Model of [User, Role, Organization, Employee, Department, Explanation, Prediction]) {
    await Model.deleteMany({});
  }
  await ensureSystemRoles();

  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

  const signup = async (organizationName, adminEmail) => {
    const res = await fetch(`${baseUrl}/organizations/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationName, adminName: 'Admin', adminEmail, adminPassword: 'Admin#12345' }),
    });
    const body = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    return { token: body.data.accessToken, orgId: body.data.organization.id, userId: body.data.user.id };
  };

  try {
    const orgA = await signup('Tenant Alpha SHAP', 'admin@alpha-shap.test');
    const orgB = await signup('Tenant Beta SHAP', 'admin@beta-shap.test');

    const authed = (token, extra = {}) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...extra,
    });

    // Create Department and Employee for Org A
    const deptA = await Department.create({ name: 'Engineering', code: 'ENG', organizationId: orgA.orgId });
    const empA = await Employee.create({
      organizationId: orgA.orgId,
      employeeCode: 'EMP-A1',
      firstName: 'Alice',
      lastName: 'Alpha',
      email: 'alice@alpha-shap.test',
      departmentId: deptA._id,
      designation: 'Senior Developer',
      joiningDate: new Date('2022-01-01'),
      salary: 120000,
    });

    // Create Department and Employee for Org B
    const deptB = await Department.create({ name: 'Sales', code: 'SALES', organizationId: orgB.orgId });
    const empB = await Employee.create({
      organizationId: orgB.orgId,
      employeeCode: 'EMP-B1',
      firstName: 'Bob',
      lastName: 'Beta',
      email: 'bob@beta-shap.test',
      departmentId: deptB._id,
      designation: 'Sales Exec',
      joiningDate: new Date('2023-01-01'),
      salary: 80000,
    });

    // Seed Explanation snapshot for Org A
    const explanationA = await Explanation.create({
      employeeId: empA._id,
      organizationId: orgA.orgId,
      riskScore: 0.85,
      riskLevel: 'HIGH',
      summary: 'High attrition risk driven by OverTime.',
      topPositiveFactors: [{ feature: 'OverTime', displayName: 'Overtime Hours', value: 'Yes', formattedValue: 'Yes', shapValue: 0.25 }],
      topNegativeFactors: [{ feature: 'MonthlyIncome', displayName: 'Monthly Income', value: '10000', formattedValue: '$10,000', shapValue: -0.10 }],
      shapValues: { OverTime: 0.25, MonthlyIncome: -0.10 },
      baseValue: 0.15,
      generatedAt: new Date(),
    });

    // 1. GET /api/v1/explain/:id (getExplanation)
    // Org A reading its own employee explanation -> 200
    const resGetA = await fetch(`${baseUrl}/explain/${empA._id}`, { headers: authed(orgA.token) });
    assert.equal(resGetA.status, 200, 'Org A must be able to read its own employee explanation');
    const bodyGetA = await resGetA.json();
    assert.equal(bodyGetA.data.summary, 'High attrition risk driven by OverTime.');

    // Org B reading Org A's employee explanation -> 404
    const resGetB = await fetch(`${baseUrl}/explain/${empA._id}`, { headers: authed(orgB.token) });
    assert.equal(resGetB.status, 404, 'Org B must receive 404 when reading Org A employee explanation');

    // 2. POST /api/v1/explain/:id (explainSingle)
    // Org B attempting to trigger single SHAP explanation for Org A's employee -> 404
    const resPostB = await fetch(`${baseUrl}/explain/${empA._id}`, {
      method: 'POST',
      headers: authed(orgB.token),
    });
    assert.equal(resPostB.status, 404, 'Org B must receive 404 when triggering explanation for Org A employee');

    // 3. POST /api/v1/explain/batch (explainBatch with cross-tenant employeeIds)
    const resBatchCross = await fetch(`${baseUrl}/explain/batch`, {
      method: 'POST',
      headers: authed(orgB.token),
      body: JSON.stringify({ employeeIds: [empA._id] }),
    });
    const bodyBatchCross = await resBatchCross.json();
    assert.equal(resBatchCross.status, 200);
    assert.equal(bodyBatchCross.data.processed, 0, 'Batch explain for Org B must skip Org A employees');
    assert.equal(bodyBatchCross.data.skipped, 1);

    // 4. GET /api/v1/explain/global/department-drivers
    const resDriversA = await fetch(`${baseUrl}/explain/global/department-drivers`, { headers: authed(orgA.token) });
    const bodyDriversA = await resDriversA.json();
    assert.equal(resDriversA.status, 200);
    assert.equal(bodyDriversA.data.length, 1);
    assert.equal(bodyDriversA.data[0].departmentName, 'Engineering');

    const resDriversB = await fetch(`${baseUrl}/explain/global/department-drivers`, { headers: authed(orgB.token) });
    const bodyDriversB = await resDriversB.json();
    assert.equal(resDriversB.status, 200);
    assert.equal(bodyDriversB.data.length, 0, 'Org B department drivers must not include Org A data');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const Model of [User, Role, Organization, Employee, Department, Explanation, Prediction]) {
      await Model.deleteMany({});
    }
    await disconnectDatabase();
    if (mongod) await mongod.stop();
  }
});
