import assert from 'node:assert/strict';
import test from 'node:test';

test('Analytics endpoints calculate aggregations and respect RBAC query scoping', async () => {
  let mongod;
  let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

  if (!databaseUri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    databaseUri = mongod.getUri();
  }

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = databaseUri;
  process.env.MONGODB_DB_NAME = 'retentionai_analytics_test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
  process.env.CORS_ORIGINS = 'http://localhost:5173';

  const [
    { connectDatabase, disconnectDatabase },
    { ensureSystemRoles },
    { Role },
    { User },
    { Department },
    { Employee },
    { hashPassword },
    { createAccessToken },
    { app },
  ] = await Promise.all([
    import('../src/config/database.js'),
    import('../src/services/roleService.js'),
    import('../src/models/Role.js'),
    import('../src/models/User.js'),
    import('../src/models/Department.js'),
    import('../src/models/Employee.js'),
    import('../src/utils/password.js'),
    import('../src/utils/tokens.js'),
    import('../src/app.js'),
  ]);

  await connectDatabase();
  await Department.deleteMany({});
  await Employee.deleteMany({});
  await User.deleteMany({});
  await Role.deleteMany({});
  await ensureSystemRoles();

  const adminRole = await Role.findOne({ name: 'ADMIN' });
  const deptMgrRole = await Role.findOne({ name: 'DEPARTMENT_MANAGER' });

  // Create test departments
  const deptEng = await Department.create({ name: 'Engineering', code: 'ENG', location: 'Floor 3' });
  const deptHr = await Department.create({ name: 'Human Resources', code: 'HR', location: 'Floor 1' });

  // Create test users
  const admin = await User.create({
    name: 'Analytics Admin',
    email: 'admin.analytics@example.test',
    passwordHash: await hashPassword('Admin#12345'),
    roleId: adminRole.id,
  });

  const deptManager = await User.create({
    name: 'Tech Lead Manager',
    email: 'tech.mgr@example.test',
    passwordHash: await hashPassword('User#12345'),
    roleId: deptMgrRole.id,
    departmentId: deptEng.id,
  });

  // Create sample employees
  await Employee.create([
    {
      employeeCode: 'EMP-101',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@analytics.test',
      departmentId: deptEng.id,
      designation: 'Staff Engineer',
      joiningDate: new Date('2023-01-10'),
      salary: 140000,
      status: 'ACTIVE',
      gender: 'FEMALE',
      employmentType: 'FULL_TIME',
    },
    {
      employeeCode: 'EMP-102',
      firstName: 'Bob',
      lastName: 'Johnson',
      email: 'bob.johnson@analytics.test',
      departmentId: deptEng.id,
      designation: 'Senior Developer',
      joiningDate: new Date('2024-02-15'),
      salary: 115000,
      status: 'ACTIVE',
      gender: 'MALE',
      employmentType: 'FULL_TIME',
    },
    {
      employeeCode: 'EMP-103',
      firstName: 'Carol',
      lastName: 'Davis',
      email: 'carol.davis@analytics.test',
      departmentId: deptHr.id,
      designation: 'HR Coordinator',
      joiningDate: new Date('2024-05-01'),
      salary: 75000,
      status: 'ACTIVE',
      gender: 'FEMALE',
      employmentType: 'FULL_TIME',
    },
  ]);

  const adminToken = createAccessToken({ id: admin.id, role: adminRole });
  const deptMgrToken = createAccessToken({
    id: deptManager.id,
    role: deptMgrRole,
    departmentId: deptEng.id,
  });

  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/analytics`;

  try {
    // 1. Admin gets full Dashboard Summary (200)
    const summaryResponse = await fetch(`${baseUrl}/dashboard-summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const summaryBody = await summaryResponse.json();
    assert.equal(summaryResponse.status, 200);
    assert.equal(summaryBody.data.kpis.totalEmployees, 3);
    assert.equal(summaryBody.data.kpis.departmentCount, 2);
    assert.equal(summaryBody.data.departmentStats.length, 2);

    // 2. Admin gets standalone KPIs (200)
    const kpiResponse = await fetch(`${baseUrl}/kpis`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const kpiBody = await kpiResponse.json();
    assert.equal(kpiResponse.status, 200);
    assert.equal(kpiBody.data.activeEmployees, 3);
    assert.equal(typeof kpiBody.data.attritionRate.value, 'number');
    assert.equal(kpiBody.data.attritionRate.isPlaceholder, true);

    // 3. Admin gets monthly trends (200)
    const trendResponse = await fetch(`${baseUrl}/monthly-trends`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const trendBody = await trendResponse.json();
    assert.equal(trendResponse.status, 200);
    assert.equal(trendBody.data.length, 12);

    // 4. Admin gets demographics breakdown (200)
    const demoResponse = await fetch(`${baseUrl}/demographics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const demoBody = await demoResponse.json();
    assert.equal(demoResponse.status, 200);
    assert.equal(demoBody.data.byGender.length, 2); // Female: 2, Male: 1

    // 5. Department Manager query is scoped to Engineering (200)
    const scopedKpiResponse = await fetch(`${baseUrl}/kpis`, {
      headers: { Authorization: `Bearer ${deptMgrToken}` },
    });
    const scopedKpiBody = await scopedKpiResponse.json();
    assert.equal(scopedKpiResponse.status, 200);
    assert.equal(scopedKpiBody.data.totalEmployees, 2); // Only Alice and Bob in ENG
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await Department.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await Role.deleteMany({});
    await disconnectDatabase();
    if (mongod) {
      await mongod.stop();
    }
  }
});
