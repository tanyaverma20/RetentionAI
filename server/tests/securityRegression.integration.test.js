import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;
let mongoUri;

try {
  mongoServer = await MongoMemoryServer.create();
  mongoUri = mongoServer.getUri();
} catch (e) {
  console.warn('MongoMemoryServer initialization fallback:', e.message);
  mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/retentionai_test';
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongoUri;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const { createAccessToken } = await import('../src/utils/tokens.js');
const { Organization } = await import('../src/models/Organization.js');
const { Department } = await import('../src/models/Department.js');
const { Role } = await import('../src/models/Role.js');
const { User } = await import('../src/models/User.js');
const { Employee } = await import('../src/models/Employee.js');
const request = (await import('supertest')).default;
const { app } = await import('../src/app.js');

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test.describe('Prompt 11 — Production Security Regression Suite', () => {
  let orgAId, orgBId, deptBId;
  let adminRole, empRole;
  let adminUser, empUser, orgBAdminUser;
  let adminToken, empToken;
  let testEmployeeOrgB;

  test.beforeEach(async () => {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(mongoUri);
    }
    await Organization.deleteMany({});
    await Department.deleteMany({});
    await Role.deleteMany({});
    await User.deleteMany({});
    await Employee.deleteMany({});

    // Create Org A & Org B
    const orgA = await Organization.create({ name: 'Security Org A', code: 'ORGA', slug: 'orga', subscriptionTier: 'ENTERPRISE' });
    const orgB = await Organization.create({ name: 'Security Org B', code: 'ORGB', slug: 'orgb', subscriptionTier: 'ENTERPRISE' });
    orgAId = orgA._id;
    orgBId = orgB._id;

    // Dept for Org B
    const deptB = await Department.create({ name: 'Engineering', code: 'ENG', organizationId: orgBId });
    deptBId = deptB._id;

    // Roles
    adminRole = await Role.create({ name: 'ADMIN', permissions: ['*'] });
    empRole = await Role.create({ name: 'EMPLOYEE', permissions: ['SELF_READ'] });

    // Users
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@orga.com',
      passwordHash: 'hash',
      roleId: adminRole._id,
      organizationId: orgAId,
    });

    empUser = await User.create({
      name: 'Emp User',
      email: 'emp@orga.com',
      passwordHash: 'hash',
      roleId: empRole._id,
      organizationId: orgAId,
    });

    orgBAdminUser = await User.create({
      name: 'OrgB Admin',
      email: 'admin@orgb.com',
      passwordHash: 'hash',
      roleId: adminRole._id,
      organizationId: orgBId,
    });

    adminToken = createAccessToken({ id: String(adminUser._id), role: { name: 'ADMIN' }, organizationId: String(orgAId) });
    empToken = createAccessToken({ id: String(empUser._id), role: { name: 'EMPLOYEE' }, organizationId: String(orgAId) });

    // Create Employee for Org B
    testEmployeeOrgB = await Employee.create({
      organizationId: orgBId,
      departmentId: deptBId,
      employeeCode: 'EMP-B1',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob@orgb.com',
      designation: 'Engineer',
      joiningDate: new Date('2023-01-01'),
      status: 'ACTIVE',
    });
  });

  test('1. IDOR & Cross-Tenant Access Protection (returns 404/403 to prevent resource existence leak)', async () => {
    const res = await request(app)
      .get(`/api/v1/employees/${testEmployeeOrgB._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status === 404 || res.status === 403, true);
    assert.notStrictEqual(res.body?.data?._id, String(testEmployeeOrgB._id));
  });

  test('2. Malformed Mongo ObjectId Validation (returns 400 Bad Request)', async () => {
    const res = await request(app)
      .get('/api/v1/employees/invalid-mongo-id-12345')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error.code, 'VALIDATION_ERROR');
  });

  test('3. RBAC Privilege Escalation Defense (EMPLOYEE blocked from admin endpoints)', async () => {
    const res = await request(app)
      .get('/api/v1/governance/summary')
      .set('Authorization', `Bearer ${empToken}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('4. JWT Misuse & Invalid Token Handling (returns 401 Unauthorized)', async () => {
    const res = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', 'Bearer invalid-token-sig');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  test('5. System Health & Readiness Endpoint Security', async () => {
    const resHealth = await request(app).get('/health');
    assert.strictEqual(resHealth.status, 200);
    assert.strictEqual(resHealth.body.status, 'OK');

    const resReady = await request(app).get('/ready');
    assert.strictEqual(resReady.status === 200 || resReady.status === 503, true);
    assert.ok(resReady.body.status);
    assert.ok(resReady.body.checks);
  });

  test('6. Correlation ID Propagation in HTTP Headers', async () => {
    const testCorrelationId = 'test-corr-id-999999999999';

    const res = await request(app)
      .get('/health')
      .set('X-Correlation-ID', testCorrelationId);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['x-correlation-id'], testCorrelationId);
  });
});
