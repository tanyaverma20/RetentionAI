import assert from 'node:assert/strict';
import test from 'node:test';

test('Employee management endpoints support full lifecycle, CSV bulk import, and RBAC', async () => {
  let mongod;
  let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

  if (!databaseUri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    databaseUri = mongod.getUri();
  }

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = databaseUri;
  process.env.MONGODB_DB_NAME = 'retentionai_emp_test';
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

  const admin = await User.create({
    name: 'HR Admin',
    email: 'hr.admin@example.test',
    passwordHash: await hashPassword('Admin#12345'),
    roleId: adminRole.id,
  });

  const department = await Department.create({
    name: 'Technology',
    code: 'TECH',
    location: 'Headquarters',
  });

  const adminToken = createAccessToken({ id: admin.id, role: adminRole });

  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/employees`;

  try {
    // 1. Create employee (201)
    const createResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        employeeCode: 'EMP-001',
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice.smith@example.test',
        departmentId: department.id,
        designation: 'Senior Software Engineer',
        joiningDate: '2024-01-15',
        salary: 120000,
        workLocation: 'New York',
      }),
    });
    const createBody = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createBody.data.employeeCode, 'EMP-001');
    assert.equal(createBody.data.firstName, 'Alice');

    const empId = createBody.data._id;

    // 2. Search employee (200)
    const listResponse = await fetch(`${baseUrl}?search=Alice`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listBody = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listBody.data.items.length, 1);
    assert.equal(listBody.data.totalItems, 1);

    // 3. Soft Delete Employee (200)
    const deleteResponse = await fetch(`${baseUrl}/${empId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteBody = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.equal(deleteBody.data.isDeleted, true);
    assert.equal(deleteBody.data.status, 'INACTIVE');

    // 4. Restore Employee (200)
    const restoreResponse = await fetch(`${baseUrl}/${empId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const restoreBody = await restoreResponse.json();
    assert.equal(restoreResponse.status, 200);
    assert.equal(restoreBody.data.isDeleted, false);
    assert.equal(restoreBody.data.status, 'ACTIVE');

    // 5. Bulk CSV Import (200)
    const csvContent = `employeeCode,firstName,lastName,email,department,designation,joiningDate,salary
EMP-002,Bob,Jones,bob.jones@example.test,TECH,Product Manager,2024-03-01,110000
EMP-003,Carol,White,carol.white@example.test,TECH,UX Designer,2024-04-10,95000`;

    const bulkResponse = await fetch(`${baseUrl}/bulk-import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ csvText: csvContent }),
    });
    const bulkBody = await bulkResponse.json();
    assert.equal(bulkResponse.status, 200);
    assert.equal(bulkBody.data.importedCount, 2);
    assert.equal(bulkBody.data.failedCount, 0);

    // Verify total count is now 3
    const finalCount = await Employee.countDocuments({ isDeleted: false });
    assert.equal(finalCount, 3);
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
