import assert from 'node:assert/strict';
import test from 'node:test';

test(
  'organization signup creates an isolated tenant, issues a session, and enforces cross-tenant isolation',
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
    process.env.MONGODB_DB_NAME = 'retentionai_org_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
    process.env.CORS_ORIGINS = 'http://localhost:5173';

    const [{ connectDatabase, disconnectDatabase }, { ensureSystemRoles }, { Role }, { User }, { Organization }, { Employee }, { Department }, { app }] = await Promise.all([
      import('../src/config/database.js'),
      import('../src/services/roleService.js'),
      import('../src/models/Role.js'),
      import('../src/models/User.js'),
      import('../src/models/Organization.js'),
      import('../src/models/Employee.js'),
      import('../src/models/Department.js'),
      import('../src/app.js'),
    ]);

    await connectDatabase();
    await User.deleteMany({});
    await Role.deleteMany({});
    await Organization.deleteMany({});
    await Employee.deleteMany({});
    await Department.deleteMany({});
    await ensureSystemRoles();

    const server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    try {
      // --- Signup: two organizations, same chosen name, to exercise slug collision handling ---
      const signupA = await fetch(`${baseUrl}/organizations/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Acme Corp',
          adminName: 'Alice Admin',
          adminEmail: 'alice@acme.test',
          adminPassword: 'Admin#12345',
        }),
      });
      const bodyA = await signupA.json();
      assert.equal(signupA.status, 201, JSON.stringify(bodyA));
      assert.equal(bodyA.success, true);
      assert.ok(bodyA.data.accessToken, 'signup should issue an access token');
      assert.ok(bodyA.data.organization.id, 'signup should return the new organization id');
      assert.equal(bodyA.data.organization.name, 'Acme Corp');
      assert.equal(bodyA.data.organization.plan, 'FREE');
      assert.equal(bodyA.data.organization.status, 'TRIALING');
      assert.equal(bodyA.data.user.email, 'alice@acme.test');
      const tokenA = bodyA.data.accessToken;
      const orgAId = bodyA.data.organization.id;
      const orgASlug = bodyA.data.organization.slug;

      const signupB = await fetch(`${baseUrl}/organizations/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Acme Corp', // same name on purpose
          adminName: 'Bob Admin',
          adminEmail: 'bob@beta.test',
          adminPassword: 'Admin#12345',
        }),
      });
      const bodyB = await signupB.json();
      assert.equal(signupB.status, 201, JSON.stringify(bodyB));
      const tokenB = bodyB.data.accessToken;
      const orgBId = bodyB.data.organization.id;
      const orgBSlug = bodyB.data.organization.slug;

      assert.notEqual(orgAId, orgBId, 'two signups must produce two distinct organizations');
      assert.notEqual(orgASlug, orgBSlug, 'a duplicate organization name must still produce a unique slug');

      // --- Same email, DIFFERENT organization: must succeed (uniqueness is per-org, not global) ---
      const signupC = await fetch(`${baseUrl}/organizations/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Gamma LLC',
          adminName: 'Alice Admin',
          adminEmail: 'alice@acme.test', // reused from Org A on purpose
          adminPassword: 'Admin#12345',
        }),
      });
      assert.equal(signupC.status, 201, 'the same email may administer a second, separate organization');

      // --- Weak password is rejected before any writes happen ---
      const signupWeak = await fetch(`${baseUrl}/organizations/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: 'Weak Co',
          adminName: 'Weak Admin',
          adminEmail: 'weak@weak.test',
          adminPassword: 'weak',
        }),
      });
      assert.equal(signupWeak.status, 400);
      const orgCountAfterWeak = await Organization.countDocuments({ name: 'Weak Co' });
      assert.equal(orgCountAfterWeak, 0, 'a failed signup must not leave an orphaned organization behind');

      // --- GET /organizations/me resolves per-token, not a shared default ---
      const meA = await fetch(`${baseUrl}/organizations/me`, { headers: { Authorization: `Bearer ${tokenA}` } });
      const meABody = await meA.json();
      assert.equal(meA.status, 200);
      assert.equal(meABody.data.id, orgAId);

      const meB = await fetch(`${baseUrl}/organizations/me`, { headers: { Authorization: `Bearer ${tokenB}` } });
      const meBBody = await meB.json();
      assert.equal(meBBody.data.id, orgBId);
      assert.notEqual(meABody.data.id, meBBody.data.id);

      // --- Cross-tenant isolation: a department created in Org A must be invisible to Org B ---
      const createDept = await fetch(`${baseUrl}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: 'Engineering', code: 'ENG' }),
      });
      const createDeptBody = await createDept.json();
      assert.equal(createDept.status, 201, JSON.stringify(createDeptBody));
      const deptAId = createDeptBody.data.id ?? createDeptBody.data._id;

      const deptsAsA = await fetch(`${baseUrl}/departments`, { headers: { Authorization: `Bearer ${tokenA}` } });
      const deptsAsABody = await deptsAsA.json();
      const deptListA = deptsAsABody.data.departments ?? deptsAsABody.data.items ?? deptsAsABody.data;
      assert.equal(Array.isArray(deptListA) ? deptListA.length : deptListA.total, 1, 'Org A must see its own department');

      const deptsAsB = await fetch(`${baseUrl}/departments`, { headers: { Authorization: `Bearer ${tokenB}` } });
      const deptsAsBBody = await deptsAsB.json();
      const deptListB = deptsAsBBody.data.departments ?? deptsAsBBody.data.items ?? deptsAsBBody.data;
      const countB = Array.isArray(deptListB) ? deptListB.length : deptListB.total;
      assert.equal(countB, 0, 'Org B must NOT see Org A\'s department — this is the entire point of the tenant-isolation fix');

      // --- Cross-tenant isolation: an EMPLOYEE (PII: salary, personal data) created in Org A must be invisible to Org B ---
      const createEmp = await fetch(`${baseUrl}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          employeeCode: 'EMP-001',
          firstName: 'Erin',
          lastName: 'Employee',
          email: 'erin@acme.test',
          departmentId: deptAId,
          designation: 'Software Engineer',
          joiningDate: '2024-01-15',
          salary: 150000,
        }),
      });
      const createEmpBody = await createEmp.json();
      assert.equal(createEmp.status, 201, JSON.stringify(createEmpBody));
      const empAId = createEmpBody.data.id ?? createEmpBody.data._id;

      const empsAsA = await fetch(`${baseUrl}/employees`, { headers: { Authorization: `Bearer ${tokenA}` } });
      const empsAsABody = await empsAsA.json();
      assert.equal(empsAsABody.data.totalItems, 1, 'Org A must see its own employee');

      const empsAsB = await fetch(`${baseUrl}/employees`, { headers: { Authorization: `Bearer ${tokenB}` } });
      const empsAsBBody = await empsAsB.json();
      assert.equal(empsAsBBody.data.totalItems, 0, 'Org B must NOT see Org A\'s employee list — PII (salary, personal data) leak otherwise');

      // Direct-by-ID read must also 404, not just be absent from the list —
      // an attacker who somehow learns/guesses the ObjectId must still be blocked.
      const empDirectAsB = await fetch(`${baseUrl}/employees/${empAId}`, { headers: { Authorization: `Bearer ${tokenB}` } });
      assert.equal(empDirectAsB.status, 404, 'Org B must NOT be able to fetch Org A\'s employee by ID either');
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await User.deleteMany({});
      await Role.deleteMany({});
      await Organization.deleteMany({});
      await Employee.deleteMany({});
      await Department.deleteMany({});
      await disconnectDatabase();
      if (mongod) await mongod.stop();
    }
  },
);
