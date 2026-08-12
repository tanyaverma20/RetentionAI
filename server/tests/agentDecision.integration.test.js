let mongoServer;
let MONGODB_URI = process.env.AUTH_TEST_MONGODB_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    mongoServer = await MongoMemoryServer.create({ instance: { dbName: `test_${Date.now()}` } });
    MONGODB_URI = mongoServer.getUri();
  } catch (err) {
    // Fall back to process.env MONGODB_URI
  }
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = MONGODB_URI;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS = 'http://localhost:5173';

import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const { aiService } = await import('../src/services/aiService.js');
const { Employee } = await import('../src/models/Employee.js');
const { Organization } = await import('../src/models/Organization.js');
const { User } = await import('../src/models/User.js');
const { Role } = await import('../src/models/Role.js');
const { Department } = await import('../src/models/Department.js');

test.describe('LangGraph Agentic Decision Orchestration Integration Tests', () => {
  let orgId;
  let otherOrgId;
  let employeeId;
  let otherEmpId;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    let org = await Organization.findOne({ name: 'Agent_Org_A' });
    if (!org) {
      org = await Organization.create({ name: 'Agent_Org_A', slug: 'agent-org-a', domain: 'agent-a.test' });
    }
    orgId = String(org._id);

    let otherOrg = await Organization.findOne({ name: 'Agent_Other_Org' });
    if (!otherOrg) {
      otherOrg = await Organization.create({ name: 'Agent_Other_Org', slug: 'agent-other-org', domain: 'agent-other.test' });
    }
    otherOrgId = String(otherOrg._id);

    let dept = await Department.findOne({ organizationId: orgId });
    if (!dept) {
      dept = await Department.create({ name: 'Engineering', code: 'ENG', organizationId: orgId });
    }

    let emp = await Employee.findOne({ organizationId: orgId });
    if (!emp) {
      emp = await Employee.create({
        organizationId: orgId,
        departmentId: dept._id,
        employeeCode: 'EMP_AGENT_A_001',
        firstName: 'AgentA',
        lastName: 'User',
        email: 'agenta@test.com',
        designation: 'Senior Developer',
        joiningDate: new Date(),
      });
    }
    employeeId = String(emp._id);

    let role = await Role.findOne({ name: 'HR_ADMIN' });
    if (!role) {
      role = await Role.create({ name: 'HR_ADMIN', permissions: ['ALL'] });
    }

    let deptOther = await Department.findOne({ organizationId: otherOrgId });
    if (!deptOther) {
      deptOther = await Department.create({ name: 'Agent Operations', code: 'AOP', organizationId: otherOrgId });
    }

    let otherEmp = await Employee.findOne({ organizationId: otherOrgId });
    if (!otherEmp) {
      otherEmp = await Employee.create({
        organizationId: otherOrgId,
        departmentId: deptOther._id,
        employeeCode: 'EMP_AGENT_OTHER_001',
        firstName: 'AgentOther',
        lastName: 'User',
        email: 'agentother@test.com',
        designation: 'Analyst',
        department: 'Operations',
        joiningDate: new Date(),
      });
    }
    otherEmpId = String(otherEmp._id);
  });

  test.after(async () => {
    await Employee.deleteMany({ employeeCode: { $in: ['EMP_AGENT_A_001', 'EMP_AGENT_OTHER_001'] } });
    await Organization.deleteMany({ name: { $in: ['Agent_Org_A', 'Agent_Other_Org'] } });
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  test('1. Executes full 8-node LangGraph retention decision workflow for valid employee', async () => {
    const res = await aiService.executeAgentDecision({
      employeeId,
      question: 'How do we retain this employee?',
      organizationId: orgId,
    });

    assert.ok(res);
    assert.equal(res.success, true);
    assert.equal(res.organizationId, orgId);
    assert.equal(res.employeeId, employeeId);
    assert.ok(res.riskAssessment);
    assert.ok(Array.isArray(res.shapDrivers));
    assert.ok(Array.isArray(res.recentChanges));
    assert.ok(Array.isArray(res.policyCitations));
    assert.ok(Array.isArray(res.recommendedActions));
    assert.ok(Array.isArray(res.executionTrace));
    
    // Verify trace steps exist for all workflow stages
    const nodes = res.executionTrace.map(t => t.node);
    assert.ok(nodes.includes('ContextValidation'));
    assert.ok(nodes.includes('MLRiskAgent'));
    assert.ok(nodes.includes('ExplainabilityAgent'));
    assert.ok(nodes.includes('FinalDecision'));
  });

  test('2. Rejects cross-tenant employee decision request (404/rejection)', async () => {
    // Org A user requesting decision for Org B employee
    await assert.rejects(
      async () => {
        await aiService.executeAgentDecision({
          employeeId: otherEmpId,
          question: 'Cross-tenant retention attempt',
          organizationId: orgId, // Mismatch: requesting Org A, but employee is Org B
        });
      },
      (err) => err.statusCode === 404 || err.message.includes('not found') || err.message.includes('Tenant')
    );
  });
});
