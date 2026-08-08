import assert from 'node:assert/strict';
import test from 'node:test';

test(
  'User management endpoints enforce admin authorization and validate input',
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
    process.env.MONGODB_DB_NAME = 'retentionai_user_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
    process.env.CORS_ORIGINS = 'http://localhost:5173';

    const [
      { connectDatabase, disconnectDatabase },
      { ensureSystemRoles },
      { Role },
      { User },
      { hashPassword },
      { createAccessToken },
      { app },
      { DEFAULT_ORGANIZATION_ID },
    ] = await Promise.all([
      import('../src/config/database.js'),
      import('../src/services/roleService.js'),
      import('../src/models/Role.js'),
      import('../src/models/User.js'),
      import('../src/utils/password.js'),
      import('../src/utils/tokens.js'),
      import('../src/app.js'),
      import('../src/config/tenancy.js'),
    ]);

    await connectDatabase();
    await User.deleteMany({});
    await Role.deleteMany({});
    await ensureSystemRoles();

    const adminRole = await Role.findOne({ name: 'ADMIN' });
    const employeeRole = await Role.findOne({ name: 'EMPLOYEE' });

    // organizationId matches authenticate.js's DEFAULT_ORGANIZATION_ID
    // fallback — required now that userService's list/get/update/deactivate
    // are correctly tenant-scoped (they previously weren't at all: any
    // ADMIN from any organization could list, edit, reassign the role of,
    // or deactivate any other organization's users).
    const admin = await User.create({
      organizationId: DEFAULT_ORGANIZATION_ID,
      name: 'System Admin',
      email: 'admin@example.test',
      passwordHash: await hashPassword('Admin#12345'),
      roleId: adminRole.id,
    });

    const standardUser = await User.create({
      organizationId: DEFAULT_ORGANIZATION_ID,
      name: 'Standard User',
      email: 'user@example.test',
      passwordHash: await hashPassword('User#12345'),
      roleId: employeeRole.id,
    });

    const adminToken = createAccessToken({ id: admin.id, role: adminRole });
    const userToken = createAccessToken({ id: standardUser.id, role: employeeRole });

    const server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/users`;

    try {
      // 1. Non-admin cannot create a user (RBAC test)
      const rejectResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'Hire',
          email: 'new@example.test',
          password: 'Password#123',
          role: 'EMPLOYEE',
        }),
      });
      assert.equal(rejectResponse.status, 403);

      // 2. Admin can create a user
      const createResponse = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName: 'New',
          lastName: 'Hire',
          email: 'new@example.test',
          password: 'Password#123',
          role: 'HR_MANAGER',
        }),
      });
      const createBody = await createResponse.json();
      assert.equal(createResponse.status, 201);
      assert.equal(createBody.data.email, 'new@example.test');
      assert.equal(createBody.data.role, 'HR_MANAGER');

      const newUserId = createBody.data.id;

      // 3. Admin can list users
      const listResponse = await fetch(`${baseUrl}?pageSize=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listBody = await listResponse.json();
      assert.equal(listResponse.status, 200);
      assert.equal(listBody.data.items.length, 3); // Admin, standard, new

      // 4. Admin can deactivate user
      const deactResponse = await fetch(`${baseUrl}/${newUserId}/deactivate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Left company' }),
      });
      assert.equal(deactResponse.status, 204);

      // 5. Admin cannot deactivate themselves
      const selfDeactResponse = await fetch(`${baseUrl}/${admin.id}/deactivate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'I quit' }),
      });
      assert.equal(selfDeactResponse.status, 409);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await User.deleteMany({});
      await Role.deleteMany({});
      await disconnectDatabase();
      if (mongod) {
        await mongod.stop();
      }
    }
  },
);
