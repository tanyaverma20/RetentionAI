import assert from 'node:assert/strict';
import test from 'node:test';

test('Department management endpoints enforce authorization and validate operations', async () => {
  let mongod;
  let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

  if (!databaseUri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    databaseUri = mongod.getUri();
  }

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = databaseUri;
  process.env.MONGODB_DB_NAME = 'retentionai_dept_test';
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
  const employeeRole = await Role.findOne({ name: 'EMPLOYEE' });

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin.dept@example.test',
    passwordHash: await hashPassword('Admin#12345'),
    roleId: adminRole.id,
  });

  const empUser = await User.create({
    name: 'Regular Employee',
    email: 'emp.dept@example.test',
    passwordHash: await hashPassword('User#12345'),
    roleId: employeeRole.id,
  });

  const adminToken = createAccessToken({ id: admin.id, role: adminRole });
  const empToken = createAccessToken({ id: empUser.id, role: employeeRole });

  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/departments`;

  try {
    // 1. Regular employee cannot create department (403)
    const rejectResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${empToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Engineering',
        code: 'ENG',
      }),
    });
    assert.equal(rejectResponse.status, 403);

    // 2. Admin can create department (201)
    const createResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Engineering',
        code: 'ENG',
        location: 'Building A',
      }),
    });
    const createBody = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createBody.data.name, 'Engineering');
    assert.equal(createBody.data.code, 'ENG');
    const deptId = createBody.data._id;

    // 3. Duplicate code is rejected (409)
    const dupResponse = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Software Dev',
        code: 'ENG',
      }),
    });
    assert.equal(dupResponse.status, 409);

    // 4. List departments (200)
    const listResponse = await fetch(baseUrl, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listBody = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listBody.data.length, 1);
    assert.equal(listBody.data[0].employeeCount, 0);

    // 5. Update department (200)
    const updateResponse = await fetch(`${baseUrl}/${deptId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: 'Building B',
      }),
    });
    const updateBody = await updateResponse.json();
    assert.equal(updateResponse.status, 200);
    assert.equal(updateBody.data.location, 'Building B');

    // 6. Delete department (200)
    const deleteResponse = await fetch(`${baseUrl}/${deptId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(deleteResponse.status, 200);
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
