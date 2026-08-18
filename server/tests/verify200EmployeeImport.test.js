import assert from 'node:assert/strict';
import test from 'node:test';

test('Verification of 200 employee CSV import with missing departments auto-creation', async () => {
  let mongod;
  let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

  if (!databaseUri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    databaseUri = mongod.getUri();
  }

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = databaseUri;
  process.env.MONGODB_DB_NAME = 'retentionai_verify200_test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
  process.env.CORS_ORIGINS = 'http://localhost:5173';

  const [
    { connectDatabase, disconnectDatabase },
    { Department },
    { Employee },
    { bulkImportEmployees },
    { DEFAULT_ORGANIZATION_ID },
  ] = await Promise.all([
    import('../src/config/database.js'),
    import('../src/models/Department.js'),
    import('../src/models/Employee.js'),
    import('../src/services/employeeService.js'),
    import('../src/config/tenancy.js'),
  ]);

  await connectDatabase();
  await Department.deleteMany({ organizationId: DEFAULT_ORGANIZATION_ID });
  await Employee.deleteMany({ organizationId: DEFAULT_ORGANIZATION_ID });

  const depts = ['Human Resources', 'IT', 'Finance', 'Sales', 'Research & Development'];
  const testRows = [];

  for (let i = 1; i <= 200; i++) {
    const deptName = depts[(i - 1) % depts.length];
    testRows.push({
      employeeCode: `EMP-200-${String(i).padStart(3, '0')}`,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `user${i}@example.test`,
      department: deptName,
      designation: `Role ${i}`,
      salary: 60000 + i * 100,
    });
  }

  try {
    // Perform bulk import
    const result = await bulkImportEmployees(testRows, DEFAULT_ORGANIZATION_ID);

    assert.equal(result.new, 200);
    assert.equal(result.validationErrors, 0);

    // Verify 5 departments were auto-created
    const createdDepts = await Department.find({ organizationId: DEFAULT_ORGANIZATION_ID });
    assert.equal(createdDepts.length, 5);

    const createdDeptNames = createdDepts.map((d) => d.name).sort();
    assert.deepEqual(createdDeptNames, [...depts].sort());

    // Verify 200 employees exist in database
    const empCount = await Employee.countDocuments({ organizationId: DEFAULT_ORGANIZATION_ID, isDeleted: false });
    assert.equal(empCount, 200);

    // Verify re-import idempotency
    const reimportResult = await bulkImportEmployees(testRows, DEFAULT_ORGANIZATION_ID, { mode: 'PARTIAL_UPDATE' });
    assert.equal(reimportResult.new, 0);

    const finalDeptsCount = await Department.countDocuments({ organizationId: DEFAULT_ORGANIZATION_ID });
    assert.equal(finalDeptsCount, 5);

    const finalEmpCount = await Employee.countDocuments({ organizationId: DEFAULT_ORGANIZATION_ID, isDeleted: false });
    assert.equal(finalEmpCount, 200);
  } finally {
    await Department.deleteMany({ organizationId: DEFAULT_ORGANIZATION_ID });
    await Employee.deleteMany({ organizationId: DEFAULT_ORGANIZATION_ID });
    await disconnectDatabase();
    if (mongod) {
      await mongod.stop();
    }
  }
});
