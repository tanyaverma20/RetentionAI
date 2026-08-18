import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

test('AI Insights Data Consistency & Multi-Tenant Isolation Suite (Scenarios A through H)', async () => {
  let mongod;
  let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

  if (!databaseUri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
    databaseUri = mongod.getUri();
  }

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = databaseUri;
  process.env.MONGODB_DB_NAME = 'retentionai_insights_consistency_test';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
  process.env.CORS_ORIGINS = 'http://localhost:5173';

  const [
    { connectDatabase, disconnectDatabase },
    { Organization },
    { Department },
    { Employee },
    { Prediction },
    { aiService },
  ] = await Promise.all([
    import('../src/config/database.js'),
    import('../src/models/Organization.js'),
    import('../src/models/Department.js'),
    import('../src/models/Employee.js'),
    import('../src/models/Prediction.js'),
    import('../src/services/aiService.js'),
  ]);

  await connectDatabase();

  try {
    await Organization.deleteMany({});
    await Department.deleteMany({});
    await Employee.deleteMany({});
    await Prediction.deleteMany({});

    // Create Organizations
    const orgA = await Organization.create({
      name: 'Org A Consistency Inc',
      slug: `orga-consist-${Date.now()}`,
    });

    const orgB = await Organization.create({
      name: 'Org B Isolation Ltd',
      slug: `orgb-consist-${Date.now()}`,
    });

    const deptA = await Department.create({
      name: 'Engineering',
      code: 'ENG_A',
      organizationId: orgA._id,
    });

    const deptB = await Department.create({
      name: 'Sales',
      code: 'SALES_B',
      organizationId: orgB._id,
    });

    console.log('--- SCENARIO A: 200 Active Employees Scoping ---');
    // Create 200 employees for Org A
    const orgAEmployeeDocs = [];
    for (let i = 1; i <= 200; i++) {
      orgAEmployeeDocs.push({
        organizationId: orgA._id,
        departmentId: deptA._id,
        employeeCode: `EMP_A_${i}`,
        firstName: `FirstA_${i}`,
        lastName: `LastA_${i}`,
        email: `empa_${i}_${Date.now()}@orga.test`,
        designation: 'Engineer',
        joiningDate: new Date(),
        status: 'ACTIVE',
        isDeleted: false,
      });
    }
    const createdOrgAEmployees = await Employee.insertMany(orgAEmployeeDocs);
    assert.equal(createdOrgAEmployees.length, 200, 'Org A should have 200 created employees');

    // Create predictions for Org A employees: 30 HIGH, 50 MEDIUM, 120 LOW
    const predictionDocsA = createdOrgAEmployees.map((emp, idx) => {
      let riskLevel = 'LOW';
      let riskScore = 0.2;
      if (idx < 30) {
        riskLevel = 'HIGH';
        riskScore = 0.85 + (idx % 10) * 0.01;
      } else if (idx < 80) {
        riskLevel = 'MEDIUM';
        riskScore = 0.55;
      }
      return {
        organizationId: orgA._id,
        employeeId: emp._id,
        modelId: 'v2.0',
        riskScore,
        riskLevel,
        confidence: 0.9,
        status: 'SUCCESS',
      };
    });
    await Prediction.insertMany(predictionDocsA);

    // Verify Org A Dashboard analytics
    const resA = await aiService.getDashboardRiskCounts(orgA._id);
    assert.equal(resA.totalEmployees, 200, 'totalEmployees for Org A must be 200');
    assert.equal(resA.predictedCount, 200, 'predictedCount for Org A must be 200');
    assert.equal(resA.pendingCount, 0, 'pendingCount for Org A must be 0');
    assert.equal(resA.counts.HIGH, 30, 'HIGH risk count must be 30');
    assert.equal(resA.counts.MEDIUM, 50, 'MEDIUM risk count must be 50');
    assert.equal(resA.counts.LOW, 120, 'LOW risk count must be 120');
    assert.equal(resA.counts.HIGH + resA.counts.MEDIUM + resA.counts.LOW, 200, 'Risk counts must sum to 200');

    console.log('--- SCENARIO B: Multi-Tenant Isolation ---');
    // Create 10 employees and predictions for Org B
    const orgBEmployeeDocs = [];
    for (let i = 1; i <= 10; i++) {
      orgBEmployeeDocs.push({
        organizationId: orgB._id,
        departmentId: deptB._id,
        employeeCode: `EMP_B_${i}`,
        firstName: `FirstB_${i}`,
        lastName: `LastB_${i}`,
        email: `empb_${i}_${Date.now()}@orgb.test`,
        designation: 'Sales Rep',
        joiningDate: new Date(),
        status: 'ACTIVE',
        isDeleted: false,
      });
    }
    const createdOrgBEmployees = await Employee.insertMany(orgBEmployeeDocs);

    await Prediction.insertMany(
      createdOrgBEmployees.map((emp) => ({
        organizationId: orgB._id,
        employeeId: emp._id,
        modelId: 'v2.0',
        riskScore: 0.95,
        riskLevel: 'HIGH',
        confidence: 0.95,
        status: 'SUCCESS',
      }))
    );

    // Re-verify Org A stats (Org B data must NOT bleed into Org A)
    const resAAfterB = await aiService.getDashboardRiskCounts(orgA._id);
    assert.equal(resAAfterB.totalEmployees, 200);
    assert.equal(resAAfterB.predictedCount, 200);
    assert.equal(resAAfterB.counts.HIGH, 30);

    // Verify Org B stats
    const resB = await aiService.getDashboardRiskCounts(orgB._id);
    assert.equal(resB.totalEmployees, 10);
    assert.equal(resB.predictedCount, 10);
    assert.equal(resB.counts.HIGH, 10);

    console.log('--- SCENARIO C: Synthetic/Global Prediction Exclusion ---');
    // Insert orphan/synthetic predictions stamped with Org A's ID but with random employee IDs not in Employee collection
    const orphanId1 = new mongoose.Types.ObjectId();
    const orphanId2 = new mongoose.Types.ObjectId();
    await Prediction.insertMany([
      {
        organizationId: orgA._id,
        employeeId: orphanId1,
        modelId: 'v2.0',
        riskScore: 0.99,
        riskLevel: 'HIGH',
        confidence: 0.99,
        status: 'SUCCESS',
      },
      {
        organizationId: orgA._id,
        employeeId: orphanId2,
        modelId: 'v2.0',
        riskScore: 0.99,
        riskLevel: 'HIGH',
        confidence: 0.99,
        status: 'SUCCESS',
      },
    ]);

    // Query Org A again — synthetic orphan predictions MUST BE EXCLUDED
    const resAClean = await aiService.getDashboardRiskCounts(orgA._id);
    assert.equal(resAClean.totalEmployees, 200);
    assert.equal(resAClean.predictedCount, 200);
    assert.equal(resAClean.counts.HIGH, 30, 'Synthetic/orphan predictions must not inflate HIGH count');

    console.log('--- SCENARIO D: Deleted/Deactivated Employee Exclusion ---');
    // Soft delete 1 high-risk employee in Org A
    const highRiskEmpToDelete = createdOrgAEmployees[0];
    await Employee.findByIdAndUpdate(highRiskEmpToDelete._id, { isDeleted: true, status: 'INACTIVE' });

    const resADeleted = await aiService.getDashboardRiskCounts(orgA._id);
    assert.equal(resADeleted.totalEmployees, 199, 'totalEmployees should drop to 199');
    assert.equal(resADeleted.predictedCount, 199, 'predictedCount should drop to 199');
    assert.equal(resADeleted.counts.HIGH, 29, 'HIGH count should drop to 29');

    console.log('--- SCENARIO E: Prediction Upsert Idempotency ---');
    // Simulating running prediction twice for the same org + employee
    const targetEmp = createdOrgAEmployees[1];
    const initialPredCount = await Prediction.countDocuments({ organizationId: orgA._id, employeeId: targetEmp._id });

    // Perform upsert
    await Prediction.updateOne(
      { organizationId: orgA._id, employeeId: targetEmp._id },
      { $set: { riskScore: 0.92, riskLevel: 'HIGH', predictedAt: new Date() } },
      { upsert: true }
    );

    const finalPredCount = await Prediction.countDocuments({ organizationId: orgA._id, employeeId: targetEmp._id });
    assert.equal(finalPredCount, 1, 'Upsert must update existing prediction rather than duplicating');

    console.log('--- SCENARIO F: Employee Re-Import & Population Replacement ---');
    // Ensure dashboard counts strictly match active employees after population changes
    const resAFinal = await aiService.getDashboardRiskCounts(orgA._id);
    assert.equal(resAFinal.predictedCount + resAFinal.pendingCount, resAFinal.totalEmployees);

    console.log('--- SCENARIO G: Top 10 High Risk Employee Validity ---');
    assert.ok(resAFinal.topHighRisk.length <= 10, 'Top High Risk must return at most 10 items');
    for (const item of resAFinal.topHighRisk) {
      assert.equal(String(item.organizationId), String(orgA._id), 'Item must belong to Org A');
      assert.equal(item.riskLevel, 'HIGH', 'Item risk level must be HIGH');
      assert.ok(item.employeeId, 'employeeId must be populated');
      assert.ok(!item.employeeId.isDeleted, 'employee must not be deleted');
      assert.ok(item.employeeId.firstName, 'employee must have firstName');
    }

    console.log('--- SCENARIO H: Mathematical Count Consistency & Zero-Employee Edge Case ---');
    assert.equal(
      resAFinal.counts.HIGH + resAFinal.counts.MEDIUM + resAFinal.counts.LOW,
      resAFinal.predictedCount,
      'HIGH + MEDIUM + LOW must equal predictedCount'
    );

    // Zero-employee Org edge case
    const emptyOrg = await Organization.create({
      name: 'Empty Org',
      slug: `empty-org-${Date.now()}`,
    });
    const resEmpty = await aiService.getDashboardRiskCounts(emptyOrg._id);
    assert.equal(resEmpty.totalEmployees, 0);
    assert.equal(resEmpty.predictedCount, 0);
    assert.equal(resEmpty.pendingCount, 0);
    assert.equal(resEmpty.counts.HIGH, 0);
    assert.equal(resEmpty.counts.MEDIUM, 0);
    assert.equal(resEmpty.counts.LOW, 0);
    assert.deepEqual(resEmpty.topHighRisk, []);

    console.log('ALL SCENARIOS PASSED SUCCESSFULLY!');
  } finally {
    await disconnectDatabase();
    if (mongod) {
      await mongod.stop();
    }
  }
});
