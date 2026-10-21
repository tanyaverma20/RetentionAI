import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

describe('Supertest REST API Contracts, Tenant Isolation, Error Handling, and Health Probes', () => {
  let mongod;
  let app;
  let disconnectDatabase;
  let Employee, Department, User, Organization, Role;
  let orgA, deptA, adminUserA, employeeUserA, empRecordA;
  let orgB, deptB, adminUserB, empRecordB;
  let tokenAdminA, tokenEmpA, tokenAdminB;
  let issuedRefreshToken;

  before(async () => {
    let databaseUri;
    try {
      mongod = await MongoMemoryServer.create();
      databaseUri = mongod.getUri();
    } catch (err) {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const envPath = path.resolve(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/MONGODB_URI=(.+)/);
        if (match) {
          databaseUri = match[1].trim();
        }
      }
      if (!databaseUri) throw err;
    }

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = databaseUri;
    process.env.MONGODB_DB_NAME = 'retentionai_supertest';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
    process.env.CORS_ORIGINS = 'http://localhost:5173';

    const dbModule = await import('../src/config/database.js');
    disconnectDatabase = dbModule.disconnectDatabase;
    await dbModule.connectDatabase(databaseUri);

    const roleService = await import('../src/services/roleService.js');
    await roleService.ensureSystemRoles();

    const roleMod = await import('../src/models/Role.js');
    const userMod = await import('../src/models/User.js');
    const orgMod = await import('../src/models/Organization.js');
    const empMod = await import('../src/models/Employee.js');
    const deptMod = await import('../src/models/Department.js');
    const pwdMod = await import('../src/utils/password.js');
    const tokenMod = await import('../src/utils/tokens.js');
    const appMod = await import('../src/app.js');

    Role = roleMod.Role;
    User = userMod.User;
    Organization = orgMod.Organization;
    Employee = empMod.Employee;
    Department = deptMod.Department;
    app = appMod.app;

    const adminRole = await Role.findOne({ name: 'ADMIN' });
    const employeeRole = await Role.findOne({ name: 'EMPLOYEE' });

    // 1. Create Organization A
    orgA = await Organization.create({
      name: 'Acme Corp Org A',
      slug: 'acme-corp-org-a',
      status: 'ACTIVE',
    });

    deptA = await Department.create({
      name: 'Engineering Org A',
      organizationId: orgA._id,
      code: 'ENG-A',
    });

    adminUserA = await User.create({
      name: 'Alice Admin',
      email: 'alice.admin@acme.test',
      passwordHash: await pwdMod.hashPassword('AdminSecure#2026'),
      roleId: adminRole.id,
      organizationId: orgA._id,
      status: 'ACTIVE',
    });

    employeeUserA = await User.create({
      name: 'Bob Employee',
      email: 'bob.emp@acme.test',
      passwordHash: await pwdMod.hashPassword('EmployeeSecure#2026'),
      roleId: employeeRole.id,
      organizationId: orgA._id,
      status: 'ACTIVE',
    });

    empRecordA = await Employee.create({
      employeeCode: 'EMP-A-001',
      firstName: 'Bob',
      lastName: 'Employee',
      email: 'bob.emp@acme.test',
      departmentId: deptA._id,
      designation: 'Software Engineer',
      organizationId: orgA._id,
      userId: employeeUserA._id,
      salary: 95000,
      joiningDate: new Date('2022-01-15'),
      status: 'ACTIVE',
    });

    // 2. Create Organization B (Tenant Isolation Target)
    orgB = await Organization.create({
      name: 'Beta Global Org B',
      slug: 'beta-global-org-b',
      status: 'ACTIVE',
    });

    deptB = await Department.create({
      name: 'Sales Org B',
      organizationId: orgB._id,
      code: 'SALES-B',
    });

    adminUserB = await User.create({
      name: 'Charlie Admin B',
      email: 'charlie.admin@beta.test',
      passwordHash: await pwdMod.hashPassword('AdminBeta#2026'),
      roleId: adminRole.id,
      organizationId: orgB._id,
      status: 'ACTIVE',
    });

    empRecordB = await Employee.create({
      employeeCode: 'EMP-B-001',
      firstName: 'Eve',
      lastName: 'Employee',
      email: 'eve.emp@beta.test',
      departmentId: deptB._id,
      designation: 'Account Executive',
      organizationId: orgB._id,
      salary: 80000,
      joiningDate: new Date('2023-03-01'),
      status: 'ACTIVE',
    });

    // Mint tokens
    tokenAdminA = tokenMod.createAccessToken({
      id: String(adminUserA._id),
      role: { name: 'ADMIN' },
      organizationId: orgA._id,
    });

    tokenEmpA = tokenMod.createAccessToken({
      id: String(employeeUserA._id),
      role: { name: 'EMPLOYEE' },
      organizationId: orgA._id,
    });

    tokenAdminB = tokenMod.createAccessToken({
      id: String(adminUserB._id),
      role: { name: 'ADMIN' },
      organizationId: orgB._id,
    });
  });

  after(async () => {
    try {
      if (Employee) await Employee.deleteMany({});
      if (Department) await Department.deleteMany({});
      if (User) await User.deleteMany({});
      if (Organization) await Organization.deleteMany({});
      if (Role) await Role.deleteMany({});
      if (disconnectDatabase) await disconnectDatabase();
      if (mongod) await mongod.stop();
    } catch (_e) {
      // Ignore cleanup error
    }
  });

  // -------------------------------------------------------------------------
  // 1. Health & Deep Liveness Endpoints
  // -------------------------------------------------------------------------
  it('GET /health returns 200 with service status', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'OK');
    assert.ok(typeof res.body.uptimeSeconds === 'number');
  });

  it('GET /health/deep returns dependency health', async () => {
    const res = await request(app).get('/health/deep');
    assert.ok([200, 503].includes(res.status));
    assert.ok(res.body.dependencies);
    assert.equal(res.body.dependencies.mongo.status, 'UP');
  });

  // -------------------------------------------------------------------------
  // 2. Authentication Contract: Login & Refresh Token Lifecycle
  // -------------------------------------------------------------------------
  it('POST /api/v1/auth/login validates credentials and issues tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice.admin@acme.test', password: 'AdminSecure#2026' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    assert.equal(res.body.data.user.email, 'alice.admin@acme.test');
    assert.equal(res.body.data.user.passwordHash, undefined, 'passwordHash must never be exposed');
    issuedRefreshToken = res.body.data.refreshToken;
  });

  it('POST /api/v1/auth/login rejects invalid password with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice.admin@acme.test', password: 'WrongPassword#999' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/login rejects extra fields due to strict schema', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'alice.admin@acme.test',
        password: 'AdminSecure#2026',
        role: 'SUPER_ADMIN',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/refresh rotates refresh token on valid request', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: issuedRefreshToken });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.ok(res.body.data.refreshToken);
    assert.notEqual(res.body.data.refreshToken, issuedRefreshToken, 'token rotation must produce new token');
  });

  it('POST /api/v1/auth/refresh rejects revoked/reused token with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: issuedRefreshToken });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  // -------------------------------------------------------------------------
  // 3. Employee Management & Pagination Boundaries
  // -------------------------------------------------------------------------
  it('GET /api/v1/employees returns paginated list for authenticated admin', async () => {
    const res = await request(app)
      .get('/api/v1/employees?page=1&limit=10')
      .set('Authorization', `Bearer ${tokenAdminA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items));
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.items[0].employeeCode, 'EMP-A-001');
    assert.equal(res.body.data.page, 1);
  });

  it('GET /api/v1/employees rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/employees');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('GET /api/v1/employees/:id returns single employee within tenant', async () => {
    const res = await request(app)
      .get(`/api/v1/employees/${empRecordA._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.employeeCode, 'EMP-A-001');
  });

  it('GET /api/v1/employees/:id rejects malformed Mongo ObjectId with 400', async () => {
    const res = await request(app)
      .get('/api/v1/employees/not-a-valid-mongo-id')
      .set('Authorization', `Bearer ${tokenAdminA}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('GET /api/v1/employees/:id returns 404 for non-existent employee', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/v1/employees/${nonExistentId}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // 4. Security & Multi-Tenant IDOR Regression Verification
  // -------------------------------------------------------------------------
  it('Tenant Isolation: Org A cannot read Org B employee record (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/v1/employees/${empRecordB._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'EMPLOYEE_NOT_FOUND');
  });

  it('Tenant Isolation: Org B cannot mutate Org A employee record', async () => {
    const res = await request(app)
      .patch(`/api/v1/employees/${empRecordA._id}`)
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ salary: 150000 });

    assert.equal(res.status, 404);
  });

  it('Tenant Isolation: Client cannot override organizationId in query or payload', async () => {
    const res = await request(app)
      .get(`/api/v1/employees?organizationId=${orgB._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    assert.equal(res.status, 200);
    for (const emp of res.body.data.items) {
      assert.equal(String(emp.organizationId), String(orgA._id));
      assert.notEqual(String(emp.organizationId), String(orgB._id));
    }
  });

  it('RBAC: Unauthorized role is rejected with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${tokenEmpA}`)
      .send({ name: 'Hacked Dept', code: 'HACK' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('Token Security: Tampered or invalid JWT is rejected with 401', async () => {
    const tampered = tokenAdminA.slice(0, -6) + 'abcdef';
    const res = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${tampered}`);

    assert.equal(res.status, 401);
    assert.ok(['UNAUTHORIZED', 'INVALID_TOKEN'].includes(res.body.error.code));
  });

  // -------------------------------------------------------------------------
  // 5. Downstream AI & Knowledge Service Fail-Safe Contracts
  // -------------------------------------------------------------------------
  it('Downstream Fail-Closed: AI predict returns 502/503 when AI service offline', async () => {
    const res = await request(app)
      .post(`/api/v1/ai/predict/${empRecordA._id}`)
      .set('Authorization', `Bearer ${tokenAdminA}`);

    assert.ok([502, 503].includes(res.status), `Expected 502/503 but got ${res.status}`);
    assert.equal(res.body.success, false);
    assert.ok(['AI_PREDICT_FAILED', 'AI_SERVICE_UNAVAILABLE'].includes(res.body.error.code));
  });

  it('Downstream Fail-Closed: Decision generation rejects unprivileged role', async () => {
    const res = await request(app)
      .post(`/api/v1/decisions/${empRecordA._id}/generate`)
      .set('Authorization', `Bearer ${tokenEmpA}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });
});
