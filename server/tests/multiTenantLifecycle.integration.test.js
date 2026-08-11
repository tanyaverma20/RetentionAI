import assert from 'node:assert/strict';
import test from 'node:test';

test(
  'Multi-tenant lifecycle, bulk import change detection, employee code identity, and risk timeline endpoints',
  async () => {
    let mongod;
    let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

    if (!databaseUri) {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      databaseUri = mongod.getUri();
    }

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = databaseUri;
    process.env.MONGODB_DB_NAME = 'retentionai_lifecycle_test';
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
      { Import },
      { EmployeeChange },
      { PredictionHistory },
      { DEFAULT_ORGANIZATION_ID },
      { materializeDemoOrganization },
      { app },
    ] = await Promise.all([
      import('../src/config/database.js'),
      import('../src/services/roleService.js'),
      import('../src/models/Role.js'),
      import('../src/models/User.js'),
      import('../src/models/Organization.js'),
      import('../src/models/Employee.js'),
      import('../src/models/Department.js'),
      import('../src/models/Import.js'),
      import('../src/models/EmployeeChange.js'),
      import('../src/models/PredictionHistory.js'),
      import('../src/config/tenancy.js'),
      import('../src/seeders/materializeDemoOrganization.js'),
      import('../src/app.js'),
    ]);

    await connectDatabase();
    await User.deleteMany({});
    await Role.deleteMany({});
    await Organization.deleteMany({});
    await Employee.deleteMany({});
    await Department.deleteMany({});
    await Import.deleteMany({});
    await EmployeeChange.deleteMany({});
    await PredictionHistory.deleteMany({});
    await ensureSystemRoles();

    const server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    try {
      // 1. Idempotent Demo Organization Materialization Test
      const demoOrg1 = await materializeDemoOrganization();
      assert.equal(demoOrg1._id.toString(), DEFAULT_ORGANIZATION_ID);
      assert.equal(demoOrg1.name, 'RetentionAI Demo Organization');

      const demoOrg2 = await materializeDemoOrganization(); // second call
      assert.equal(demoOrg2._id.toString(), DEFAULT_ORGANIZATION_ID);

      // 2. Signup Test Tenant Organization
      const signupRes = await fetch(`${baseUrl}/organizations/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'LifeCycle Corp',
          adminName: 'Lead HR',
          adminEmail: 'hr@lifecycle.test',
          adminPassword: 'Admin#12345',
        }),
      });
      const signupBody = await signupRes.json();
      assert.equal(signupRes.status, 201);
      const token = signupBody.data.accessToken;
      const orgId = signupBody.data.organization.id;

      assert.notEqual(orgId, DEFAULT_ORGANIZATION_ID, 'New tenant must receive unique organizationId');

      // Create Department for LifeCycle Corp
      const deptRes = await fetch(`${baseUrl}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Product Engineering', code: 'ENG' }),
      });
      const deptBody = await deptRes.json();
      assert.equal(deptRes.status, 201);

      // 3. Initial Bulk Import (2 employees)
      const import1Res = await fetch(`${baseUrl}/employees/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'FULL_SNAPSHOT',
          records: [
            { employeeCode: 'EMP-001', firstName: 'Alice', lastName: 'Smith', email: 'alice@lifecycle.test', designation: 'Engineer', department: 'ENG', salary: 100000 },
            { employeeCode: 'EMP-002', firstName: 'Bob', lastName: 'Jones', email: 'bob@lifecycle.test', designation: 'Designer', department: 'ENG', salary: 90000 },
          ],
        }),
      });
      const import1Body = await import1Res.json();
      assert.equal(import1Res.status, 200, JSON.stringify(import1Body));
      assert.equal(import1Body.data.new, 2);
      assert.equal(import1Body.data.changed, 0);
      assert.equal(import1Body.data.unchanged, 0);
      assert.equal(import1Body.data.inactive, 0);

      // Verify Import document creation
      const importDoc1 = await Import.findOne({ organizationId: orgId, uploadId: import1Body.data.uploadId });
      assert.ok(importDoc1, 'Import document summary must exist');
      assert.equal(importDoc1.newCount, 2);

      // 4. Change Detection & Employee Identity (Updating EMP-001 salary + email, adding EMP-003, missing EMP-002 in FULL_SNAPSHOT)
      const import2Res = await fetch(`${baseUrl}/employees/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'FULL_SNAPSHOT',
          records: [
            { employeeCode: 'EMP-001', firstName: 'Alice', lastName: 'Smith', email: 'alice.new@lifecycle.test', designation: 'Engineer', department: 'ENG', salary: 120000 },
            { employeeCode: 'EMP-003', firstName: 'Charlie', lastName: 'Brown', email: 'charlie@lifecycle.test', designation: 'QA Lead', department: 'ENG', salary: 85000 },
          ],
        }),
      });
      const import2Body = await import2Res.json();
      assert.equal(import2Res.status, 200, JSON.stringify(import2Body));
      assert.equal(import2Body.data.new, 1, 'EMP-003 is NEW');
      assert.equal(import2Body.data.changed, 1, 'EMP-001 is CHANGED');
      assert.equal(import2Body.data.inactive, 1, 'EMP-002 is missing in FULL_SNAPSHOT so marked INACTIVE');

      // Verify EMP-001 canonical identity preserved with updated email and salary
      const emp1 = await Employee.findOne({ organizationId: orgId, employeeCode: 'EMP-001' });
      assert.equal(emp1.email, 'alice.new@lifecycle.test');
      assert.equal(emp1.salary, 120000);

      // Verify EmployeeChange diff collection
      const changes = await EmployeeChange.find({ organizationId: orgId, uploadId: import2Body.data.uploadId });
      assert.equal(changes.length, 1, 'One EmployeeChange document should record field diffs');
      assert.equal(changes[0].employeeCode, 'EMP-001');
      const salaryDiff = changes[0].changedFields.find((f) => f.field === 'salary');
      assert.ok(salaryDiff);
      assert.equal(salaryDiff.previousValue, 100000);
      assert.equal(salaryDiff.newValue, 120000);

      // Verify EMP-002 deactivated
      const emp2 = await Employee.findOne({ organizationId: orgId, employeeCode: 'EMP-002' });
      assert.equal(emp2.status, 'INACTIVE');

      // 5. PARTIAL_UPDATE mode (EMP-001 unchanged, EMP-002 missing, EMP-002 remains INACTIVE without further deactivation)
      const import3Res = await fetch(`${baseUrl}/employees/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'PARTIAL_UPDATE',
          records: [
            { employeeCode: 'EMP-001', firstName: 'Alice', lastName: 'Smith', email: 'alice.new@lifecycle.test', designation: 'Engineer', department: 'ENG', salary: 120000 },
          ],
        }),
      });
      const import3Body = await import3Res.json();
      assert.equal(import3Res.status, 200);
      assert.equal(import3Body.data.new, 0);
      assert.equal(import3Body.data.changed, 0);
      assert.equal(import3Body.data.unchanged, 1);
      assert.equal(import3Body.data.inactive, 0, 'PARTIAL_UPDATE does not deactivate missing employees');

      // 6. Risk Timeline API Endpoint Test
      // Seed a prediction history record for EMP-001
      await PredictionHistory.create({
        organizationId: orgId,
        employeeId: emp1._id,
        employeeCode: emp1.employeeCode,
        runId: 'RUN-TEST-001',
        modelId: 'MODEL-TEST-001',
        riskScore: 0.72,
        riskLevel: 'HIGH',
        confidence: 0.88,
        modelVersion: 'v1.0.0',
        predictedAt: new Date(),
      });

      const timelineRes = await fetch(`${baseUrl}/employees/${emp1._id}/risk-timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const timelineBody = await timelineRes.json();
      assert.equal(timelineRes.status, 200, JSON.stringify(timelineBody));
      assert.equal(timelineBody.data.totalItems, 1);
      assert.equal(timelineBody.data.items[0].riskLevel, 'HIGH');
      assert.equal(timelineBody.data.items[0].riskScore, 0.72);

      // Cross-tenant access to EMP-001 risk timeline using unauthorized token
      const tenantBRes = await fetch(`${baseUrl}/organizations/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Other Corp',
          adminName: 'Other Admin',
          adminEmail: 'other@corp.test',
          adminPassword: 'Admin#12345',
        }),
      });
      const tenantBBody = await tenantBRes.json();
      const tokenB = tenantBBody.data.accessToken;

      const crossTimelineRes = await fetch(`${baseUrl}/employees/${emp1._id}/risk-timeline`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(crossTimelineRes.status, 404, 'Cross-tenant request to risk-timeline must return 404');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await User.deleteMany({});
      await Role.deleteMany({});
      await Organization.deleteMany({});
      await Employee.deleteMany({});
      await Department.deleteMany({});
      await Import.deleteMany({});
      await EmployeeChange.deleteMany({});
      await PredictionHistory.deleteMany({});
      await disconnectDatabase();
      if (mongod) await mongod.stop();
    }
  },
);
