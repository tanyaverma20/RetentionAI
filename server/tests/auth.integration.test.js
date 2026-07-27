import assert from 'node:assert/strict';
import test from 'node:test';

test(
  'login, refresh, authenticated profile, and logout follow the auth contract',
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
    process.env.MONGODB_DB_NAME = 'retentionai_auth_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
    process.env.CORS_ORIGINS = 'http://localhost:5173';

    const [
      { connectDatabase, disconnectDatabase },
      { ensureSystemRoles },
      { Role },
      { User },
      { hashPassword },
      { app },
    ] = await Promise.all([
      import('../src/config/database.js'),
      import('../src/services/roleService.js'),
      import('../src/models/Role.js'),
      import('../src/models/User.js'),
      import('../src/utils/password.js'),
      import('../src/app.js'),
    ]);

    await connectDatabase();
    await User.deleteMany({});
    await Role.deleteMany({});
    await ensureSystemRoles();
    const adminRole = await Role.findOne({ name: 'ADMIN' });
    await User.create({
      name: 'Admin User',
      email: 'admin@example.test',
      passwordHash: await hashPassword('Admin#12345'),
      roleId: adminRole.id,
    });

    const server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
    try {
      const loginResponse = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@example.test', password: 'Admin#12345' }),
      });
      const loginBody = await loginResponse.json();
      assert.equal(loginResponse.status, 200);
      assert.equal(loginBody.success, true);

      const profileResponse = await fetch(`${baseUrl}/me`, {
        headers: { Authorization: `Bearer ${loginBody.data.accessToken}` },
      });
      assert.equal(profileResponse.status, 200);

      const refreshResponse = await fetch(`${baseUrl}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: loginBody.data.refreshToken }),
      });
      const refreshBody = await refreshResponse.json();
      assert.equal(refreshResponse.status, 200);
      assert.notEqual(refreshBody.data.refreshToken, loginBody.data.refreshToken);

      const logoutResponse = await fetch(`${baseUrl}/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshBody.data.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: refreshBody.data.refreshToken }),
      });
      assert.equal(logoutResponse.status, 204);
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
