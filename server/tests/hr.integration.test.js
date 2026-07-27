import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/app.js';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';
import { Employee } from '../src/models/Employee.js';
import { generateAccessToken } from '../src/utils/tokens.js';

let mongoServer;
let adminToken;
let employeeId;
let orgId;
let adminId;

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

    adminToken = generateAccessToken(admin._id);
    adminId = admin._id;

    orgId = new mongoose.Types.ObjectId();
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
});
