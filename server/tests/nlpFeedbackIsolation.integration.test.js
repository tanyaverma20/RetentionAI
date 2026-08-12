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

const { employeeIntelligenceService } = await import('../src/services/employeeIntelligenceService.js');
const { Employee } = await import('../src/models/Employee.js');
const { EmployeeFeedback } = await import('../src/models/EmployeeFeedback.js');
const { Organization } = await import('../src/models/Organization.js');
const { Department } = await import('../src/models/Department.js');
const { AppError } = await import('../src/errors/AppError.js');

test.describe('NLP Employee Feedback Tenant Isolation & Bounds Integration Tests', () => {
  let orgAId;
  let orgBId;
  let deptAId;
  let deptBId;
  let empAId;
  let empBId;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    let orgA = await Organization.findOne({ name: 'NLP_Test_Org_A' });
    if (!orgA) {
      orgA = await Organization.create({ name: 'NLP_Test_Org_A', slug: 'nlp-test-org-a', domain: 'orga-nlp.test' });
    }
    orgAId = String(orgA._id);

    let orgB = await Organization.findOne({ name: 'NLP_Test_Org_B' });
    if (!orgB) {
      orgB = await Organization.create({ name: 'NLP_Test_Org_B', slug: 'nlp-test-org-b', domain: 'orgb-nlp.test' });
    }
    orgBId = String(orgB._id);

    let deptA = await Department.findOne({ organizationId: orgAId });
    if (!deptA) {
      deptA = await Department.create({ name: 'Engineering A', code: 'ENGA', organizationId: orgAId });
    }
    deptAId = String(deptA._id);

    let deptB = await Department.findOne({ organizationId: orgBId });
    if (!deptB) {
      deptB = await Department.create({ name: 'Engineering B', code: 'ENGB', organizationId: orgBId });
    }
    deptBId = String(deptB._id);

    let empA = await Employee.findOne({ employeeCode: 'EMP-NLP-A1' });
    if (!empA) {
      empA = await Employee.create({
        organizationId: orgAId,
        departmentId: deptAId,
        employeeCode: 'EMP-NLP-A1',
        firstName: 'Alice',
        lastName: 'Tester',
        email: 'alice.nlp@orga.test',
        designation: 'Software Engineer',
        joiningDate: new Date(),
      });
    }
    empAId = String(empA._id);

    let empB = await Employee.findOne({ employeeCode: 'EMP-NLP-B1' });
    if (!empB) {
      empB = await Employee.create({
        organizationId: orgBId,
        departmentId: deptBId,
        employeeCode: 'EMP-NLP-B1',
        firstName: 'Bob',
        lastName: 'Tester',
        email: 'bob.nlp@orgb.test',
        designation: 'Product Manager',
        joiningDate: new Date(),
      });
    }
    empBId = String(empB._id);
  });

  test.after(async () => {
    await EmployeeFeedback.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await Employee.deleteMany({ _id: { $in: [empAId, empBId] } });
    await Department.deleteMany({ _id: { $in: [deptAId, deptBId] } });
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  test('1. Create feedback under Org A and verify tenant scoping & sentiment score bounds [0.0, 1.0]', async () => {
    const feedbackText = 'I really enjoy working with my team, but the workload has been quite high recently.';
    const created = await employeeIntelligenceService.createFeedback(orgAId, empAId, {
      feedbackText,
      category: 'WORK_ENVIRONMENT',
      source: 'FEEDBACK',
    });

    assert.equal(String(created.organizationId), orgAId);
    assert.equal(String(created.employeeId), empAId);
    assert.equal(created.feedbackText, feedbackText);

    if (created.sentimentScore !== undefined) {
      assert.ok(created.sentimentScore >= 0.0 && created.sentimentScore <= 1.0, `sentimentScore ${created.sentimentScore} must be within [0.0, 1.0]`);
    }
  });

  test('2. Attempt to read Org A employee feedback using Org B context -> must fail with 404', async () => {
    await assert.rejects(
      async () => {
        await employeeIntelligenceService.getEmployeeFeedback(orgBId, empAId);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'EMPLOYEE_NOT_FOUND');
        return true;
      }
    );
  });

  test('3. Attempt to fetch sentiment timeline for Org A employee using Org B context -> must fail with 404', async () => {
    await assert.rejects(
      async () => {
        await employeeIntelligenceService.getSentimentTimeline(empAId, orgBId);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, 'EMPLOYEE_NOT_FOUND');
        return true;
      }
    );
  });

  test('4. Submitting empty feedback text -> must fail with 400 validation error', async () => {
    await assert.rejects(
      async () => {
        await employeeIntelligenceService.createFeedback(orgAId, empAId, {
          feedbackText: '   ',
          category: 'WORK_ENVIRONMENT',
        });
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'VALIDATION_ERROR');
        return true;
      }
    );
  });

  test('5. Attempting to analyze cross-tenant feedback item -> must fail with 404', async () => {
    const created = await employeeIntelligenceService.createFeedback(orgAId, empAId, {
      feedbackText: 'Great project momentum and strong team support.',
      category: 'WORK_ENVIRONMENT',
    });

    await assert.rejects(
      async () => {
        await employeeIntelligenceService.analyzeFeedback(orgBId, empAId, created._id);
      },
      (err) => {
        assert.ok(err instanceof AppError);
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });
});
