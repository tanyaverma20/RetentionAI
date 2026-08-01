import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Employee } from '../src/models/Employee.js';
import { createAccessToken } from '../src/utils/tokens.js';

let mongoServer;
let adminToken;
let employeeId;
let orgId;

describe('HR Analytics Integration Tests', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const role = await Role.create({
      name: 'ADMIN',
      description: 'System Administrator',
      permissions: ['*'],
    });

    const admin = await User.create({
      name: 'HR Admin',
      email: 'admin@hr.test',
      passwordHash: 'hashed',
      roleId: role._id,
      status: 'ACTIVE',
    });

    orgId = new mongoose.Types.ObjectId();
    adminToken = createAccessToken({ id: admin._id.toString(), role: { name: role.name }, organizationId: orgId });

    const emp = await Employee.create({
      organizationId: orgId,
      employeeCode: 'EMP-HR-01',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@hr.test',
      departmentId: new mongoose.Types.ObjectId(),
      designation: 'Engineer',
      joiningDate: new Date(),
    });
    employeeId = emp._id;
  });

  after(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it('should create an attendance record', async () => {
    const res = await request(app)
      .post('/api/v1/hr/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId.toString())
      .send({
        employeeId: employeeId.toString(),
        attendanceDate: new Date().toISOString(),
        attendanceStatus: 'PRESENT',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.attendanceStatus, 'PRESENT');
  });

  it('should create a performance record', async () => {
    const res = await request(app)
      .post('/api/v1/hr/performance')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId.toString())
      .send({
        employeeId: employeeId.toString(),
        reviewPeriod: 'Q1',
        reviewerId: new mongoose.Types.ObjectId().toString(),
        performanceScore: 4,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.performanceScore, 4);
  });

  it('should get hr metrics from analytics', async () => {
    const res = await request(app)
      .get('/api/v1/analytics/hr-metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.attendance);
    assert.ok(res.body.data.performance);
  });

  // Regression tests for the hand-rolled `.split(',')`/`.split('\n')` CSV
  // parser previously used by bulkImportRecords, which silently misaligned
  // columns on any quoted comma or embedded newline instead of failing
  // loudly — replaced with csv-parse/sync (the same library already used by
  // departmentService.js/seedDemoData.js). A regression here would show up
  // as a validation failure (misaligned columns hit the category enum) or a
  // truncated/garbled feedbackText, not a crash.
  it('bulk-import should correctly parse a CSV field with a quoted comma', async () => {
    const feedbackDate = new Date().toISOString();
    const csvText =
      `employeeId,feedbackDate,feedbackText,category\n` +
      `${employeeId.toString()},${feedbackDate},"Great team, but workload is heavy",WORK_ENVIRONMENT`;

    const importRes = await request(app)
      .post('/api/v1/hr/feedback/bulk-import')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId.toString())
      .send({ csvText });

    assert.strictEqual(importRes.status, 200);
    assert.strictEqual(importRes.body.data.importedCount, 1);
    assert.strictEqual(importRes.body.data.failedCount, 0);

    const listRes = await request(app)
      .get('/api/v1/hr/feedback')
      .query({ employeeId: employeeId.toString() })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId.toString());

    const record = listRes.body.data.find((r) => r.feedbackText?.includes('Great team'));
    assert.ok(record, 'expected the imported feedback record to be present');
    assert.strictEqual(record.feedbackText, 'Great team, but workload is heavy');
    assert.strictEqual(record.category, 'WORK_ENVIRONMENT');
  });

  it('bulk-import should correctly parse a CSV field with an embedded newline', async () => {
    const noteDate = new Date().toISOString();
    const managerId = new mongoose.Types.ObjectId().toString();
    const csvText =
      `employeeId,managerId,noteDate,observation,recommendation\n` +
      `${employeeId.toString()},${managerId},${noteDate},"Line one\nLine two",Monitor closely`;

    const importRes = await request(app)
      .post('/api/v1/hr/notes/bulk-import')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId.toString())
      .send({ csvText });

    assert.strictEqual(importRes.status, 200);
    assert.strictEqual(importRes.body.data.importedCount, 1);
    assert.strictEqual(importRes.body.data.failedCount, 0);

    const listRes = await request(app)
      .get('/api/v1/hr/notes')
      .query({ employeeId: employeeId.toString() })
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-organization-id', orgId.toString());

    const record = listRes.body.data.find((r) => r.observation?.includes('Line one'));
    assert.ok(record, 'expected the imported manager-note record to be present');
    assert.strictEqual(record.observation, 'Line one\nLine two');
    assert.strictEqual(record.recommendation, 'Monitor closely');
  });
});
