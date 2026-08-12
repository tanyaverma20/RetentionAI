import { MongoMemoryServer } from 'mongodb-memory-server';

const mongoServer = await MongoMemoryServer.create();
const MONGODB_URI = mongoServer.getUri();
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = MONGODB_URI;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS = 'http://localhost:5173';

import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const { interventionService } = await import('../src/services/interventionService.js');
const { Intervention } = await import('../src/models/Intervention.js');
const { Decision } = await import('../src/models/Decision.js');
const { Employee } = await import('../src/models/Employee.js');
const { Organization } = await import('../src/models/Organization.js');
const { User } = await import('../src/models/User.js');
const { AppError } = await import('../src/errors/AppError.js');
const { Department } = await import('../src/models/Department.js');
const { Role } = await import('../src/models/Role.js');

test.describe('Prompt 7 — Actionable Interventions, Workflow Automation & Safeguards Tests', () => {
  let orgAId;
  let orgBId;
  let deptAId;
  let deptBId;
  let empAId;
  let empBId;
  let userCreatorId;
  let userApproverId;
  let decisionAId;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    let orgA = await Organization.findOne({ name: 'Intervention_Test_Org_A' });
    if (!orgA) {
      orgA = await Organization.create({ name: 'Intervention_Test_Org_A', slug: 'interv-org-a', domain: 'interva.test' });
    }
    orgAId = String(orgA._id);

    let orgB = await Organization.findOne({ name: 'Intervention_Test_Org_B' });
    if (!orgB) {
      orgB = await Organization.create({ name: 'Intervention_Test_Org_B', slug: 'interv-org-b', domain: 'intervb.test' });
    }
    orgBId = String(orgB._id);

    let deptA = await Department.findOne({ organizationId: orgAId });
    if (!deptA) {
      deptA = await Department.create({ name: 'Engineering A', code: 'INT-ENGA', organizationId: orgAId });
    }
    deptAId = String(deptA._id);

    let deptB = await Department.findOne({ organizationId: orgBId });
    if (!deptB) {
      deptB = await Department.create({ name: 'Engineering B', code: 'INT-ENGB', organizationId: orgBId });
    }
    deptBId = String(deptB._id);

    let hrRole = await Role.findOne({ name: 'HR_ADMIN' });
    if (!hrRole) {
      hrRole = await Role.create({ name: 'HR_ADMIN', permissions: ['ALL'] });
    }
    const roleId = String(hrRole._id);

    let userCreator = await User.findOne({ email: 'creator@interva.test' });
    if (!userCreator) {
      userCreator = await User.create({
        name: 'Creator HR User',
        email: 'creator@interva.test',
        passwordHash: 'dummyhash',
        role: 'HR_MANAGER',
        roleId,
        organizationId: orgAId,
      });
    }
    userCreatorId = String(userCreator._id);

    let userApprover = await User.findOne({ email: 'approver@interva.test' });
    if (!userApprover) {
      userApprover = await User.create({
        name: 'Approver HR Admin',
        email: 'approver@interva.test',
        passwordHash: 'dummyhash',
        role: 'HR_ADMIN',
        roleId,
        organizationId: orgAId,
      });
    }
    userApproverId = String(userApprover._id);

    let empA = await Employee.findOne({ employeeCode: 'EMP-INT-A1' });
    if (!empA) {
      empA = await Employee.create({
        organizationId: orgAId,
        departmentId: deptAId,
        employeeCode: 'EMP-INT-A1',
        firstName: 'Charlie',
        lastName: 'Intervention',
        email: 'charlie.int@interva.test',
        designation: 'Senior Developer',
        joiningDate: new Date(),
      });
    }
    empAId = String(empA._id);

    let empB = await Employee.findOne({ employeeCode: 'EMP-INT-B1' });
    if (!empB) {
      empB = await Employee.create({
        organizationId: orgBId,
        departmentId: deptBId,
        employeeCode: 'EMP-INT-B1',
        firstName: 'Diana',
        lastName: 'Intervention',
        email: 'diana.int@intervb.test',
        designation: 'Staff Engineer',
        joiningDate: new Date(),
      });
    }
    empBId = String(empB._id);

    let decisionA = await Decision.create({
      organizationId: orgAId,
      employeeId: empAId,
      recommendationType: 'WORKLOAD_ADJUSTMENT',
      priority: 'HIGH',
      confidence: 0.85,
      reasoning: 'High overtime hours and burnout indicators detected.',
      affectedFactors: ['OverTime'],
      relatedPolicies: ['Workload & Overtime Policy'],
      recommendedActions: [
        {
          category: 'WORKLOAD_ADJUSTMENT',
          description: 'Rebalance team sprint allocation to eliminate excessive overtime.',
          priority: 'HIGH',
          policyReference: 'Workload Policy Sec 4',
          expectedImpact: 'Burnout risk reduced by 50%.',
        },
      ],
      status: 'PENDING',
      generatedAt: new Date(),
      generatedBy: 'system',
    });
    decisionAId = String(decisionA._id);
  });

  test.after(async () => {
    await Intervention.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await Decision.deleteMany({ _id: decisionAId });
    await Employee.deleteMany({ _id: { $in: [empAId, empBId] } });
    await Department.deleteMany({ _id: { $in: [deptAId, deptBId] } });
    await User.deleteMany({ _id: { $in: [userCreatorId, userApproverId] } });
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
    await mongoose.disconnect();
  });

  test('1. Human-in-the-Loop & Decision Conversion: Creates PROPOSED intervention with AI Evidence Snapshot', async () => {
    const decision = await Decision.findById(decisionAId).lean();
    const intervention = await interventionService.createFromDecision(orgAId, decision, userCreatorId);

    assert.ok(intervention._id);
    assert.equal(String(intervention.organizationId), orgAId);
    assert.equal(String(intervention.employeeId), empAId);
    assert.equal(intervention.status, 'PROPOSED');
    assert.equal(intervention.priority, 'HIGH');
    assert.equal(intervention.baselineRisk, 0.85);

    // AI Evidence Snapshot Verification
    assert.ok(intervention.aiEvidenceSnapshot);
    assert.equal(intervention.aiEvidenceSnapshot.riskScore, 0.85);
    assert.equal(intervention.aiEvidenceSnapshot.recommendedActionId, 'DEFAULT_ACTION');
    assert.equal(intervention.aiEvidenceSnapshot.shapDrivers.length, 1);
    assert.equal(intervention.aiEvidenceSnapshot.policyCitations.length, 1);
  });

  test('2. Tenant-Scoped Idempotency: Repeated conversion returns existing intervention without duplicate records', async () => {
    const decision = await Decision.findById(decisionAId).lean();
    const countBefore = await Intervention.countDocuments({ organizationId: orgAId, employeeId: empAId });

    const intervention1 = await interventionService.createFromDecision(orgAId, decision, userCreatorId);
    const intervention2 = await interventionService.createFromDecision(orgAId, decision, userCreatorId);

    const countAfter = await Intervention.countDocuments({ organizationId: orgAId, employeeId: empAId });

    assert.equal(String(intervention1._id), String(intervention2._id));
    assert.equal(countBefore, countAfter);
  });

  test('3. Tenant Isolation & IDOR Protection: Cross-tenant access fails with 404', async () => {
    const decision = await Decision.findById(decisionAId).lean();
    const intervention = await interventionService.createFromDecision(orgAId, decision, userCreatorId);

    // Read attempt across tenant -> 404
    await assert.rejects(
      async () => {
        await interventionService.getById(intervention._id, orgBId);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'INTERVENTION_NOT_FOUND');
        return true;
      }
    );

    // Transition attempt across tenant -> 404
    await assert.rejects(
      async () => {
        await interventionService.transition(intervention._id, orgBId, 'APPROVED', userApproverId);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'INTERVENTION_NOT_FOUND');
        return true;
      }
    );

    // Decision conversion attempt across tenant -> 404
    await assert.rejects(
      async () => {
        await interventionService.createFromDecision(orgBId, decision, userCreatorId);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  test('4. Separation of Duties: Creator approving own intervention -> 403 Forbidden', async () => {
    const decision = await Decision.findById(decisionAId).lean();
    const intervention = await interventionService.createFromDecision(orgAId, decision, userCreatorId);

    await assert.rejects(
      async () => {
        await interventionService.transition(intervention._id, orgAId, 'APPROVED', userCreatorId);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 403);
        assert.equal(err.code, 'SELF_APPROVAL_FORBIDDEN');
        return true;
      }
    );
  });

  test('5. Strict State Machine & Lifecycle Flow: PROPOSED -> APPROVED -> IN_PROGRESS -> COMPLETED', async () => {
    const decision = await Decision.findById(decisionAId).lean();
    const intervention = await interventionService.createFromDecision(orgAId, decision, userCreatorId);

    // 1. PROPOSED -> APPROVED by separate approver
    const approved = await interventionService.transition(intervention._id, orgAId, 'APPROVED', userApproverId, { note: 'Approved budget' });
    assert.equal(approved.status, 'APPROVED');

    // 2. APPROVED -> IN_PROGRESS
    const started = await interventionService.transition(intervention._id, orgAId, 'IN_PROGRESS', userCreatorId, { note: 'Sprint rebalance started' });
    assert.equal(started.status, 'IN_PROGRESS');

    // 3. IN_PROGRESS -> COMPLETED with outcomes
    const completed = await interventionService.transition(intervention._id, orgAId, 'COMPLETED', userCreatorId, {
      note: 'Workload rebalanced',
      currentRisk: 0.25,
      actualCost: 400,
      employeeRetained: true,
      outcomeNotes: 'Employee satisfied with new workload distribution.',
    });

    assert.equal(completed.status, 'COMPLETED');
    assert.ok(completed.completedAt);
    assert.equal(completed.currentRisk, 0.25);
    assert.equal(completed.riskDelta, 0.60); // 0.85 - 0.25
    assert.equal(completed.actualCost, 400);
    assert.equal(completed.employeeRetained, true);
    assert.equal(completed.slaStatus, 'COMPLETED');
  });

  test('6. Invalid State Transitions -> 400 Bad Request', async () => {
    const decision = await Decision.findById(decisionAId).lean();
    const intervention = await interventionService.createFromDecision(orgAId, decision, userCreatorId);

    // Direct jump PROPOSED -> COMPLETED must fail with 400
    await assert.rejects(
      async () => {
        await interventionService.transition(intervention._id, orgAId, 'COMPLETED', userApproverId);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'INVALID_TRANSITION');
        return true;
      }
    );
  });

  test('7. Overdue SLA calculation engine', async () => {
    const overdueIntervention = await Intervention.create({
      organizationId: orgAId,
      employeeId: empAId,
      title: 'Overdue Task',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      targetSlaDays: 7,
      dueDate: new Date(Date.now() - 3600 * 1000 * 48), // 2 days ago
      createdByUserId: userCreatorId,
    });

    const list = await interventionService.listOverdue(orgAId);
    assert.ok(list.length >= 1);
    const found = list.find((item) => String(item._id) === String(overdueIntervention._id));
    assert.ok(found);
  });
});
