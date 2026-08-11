import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { aiService } from '../src/services/aiService.js';
import { Employee } from '../src/models/Employee.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';

import { Department } from '../src/models/Department.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://tanyaverma202003_db_user:LMw7XVa3o334EPTE@cluster0.mmbebq2.mongodb.net/retentionai?retryWrites=true&w=majority&appName=Cluster0';

test.describe('LangGraph Agentic Decision Orchestration Integration Tests', () => {
  let orgId;
  let otherOrgId;
  let employeeId;
  let otherEmpId;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    let org = await Organization.findOne({ slug: 'demo-org' });
    if (!org) {
      org = await Organization.findOne({});
    }
    orgId = String(org._id);

    let otherOrg = await Organization.findOne({ name: 'Agent_Other_Org' });
    if (!otherOrg) {
      otherOrg = await Organization.create({ name: 'Agent_Other_Org', slug: 'agent-other-org', domain: 'agent-other.test' });
    }
    otherOrgId = String(otherOrg._id);

    const emp = await Employee.findOne({ organizationId: orgId });
    assert.ok(emp, 'Existing employee required for test');
    employeeId = String(emp._id);

    let role = await Role.findOne({ name: 'HR_ADMIN' });
    if (!role) {
      role = await Role.create({ name: 'HR_ADMIN', permissions: ['ALL'] });
    }

    let dept = await Department.findOne({ organizationId: otherOrgId });
    if (!dept) {
      dept = await Department.create({ name: 'Agent Operations', code: 'AOP', organizationId: otherOrgId });
    }

    let otherEmp = await Employee.findOne({ organizationId: otherOrgId });
    if (!otherEmp) {
      otherEmp = await Employee.create({
        organizationId: otherOrgId,
        departmentId: dept._id,
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
    await Employee.deleteMany({ employeeCode: 'EMP_AGENT_OTHER_001' });
    await Organization.deleteMany({ name: 'Agent_Other_Org' });
    await mongoose.disconnect();
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
