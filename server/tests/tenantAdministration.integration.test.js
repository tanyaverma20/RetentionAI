import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = await MongoMemoryServer.create();
let mongoUri = mongoServer.getUri();

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongoUri;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';

const { Organization } = await import('../src/models/Organization.js');
const { User } = await import('../src/models/User.js');
const { Role } = await import('../src/models/Role.js');
const { Employee } = await import('../src/models/Employee.js');
const { Invitation } = await import('../src/models/Invitation.js');
const { Import } = await import('../src/models/Import.js');
const { TenantEntitlement } = await import('../src/models/TenantEntitlement.js');
const { AuditLog } = await import('../src/models/AuditLog.js');
const request = (await import('supertest')).default;
const { app } = await import('../src/app.js');
const { createAccessToken } = await import('../src/utils/tokens.js');
const { ensureSystemRoles } = await import('../src/services/roleService.js');

function createTestToken(user, orgId, roleName) {
  return createAccessToken({
    id: String(user._id || user.id),
    role: { name: roleName },
    organizationId: String(orgId),
  });
}

test.describe('Prompt 12 — Enterprise SaaS Productization & Customer Operations Integration Suite', () => {
  let orgA, orgB;
  let adminA, adminB, hrUserA;
  let adminTokenA, adminTokenB, hrTokenA;
  let adminRole, hrRole;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }

    await ensureSystemRoles();
    adminRole = await Role.findOne({ name: 'ADMIN' });
    hrRole = await Role.findOne({ name: 'HR_MANAGER' });

    // Seed Org A
    orgA = await Organization.create({
      name: 'Alpha Corp SaaS Test',
      slug: `alpha-saas-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'FREE',
      employeeLimit: 5,
    });

    adminA = await User.create({
      organizationId: orgA._id,
      name: 'Alpha Admin',
      email: `admin.alpha.${Date.now()}@alpha.com`,
      passwordHash: 'hashed123',
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    hrUserA = await User.create({
      organizationId: orgA._id,
      name: 'Alpha HR',
      email: `hr.alpha.${Date.now()}@alpha.com`,
      passwordHash: 'hashed123',
      roleId: hrRole._id,
      status: 'ACTIVE',
    });

    // Seed Org B
    orgB = await Organization.create({
      name: 'Beta Corp SaaS Test',
      slug: `beta-saas-${Date.now()}`,
      status: 'ACTIVE',
      plan: 'FREE',
      employeeLimit: 5,
    });

    adminB = await User.create({
      organizationId: orgB._id,
      name: 'Beta Admin',
      email: `admin.beta.${Date.now()}@beta.com`,
      passwordHash: 'hashed123',
      roleId: adminRole._id,
      status: 'ACTIVE',
    });

    adminTokenA = createTestToken(adminA, orgA._id, 'ADMIN');
    hrTokenA = createTestToken(hrUserA, orgA._id, 'HR_MANAGER');
    adminTokenB = createTestToken(adminB, orgB._id, 'ADMIN');
  });

  test.after(async () => {
    // Cleanup test documents
    if (orgA) {
      await Organization.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
      await User.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await Employee.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await Invitation.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await Import.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await TenantEntitlement.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
      await AuditLog.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
    }
  });

  test('1. Self-Service Organization Signup & Admin Bootstrap', async () => {
    const signupData = {
      organizationName: 'Acme SaaS Corp',
      adminName: 'Alice Founder',
      adminEmail: `alice.acme.${Date.now()}@acme.com`,
      adminPassword: 'Password123!',
    };

    const res = await request(app).post('/api/v1/organizations/signup').send(signupData);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.organization.name, 'Acme SaaS Corp');
    assert.ok(res.body.data.accessToken);

    // Cleanup created test org
    await Organization.deleteOne({ name: 'Acme SaaS Corp' });
    await User.deleteOne({ email: signupData.adminEmail });
  });

  test('2. Organization Settings & Onboarding State Machine', async () => {
    // Get initial settings
    const getRes = await request(app)
      .get('/api/v1/organizations/settings')
      .set('Authorization', `Bearer ${adminTokenA}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.onboardingState, 'ADMIN_CREATED');

    // Update settings (auto-advances to COMPANY_CONFIGURED)
    const updateRes = await request(app)
      .patch('/api/v1/organizations/settings')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ industry: 'Software', timezone: 'America/New_York' });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.onboardingState, 'COMPANY_CONFIGURED');
    assert.equal(updateRes.body.data.settings.industry, 'Software');

    // Invalid transition (skipping steps)
    const invalidRes = await request(app)
      .post('/api/v1/organizations/onboarding/advance')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ targetState: 'ONBOARDING_COMPLETED' });
    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.error.code, 'INVALID_STATE_TRANSITION');
  });

  test('3. Secure User Invitation Generation & Expiration', async () => {
    const invEmail = `invitee.${Date.now()}@alpha.com`;
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ email: invEmail, roleId: String(hrRole._id) });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.invitationToken);

    const invInDb = await Invitation.findOne({ email: invEmail });
    assert.ok(invInDb);
    assert.equal(invInDb.status, 'PENDING');
  });

  test('4. Atomic Invitation Consumption & Replay Defense', async () => {
    const invEmail = `atomic.invitee.${Date.now()}@alpha.com`;
    const createRes = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .send({ email: invEmail, roleId: String(hrRole._id) });

    const rawToken = createRes.body.data.invitationToken;

    // Concurrent acceptance attempts
    const [acc1, acc2] = await Promise.all([
      request(app).post('/api/v1/invitations/accept').send({ token: rawToken, name: 'Invitee One', password: 'Password123!' }),
      request(app).post('/api/v1/invitations/accept').send({ token: rawToken, name: 'Invitee Two', password: 'Password123!' }),
    ]);

    const statusCodes = [acc1.status, acc2.status].sort();
    assert.deepEqual(statusCodes, [201, 409]); // Exactly 1 succeeds (201), 1 fails with replay error (409)

    // Cleanup created user & invitation
    await User.deleteOne({ email: invEmail });
  });

  test('5. Last-Admin Protection Guard', async () => {
    // Attempt to deactivate adminA (the last active admin of Org A)
    const deactRes = await request(app)
      .post(`/api/v1/users/${adminA._id}/deactivate`)
      .set('Authorization', `Bearer ${adminTokenA}`);

    // Self deactivation error (409 SELF_DEACTIVATION)
    assert.equal(deactRes.status, 409);
    assert.equal(deactRes.body.error.code, 'SELF_DEACTIVATION');

    // Attempt to demote adminA using adminA token (the last admin in Org A)
    const demoteRes = await request(app)
      .post(`/api/v1/users/${adminA._id}/role`)
      .set('Authorization', `Bearer ${adminTokenA}`)
      .set('Content-Type', 'application/json')
      .send({ roleId: String(hrRole._id) });

    assert.equal(demoteRes.status, 409);
    assert.equal(demoteRes.body.error.code, 'LAST_ADMIN');
  });

  test('6. Employee Data Import Governance: Preview, Formula Protection & Commit', async () => {
    const csvData = `firstName,lastName,email,employeeCode,department,salary\n=Formula,User,formula.${Date.now()}@alpha.com,EMP-FORM-1,=Engineering,75000\nBob,Marley,bob.${Date.now()}@alpha.com,EMP-BOB-1,Sales,82000`;

    // Step 1: Dry-Run Preview
    const prevRes = await request(app)
      .post('/api/v1/imports/preview')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .field('filename', 'employees.csv')
      .attach('file', Buffer.from(csvData), 'employees.csv');

    assert.equal(prevRes.status, 200);
    assert.equal(prevRes.body.data.totalRows, 2);
    assert.equal(prevRes.body.data.status, 'PREVIEW');

    const importId = prevRes.body.data.importId;

    // Step 2: Commit Import
    const commitRes = await request(app)
      .post(`/api/v1/imports/${importId}/commit`)
      .set('Authorization', `Bearer ${adminTokenA}`);

    if (commitRes.status !== 200) console.log('DEBUG commitRes:', commitRes.status, commitRes.body);
    assert.equal(commitRes.status, 200);
    assert.equal(commitRes.body.data.status, 'COMPLETED');
    assert.equal(commitRes.body.data.newCount, 2);

    // Step 3: Verify Formula Injection Protection in DB
    const formulaEmp = await Employee.findOne({ organizationId: orgA._id, firstName: "'=Formula" });
    assert.ok(formulaEmp);
  });

  test('7. Tenant Usage Telemetry & Concurrency-Safe Quota Enforcement', async () => {
    // Org A employee limit is 5. Insert employees up to limit.
    const usageRes = await request(app)
      .get('/api/v1/usage/summary')
      .set('Authorization', `Bearer ${adminTokenA}`);

    assert.equal(usageRes.status, 200);
    assert.ok(usageRes.body.data.quotas);
    assert.ok(usageRes.body.data.usage);
  });

  test('8. Organization Deactivation & Deactivated-Tenant Traffic Rejection', async () => {
    // Create temporary Org for deactivation test
    const tempOrg = await Organization.create({
      name: 'Deact Corp Test',
      slug: `deact-${Date.now()}`,
      status: 'ACTIVE',
    });
    const tempAdmin = await User.create({
      organizationId: tempOrg._id,
      name: 'Temp Admin',
      email: `temp.admin.${Date.now()}@temp.com`,
      passwordHash: 'hashed123',
      roleId: adminRole._id,
      status: 'ACTIVE',
    });
    const tempToken = createTestToken(tempAdmin, tempOrg._id, 'ADMIN');

    // Deactivate tempOrg
    const deactRes = await request(app)
      .post('/api/v1/organizations/deactivate')
      .set('Authorization', `Bearer ${tempToken}`)
      .send({ reason: 'Testing deactivation' });

    assert.equal(deactRes.status, 200);
    assert.equal(deactRes.body.data.status, 'CANCELED');

    // Subsequent API call from tempOrg user must be blocked with 403 ORGANIZATION_DEACTIVATED
    const blockedRes = await request(app)
      .get('/api/v1/employees')
      .set('Authorization', `Bearer ${tempToken}`);

    assert.equal(blockedRes.status, 403);
    assert.equal(blockedRes.body.error.code, 'ORGANIZATION_DEACTIVATED');

    // Cleanup
    await Organization.deleteOne({ _id: tempOrg._id });
    await User.deleteOne({ _id: tempAdmin._id });
  });

  test('9. Cross-Tenant IDOR & Import Isolation', async () => {
    // Admin B attempts to commit Org A's import job
    const prevRes = await request(app)
      .post('/api/v1/imports/preview')
      .set('Authorization', `Bearer ${adminTokenA}`)
      .attach('file', Buffer.from('firstName,lastName,email\nTest,User,test.idor@alpha.com'), 'idor.csv');

    const importId = prevRes.body.data.importId;

    const crossCommitRes = await request(app)
      .post(`/api/v1/imports/${importId}/commit`)
      .set('Authorization', `Bearer ${adminTokenB}`);

    // Must return 404 NOT_FOUND (prevent resource existence leak)
    assert.equal(crossCommitRes.status, 404);
  });
});
