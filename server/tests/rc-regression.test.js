import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

test('RC1 regressions: HR validation returns 400, and employee self-scope RBAC is enforced', async () => {
  let mongoServer;
  let server;
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create();
    const MONGODB_URI = mongoServer.getUri();

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = MONGODB_URI;
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    const [
      { connectDatabase },
      { ensureSystemRoles },
      { Role },
      { User },
      { Employee },
      { hashPassword },
      { createAccessToken },
      { app },
    ] = await Promise.all([
      import('../src/config/database.js'),
      import('../src/services/roleService.js'),
      import('../src/models/Role.js'),
      import('../src/models/User.js'),
      import('../src/models/Employee.js'),
      import('../src/utils/password.js'),
      import('../src/utils/tokens.js'),
      import('../src/app.js'),
    ]);

    await connectDatabase();
    await ensureSystemRoles();

    await User.deleteMany({ email: { $in: ['rc.admin@example.test', 'self.scoped.login@example.test'] } });
    await Employee.deleteMany({ email: { $in: ['self.scoped@example.test', 'someone.else@example.test'] } });

    const adminRole = await Role.findOne({ name: 'ADMIN' });
    const employeeRole = await Role.findOne({ name: 'EMPLOYEE' });

    const admin = await User.create({
      name: 'RC Admin',
      email: 'rc.admin@example.test',
      passwordHash: await hashPassword('Admin#12345'),
      roleId: adminRole.id,
      organizationId: '60d5ec388832a828f8000000',
    });
    const adminToken = createAccessToken({ id: admin.id, role: adminRole, organizationId: '60d5ec388832a828f8000000' });

    const ownEmployee = await Employee.create({
      organizationId: '60d5ec388832a828f8000000',
      employeeCode: 'EMP-RC-010',
      firstName: 'Self',
      lastName: 'Scoped',
      email: 'self.scoped@example.test',
      departmentId: '60d5ec388832a828f8000001',
      designation: 'Engineer',
      joiningDate: new Date('2024-01-01'),
      salary: 77000,
      workLocation: 'Remote',
    });

    const otherEmployee = await Employee.create({
      organizationId: '60d5ec388832a828f8000000',
      employeeCode: 'EMP-RC-011',
      firstName: 'Someone',
      lastName: 'Else',
      email: 'someone.else@example.test',
      departmentId: '60d5ec388832a828f8000001',
      designation: 'Manager',
      joiningDate: new Date('2023-01-01'),
      salary: 250000, // the PII this test must confirm never leaks
      workLocation: 'Office',
    });

    const employeeUser = await User.create({
      name: 'Self Scoped',
      email: 'self.scoped.login@example.test',
      passwordHash: await hashPassword('Employee#12345'),
      roleId: employeeRole.id,
      employeeId: ownEmployee.id,
      organizationId: '60d5ec388832a828f8000000',
    });
    ownEmployee.userId = employeeUser.id;
    await ownEmployee.save();

    const employeeToken = createAccessToken({ id: employeeUser.id, role: employeeRole, organizationId: '60d5ec388832a828f8000000' });

    server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    // ── Scenario 1: validation errors must be 400, never 500 ──────────────
    // ── Scenario 1: validation errors must be 400, never 500 ──────────────
    const invalidResponse = await fetch(`${baseUrl}/hr/attendance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: ownEmployee.id,
        attendanceDate: '2026-03-01', // invalid — not a full ISO datetime
        attendanceStatus: 'PRESENT',
      }),
    });
    const invalidBody = await invalidResponse.json();
    assert.equal(invalidResponse.status, 400, `expected 400, got ${invalidResponse.status}: ${JSON.stringify(invalidBody)}`);
    assert.equal(invalidBody.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(invalidBody.error.details) && invalidBody.error.details.length > 0);

    // Same check on a second generic-collection route — confirms the fix is
    // systemic (the global error handler), not a one-off patch.
    const promoResponse = await fetch(`${baseUrl}/hr/promotions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: ownEmployee.id, promotionDate: 'not-a-date' }),
    });
    assert.equal(promoResponse.status, 400);
    assert.equal((await promoResponse.json()).error.code, 'VALIDATION_ERROR');

    // The happy path must still work (the fix must not break valid requests).
    const validResponse = await fetch(`${baseUrl}/hr/attendance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: ownEmployee.id,
        attendanceDate: '2026-03-01T00:00:00.000Z',
        attendanceStatus: 'PRESENT',
      }),
    });
    assert.equal(validResponse.status, 201);

    // ── Scenario 2: employee self-scope RBAC ───────────────────────────────
    const ownResponse = await fetch(`${baseUrl}/employees/${ownEmployee.id}`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert.equal(ownResponse.status, 200, `expected own-profile read to succeed, got ${ownResponse.status}`);

    const otherResponse = await fetch(`${baseUrl}/employees/${otherEmployee.id}`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const otherBody = await otherResponse.text();
    assert.equal(otherResponse.status, 403, `expected 403 reading another employee's profile, got ${otherResponse.status}: ${otherBody}`);
    assert.ok(!otherBody.includes('250000'), 'salary of another employee must never appear in the response');

    // Same self-scope must apply to the merged AI insights endpoint, which
    // previously had no scope check at all.
    const aiInsightsResponse = await fetch(`${baseUrl}/employees/${otherEmployee.id}/ai-insights`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    assert.equal(aiInsightsResponse.status, 403, `expected 403 on cross-employee ai-insights, got ${aiInsightsResponse.status}`);

    // HR/Admin behavior must remain unchanged — unrestricted read access.
    const adminReadResponse = await fetch(`${baseUrl}/employees/${otherEmployee.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminReadResponse.status, 200, 'ADMIN must retain unrestricted employee-read access');
  } catch (err) {
    console.error('RC REGRESSION TEST ERROR:', err);
    throw err;
  } finally {
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  }
});
