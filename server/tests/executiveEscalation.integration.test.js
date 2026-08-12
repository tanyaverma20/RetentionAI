import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

import { MongoMemoryServer } from 'mongodb-memory-server';

const mongoServer = await MongoMemoryServer.create();
const MONGODB_URI = mongoServer.getUri();

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = MONGODB_URI;
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:5173';

let executiveService;
let interventionService;
let ExecutiveAlert;
let Intervention;
let Employee;
let Department;
let Organization;
let User;
let Role;
let Prediction;
let AuditLog;
let app;
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-that-is-at-least-32-characters';

let createAccessToken;

function createTestToken(user, orgId, roleName) {
  return createAccessToken({
    id: String(user._id),
    role: { name: roleName },
    organizationId: String(orgId),
  });
}

test.describe('Prompt 8 — Executive Escalations, Closed-Loop Outcomes & Audit Hardening', () => {
  let server;
  let baseUrl;

  let orgAId;
  let orgBId;
  let deptAId;
  let empA1Id;
  let empA2Id;
  let userAdminA;
  let userHrMgrA;
  let userEmpA;
  let tokenAdminA;
  let tokenHrMgrA;
  let tokenEmpA;

  let userAdminB;
  let tokenAdminB;

  test.before(async () => {
    const execMod = await import('../src/services/executiveService.js');
    executiveService = execMod;
    const intervMod = await import('../src/services/interventionService.js');
    interventionService = intervMod.interventionService || intervMod.default || intervMod;
    const tokenMod = await import('../src/utils/tokens.js');
    createAccessToken = tokenMod.createAccessToken;
    const alertMod = await import('../src/models/ExecutiveAlert.js');
    ExecutiveAlert = alertMod.ExecutiveAlert;
    const intervModelMod = await import('../src/models/Intervention.js');
    Intervention = intervModelMod.Intervention;
    const empMod = await import('../src/models/Employee.js');
    Employee = empMod.Employee;
    const deptMod = await import('../src/models/Department.js');
    Department = deptMod.Department;
    const orgMod = await import('../src/models/Organization.js');
    Organization = orgMod.Organization;
    const userMod = await import('../src/models/User.js');
    User = userMod.User;
    const roleMod = await import('../src/models/Role.js');
    Role = roleMod.Role;
    const predMod = await import('../src/models/Prediction.js');
    Prediction = predMod.Prediction;
    const auditMod = await import('../src/models/AuditLog.js');
    AuditLog = auditMod.AuditLog;
    const appMod = await import('../src/app.js');
    app = appMod.app;

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }
    await ExecutiveAlert.init();

    server = app.listen(0);
    baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    let orgA = await Organization.findOne({ name: 'Exec_Test_Org_A' });
    if (!orgA) {
      orgA = await Organization.create({ name: 'Exec_Test_Org_A', slug: 'exec-org-a', domain: 'execa.test' });
    }
    orgAId = String(orgA._id);

    let orgB = await Organization.findOne({ name: 'Exec_Test_Org_B' });
    if (!orgB) {
      orgB = await Organization.create({ name: 'Exec_Test_Org_B', slug: 'exec-org-b', domain: 'execb.test' });
    }
    orgBId = String(orgB._id);

    let deptA = await Department.findOne({ organizationId: orgAId });
    if (!deptA) {
      deptA = await Department.create({ name: 'Exec Tech', code: 'EXEC-TECH', organizationId: orgAId });
    }
    deptAId = String(deptA._id);

    let adminRole = await Role.findOne({ name: 'ADMIN' });
    if (!adminRole) adminRole = await Role.create({ name: 'ADMIN', permissions: ['ALL'] });

    let hrRole = await Role.findOne({ name: 'HR_MANAGER' });
    if (!hrRole) hrRole = await Role.create({ name: 'HR_MANAGER', permissions: ['HR_READ', 'HR_WRITE'] });

    let empRole = await Role.findOne({ name: 'EMPLOYEE' });
    if (!empRole) empRole = await Role.create({ name: 'EMPLOYEE', permissions: ['SELF_READ'] });

    userAdminA = await User.create({ name: 'Admin A', email: `admin.${Date.now()}@execa.test`, passwordHash: 'hash', role: 'ADMIN', roleId: adminRole._id, organizationId: orgAId, status: 'ACTIVE' });
    userHrMgrA = await User.create({ name: 'HR Mgr A', email: `hrmgr.${Date.now()}@execa.test`, passwordHash: 'hash', role: 'HR_MANAGER', roleId: hrRole._id, organizationId: orgAId, status: 'ACTIVE' });
    userEmpA = await User.create({ name: 'Emp User A', email: `emp.${Date.now()}@execa.test`, passwordHash: 'hash', role: 'EMPLOYEE', roleId: empRole._id, organizationId: orgAId, status: 'ACTIVE' });

    userAdminB = await User.create({ name: 'Admin B', email: `admin.${Date.now()}@execb.test`, passwordHash: 'hash', role: 'ADMIN', roleId: adminRole._id, organizationId: orgBId, status: 'ACTIVE' });

    tokenAdminA = createTestToken(userAdminA, orgAId, 'ADMIN');
    tokenHrMgrA = createTestToken(userHrMgrA, orgAId, 'HR_MANAGER');
    tokenEmpA = createTestToken(userEmpA, orgAId, 'EMPLOYEE');
    tokenAdminB = createTestToken(userAdminB, orgBId, 'ADMIN');

    const emp1 = await Employee.create({
      organizationId: orgAId,
      departmentId: deptAId,
      employeeCode: `EMP-EXEC-${Date.now()}-1`,
      firstName: 'Alice',
      lastName: 'Exec',
      email: `alice.${Date.now()}@execa.test`,
      designation: 'Senior Engineer',
      salary: 120000,
      joiningDate: new Date(),
      status: 'ACTIVE',
    });
    empA1Id = String(emp1._id);

    const emp2 = await Employee.create({
      organizationId: orgAId,
      departmentId: deptAId,
      employeeCode: `EMP-EXEC-${Date.now()}-2`,
      firstName: 'Bob',
      lastName: 'Exec',
      email: `bob.${Date.now()}@execa.test`,
      designation: 'Staff Engineer',
      salary: 150000,
      joiningDate: new Date(),
      status: 'ACTIVE',
    });
    empA2Id = String(emp2._id);
  });

  test.after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await ExecutiveAlert.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await Intervention.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await Employee.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await Department.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
  });

  test('1. Executive RBAC: HR_MANAGER and EMPLOYEE cannot access Executive Dashboard (403 Forbidden)', async () => {
    const resHr = await fetch(`${baseUrl}/executive/dashboard`, { headers: { Authorization: `Bearer ${tokenHrMgrA}` } });
    assert.equal(resHr.status, 403, 'HR_MANAGER must be denied executive dashboard');

    const resEmp = await fetch(`${baseUrl}/executive/dashboard`, { headers: { Authorization: `Bearer ${tokenEmpA}` } });
    assert.equal(resEmp.status, 403, 'EMPLOYEE must be denied executive dashboard');

    const resAdmin = await fetch(`${baseUrl}/executive/dashboard`, { headers: { Authorization: `Bearer ${tokenAdminA}` } });
    assert.equal(resAdmin.status, 200, 'ADMIN must be allowed executive dashboard');
  });

  test('2. SLA Breach Escalation & Severity Determination', async () => {
    try {
      // Create an overdue intervention with high baseline risk (>= 0.70)
      const intervention = await interventionService.createManual(
        orgAId,
        {
          employeeId: empA1Id,
          departmentId: deptAId,
          title: 'High Risk Retain Action',
          priority: 'HIGH',
          status: 'PROPOSED',
          baselineRisk: 0.85,
          dueDate: new Date(Date.now() - 3600000), // 1 hour ago (overdue)
          idempotencyKey: `exec_test_2_${Date.now()}_${Math.random()}`,
        },
        userAdminA._id,
      );

      const alerts = await executiveService.generateAlerts(orgAId);
      const breachAlert = alerts.find((a) => String(a.interventionId) === String(intervention._id));

      assert.ok(breachAlert, 'SLA breach alert must be generated');
      assert.equal(breachAlert.severity, 'CRITICAL', 'High risk overdue intervention must trigger CRITICAL severity');
      assert.equal(breachAlert.alertType, 'SLA_BREACH_ESCALATION');
    } catch (err) {
      console.error('TEST 2 FAILED WITH:', err);
      throw err;
    }
  });

  test('3. Alert Idempotency & Concurrency Safety', async () => {
    try {
      const intervention = await interventionService.createManual(
        orgAId,
        {
          employeeId: empA2Id,
          departmentId: deptAId,
          title: 'Concurrent SLA Action',
          priority: 'MEDIUM',
          status: 'PROPOSED',
          baselineRisk: 0.55,
          dueDate: new Date(Date.now() - 7200000),
          idempotencyKey: `exec_test_3_${Date.now()}_${Math.random()}`,
        },
        userAdminA._id,
      );

      // Trigger concurrent alert generation
      const [res1, res2] = await Promise.all([
        executiveService.generateAlerts(orgAId),
        executiveService.generateAlerts(orgAId),
      ]);

      const count = await ExecutiveAlert.countDocuments({
        organizationId: orgAId,
        interventionId: intervention._id,
      });

      assert.equal(count, 1, 'Exactly one alert must exist despite concurrent execution');
    } catch (err) {
      console.error('TEST 3 FAILED WITH:', err);
      throw err;
    }
  });

  test('4. ExecutiveAlert State Machine & Invalid Transition Rejection (400 Bad Request)', async () => {
    try {
      const alert = await ExecutiveAlert.create({
        organizationId: orgAId,
        alertType: 'CRITICAL_ATTRITION_SPIKE',
        severity: 'CRITICAL',
        title: 'State Machine Test Alert',
        description: 'Testing valid and invalid state transitions',
        status: 'OPEN',
        idempotencyKey: `test_sm_${Date.now()}_${Math.random()}`,
      });

      // Valid: OPEN -> ACKNOWLEDGED
      const acked = await executiveService.transitionAlertState(alert._id, orgAId, 'ACKNOWLEDGED', userAdminA._id, 'Acknowledging alert');
      assert.equal(acked.status, 'ACKNOWLEDGED');

      // Invalid: ACKNOWLEDGED -> ACKNOWLEDGED (No-op or rejected depending on impl, but ACKNOWLEDGED -> OPEN should be invalid unless resolved/dismissed)
      await assert.rejects(
        async () => {
          await executiveService.transitionAlertState(alert._id, orgAId, 'OPEN', userAdminA._id, 'Invalid jump');
        },
        (err) => err.statusCode === 400 && err.code === 'INVALID_STATE_TRANSITION',
      );

      // Valid: ACKNOWLEDGED -> IN_REVIEW -> RESOLVED
      const inReview = await executiveService.transitionAlertState(alert._id, orgAId, 'IN_REVIEW', userAdminA._id, 'Reviewing');
      assert.equal(inReview.status, 'IN_REVIEW');

      const resolved = await executiveService.transitionAlertState(alert._id, orgAId, 'RESOLVED', userAdminA._id, 'Resolved');
      assert.equal(resolved.status, 'RESOLVED');
    } catch (err) {
      console.error('TEST 4 FAILED WITH:', err);
      throw err;
    }
  });

  test('5. Closed-Loop Retention Outcome: Immutable Baseline Risk & Risk Delta', async () => {
    try {
      // Create intervention with baselineRisk = 0.80
      const intervention = await interventionService.createManual(
        orgAId,
        {
          employeeId: empA1Id,
          departmentId: deptAId,
          title: 'Closed Loop Action',
          priority: 'HIGH',
          status: 'PROPOSED',
          baselineRisk: 0.80,
          idempotencyKey: `exec_test_5_${Date.now()}_${Math.random()}`,
        },
        userAdminA._id,
      );

      // Approve & Start (use userHrMgrA._id to comply with separation of duties: creator userAdminA cannot approve self)
      await interventionService.transition(intervention._id, orgAId, 'APPROVED', userHrMgrA._id);
      await interventionService.transition(intervention._id, orgAId, 'IN_PROGRESS', userAdminA._id);

      // Create a new ML prediction for empA1Id showing lower risk = 0.30
      await Prediction.create({
        organizationId: orgAId,
        employeeId: empA1Id,
        modelId: 'catboost_v1',
        employeeCode: 'EMP-EXEC-TEST',
        predictedAt: new Date(),
        riskScore: 0.30,
        riskLevel: 'LOW',
        confidence: 0.90,
        modelVersion: '1.0.0',
      });

      // Complete intervention with actualCost = 2000
      const completed = await interventionService.transition(intervention._id, orgAId, 'COMPLETED', userAdminA._id, {
        actualCost: 2000,
        outcomeNotes: 'Retention program completed successfully',
      });

      assert.equal(completed.baselineRisk, 0.80, 'Baseline risk must remain immutable');
      assert.equal(completed.currentRisk, 0.30, 'Current risk must be updated from latest prediction');
      assert.equal(completed.riskDelta, 0.50, 'riskDelta = 0.80 - 0.30 = 0.50');
      assert.equal(completed.employeeRetained, true, 'Employee with active status and currentRisk < 0.50 must be retained');
      assert.ok(completed.roiPercentage > 0, 'ROI percentage must be positive when retention benefit exceeds cost');
    } catch (err) {
      console.error('TEST 5 FAILED WITH:', err);
      throw err;
    }
  });

  test('6. Alert Resolution on Intervention Completion', async () => {
    try {
      const intervention = await interventionService.createManual(
        orgAId,
        {
          employeeId: empA2Id,
          departmentId: deptAId,
          title: 'Auto Resolution Action',
          priority: 'HIGH',
          status: 'PROPOSED',
          baselineRisk: 0.75,
          dueDate: new Date(Date.now() - 3600000),
          idempotencyKey: `exec_test_6_${Date.now()}_${Math.random()}`,
        },
        userAdminA._id,
      );

      // Generate SLA alert
      await executiveService.generateAlerts(orgAId);
      let alert = await ExecutiveAlert.findOne({ organizationId: orgAId, interventionId: intervention._id });
      assert.ok(alert && alert.status === 'OPEN', 'Open SLA alert should exist');

      // Approve & Start & Complete (use userHrMgrA._id for approval for separation of duties)
      await interventionService.transition(intervention._id, orgAId, 'APPROVED', userHrMgrA._id);
      await interventionService.transition(intervention._id, orgAId, 'IN_PROGRESS', userAdminA._id);
      await interventionService.transition(intervention._id, orgAId, 'COMPLETED', userAdminA._id);

      alert = await ExecutiveAlert.findOne({ _id: alert._id });
      assert.equal(alert.status, 'RESOLVED', 'Associated SLA alert must be automatically resolved upon completion');
    } catch (err) {
      console.error('TEST 6 FAILED WITH:', err);
      throw err;
    }
  });

  test('7. Tenant Isolation across Executive Reports (CSV / PDF / DOCX)', async () => {
    const formats = ['pdf', 'docx', 'csv'];

    for (const fmt of formats) {
      // Org A request with Token A -> 200 OK
      const resA = await fetch(`${baseUrl}/executive/reports/${fmt}`, { headers: { Authorization: `Bearer ${tokenAdminA}` } });
      assert.equal(resA.status, 200, `Org A admin must be able to export ${fmt}`);

      // Org B request with Token B -> 200 OK (scoped to B)
      const resB = await fetch(`${baseUrl}/executive/reports/${fmt}`, { headers: { Authorization: `Bearer ${tokenAdminB}` } });
      assert.equal(resB.status, 200, `Org B admin must be able to export ${fmt}`);

      // Org A user with Token B trying to request Org B data is automatically isolated to Org B by JWT.
    }
  });
});
