import assert from 'node:assert/strict';
import test from 'node:test';

test('Employee CSV Import Department Auto-Creation & Isolation Suite (Scenarios A through G)', async () => {
  let mongod;
  let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

  if (!databaseUri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    databaseUri = mongod.getUri();
  }

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = databaseUri;
  process.env.MONGODB_DB_NAME = 'retentionai_dept_import_test';
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
    { Organization },
    { bulkImportEmployees },
    { hashPassword },
    { DEFAULT_ORGANIZATION_ID },
  ] = await Promise.all([
    import('../src/config/database.js'),
    import('../src/services/roleService.js'),
    import('../src/models/Role.js'),
    import('../src/models/User.js'),
    import('../src/models/Department.js'),
    import('../src/models/Employee.js'),
    import('../src/models/Organization.js'),
    import('../src/services/employeeService.js'),
    import('../src/utils/password.js'),
    import('../src/config/tenancy.js'),
  ]);

  await connectDatabase();
  await Department.deleteMany({});
  await Employee.deleteMany({});
  await User.deleteMany({});
  await Role.deleteMany({});
  await Organization.deleteMany({});
  await ensureSystemRoles();

  const orgA = DEFAULT_ORGANIZATION_ID;
  const orgB = '60d5ec388832a828f8000099';

  await Organization.create([
    { _id: orgA, name: 'Org A', slug: 'org-a' },
    { _id: orgB, name: 'Org B', slug: 'org-b' },
  ]);

  try {
    // Scenario A: Import employee with an existing department
    const existingDept = await Department.create({
      organizationId: orgA,
      name: 'Existing Dept',
      code: 'EXISTING_DEPT',
    });

    const rowsA = [
      {
        employeeCode: 'EMP-A1',
        firstName: 'Alice',
        lastName: 'A',
        email: 'alice.a@test.com',
        department: 'Existing Dept',
        designation: 'Engineer',
      },
    ];

    const resultA = await bulkImportEmployees(rowsA, orgA);
    assert.equal(resultA.new, 1);
    assert.equal(resultA.validationErrors, 0);

    const empA = await Employee.findOne({ employeeCode: 'EMP-A1', organizationId: orgA });
    assert.ok(empA);
    assert.equal(empA.departmentId.toString(), existingDept._id.toString());

    // Scenario B: Import employee with a missing department -> automatically created
    const rowsB = [
      {
        employeeCode: 'EMP-B1',
        firstName: 'Bob',
        lastName: 'B',
        email: 'bob.b@test.com',
        department: 'Human Resources',
        designation: 'HR Specialist',
      },
    ];

    const resultB = await bulkImportEmployees(rowsB, orgA);
    assert.equal(resultB.new, 1);
    assert.equal(resultB.validationErrors, 0);

    const createdDeptB = await Department.findOne({ organizationId: orgA, name: 'Human Resources' });
    assert.ok(createdDeptB);

    const empB = await Employee.findOne({ employeeCode: 'EMP-B1', organizationId: orgA });
    assert.equal(empB.departmentId.toString(), createdDeptB._id.toString());

    // Scenario C: Multiple employees using the same missing department -> only ONE department is created
    const rowsC = [
      {
        employeeCode: 'EMP-C1',
        firstName: 'Charlie',
        lastName: 'C',
        email: 'charlie.c@test.com',
        department: 'Finance',
        designation: 'Analyst',
      },
      {
        employeeCode: 'EMP-C2',
        firstName: 'David',
        lastName: 'D',
        email: 'david.d@test.com',
        department: 'Finance',
        designation: 'Accountant',
      },
    ];

    const resultC = await bulkImportEmployees(rowsC, orgA);
    assert.equal(resultC.new, 2);
    assert.equal(resultC.validationErrors, 0);

    const finDepts = await Department.find({ organizationId: orgA, name: 'Finance' });
    assert.equal(finDepts.length, 1);

    // Scenario D: Same department name with different capitalization/whitespace -> treated as same department
    const rowsD = [
      {
        employeeCode: 'EMP-D1',
        firstName: 'Eve',
        lastName: 'E',
        email: 'eve.e@test.com',
        department: '  human resources  ',
        designation: 'Recruiter',
      },
      {
        employeeCode: 'EMP-D2',
        firstName: 'Frank',
        lastName: 'F',
        email: 'frank.f@test.com',
        department: 'HUMAN RESOURCES',
        designation: 'Partner',
      },
    ];

    const resultD = await bulkImportEmployees(rowsD, orgA);
    assert.equal(resultD.new, 2);
    assert.equal(resultD.validationErrors, 0);

    const hrDepts = await Department.find({
      organizationId: orgA,
      name: { $regex: /^human resources$/i },
    });
    assert.equal(hrDepts.length, 1);

    // Scenario E: Departments belonging to another organization are never reused
    // Create 'IT' in Org B
    const deptOrgB = await Department.create({
      organizationId: orgB,
      name: 'IT',
      code: 'IT',
    });

    // Import 'IT' employee into Org A -> should create a NEW 'IT' department for Org A
    const rowsE = [
      {
        employeeCode: 'EMP-E1',
        firstName: 'Grace',
        lastName: 'G',
        email: 'grace.g@test.com',
        department: 'IT',
        designation: 'DevOps',
      },
    ];

    const resultE = await bulkImportEmployees(rowsE, orgA);
    assert.equal(resultE.new, 1);

    const deptOrgA = await Department.findOne({ organizationId: orgA, name: 'IT' });
    assert.ok(deptOrgA);
    assert.notEqual(deptOrgA._id.toString(), deptOrgB._id.toString());

    // Scenario F: Re-importing same CSV does not create duplicate employees or departments
    const rowsF = [
      {
        employeeCode: 'EMP-F1',
        firstName: 'Hank',
        lastName: 'H',
        email: 'hank.h@test.com',
        department: 'Research & Development',
        designation: 'Researcher',
      },
    ];

    const initialDeptsCount = await Department.countDocuments({ organizationId: orgA });
    const resultF1 = await bulkImportEmployees(rowsF, orgA);
    assert.equal(resultF1.new, 1);

    const deptsAfterF1 = await Department.countDocuments({ organizationId: orgA });
    assert.equal(deptsAfterF1, initialDeptsCount + 1);

    const resultF2 = await bulkImportEmployees(rowsF, orgA, { mode: 'PARTIAL_UPDATE' });
    assert.equal(resultF2.new, 0);
    assert.equal(resultF2.unchanged + resultF2.changed, 1);

    const deptsAfterF2 = await Department.countDocuments({ organizationId: orgA });
    assert.equal(deptsAfterF2, deptsAfterF1);

    // Scenario G: Empty department name produces a clear validation error
    const rowsG = [
      {
        employeeCode: 'EMP-G1',
        firstName: 'Ian',
        lastName: 'I',
        email: 'ian.i@test.com',
        department: '',
        designation: 'Tester',
      },
    ];

    const resultG = await bulkImportEmployees(rowsG, orgA);
    assert.equal(resultG.new, 0);
    assert.equal(resultG.validationErrors, 1);
    assert.equal(resultG.errors[0].error, 'Missing required fields (employeeCode, firstName, lastName, email, designation, department).');
  } finally {
    await Department.deleteMany({});
    await Employee.deleteMany({});
    await User.deleteMany({});
    await Role.deleteMany({});
    await Organization.deleteMany({});
    await disconnectDatabase();
    if (mongod) {
      await mongod.stop();
    }
  }
});
