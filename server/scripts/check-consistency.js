#!/usr/bin/env node
/**
 * RetentionAI — database consistency check (Sprint 10, Part 7).
 *
 * Verifies referential integrity across the relationships that matter most
 * for correctness: Employee <-> Department, Employee <-> Manager, User <->
 * Employee (bidirectional self-service link), and every workflow entity's
 * employeeId. Read-only — reports problems, fixes nothing. Run after a
 * restore, a migration, or a bulk import to catch dangling references before
 * they surface as a 404/500 in the app.
 *
 * Usage (run from server/, so mongoose resolves from node_modules):
 *   node --env-file=.env scripts/check-consistency.js
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'retentionai';

const issues = [];

function report(check, count, sample) {
  if (count > 0) {
    issues.push({ check, count, sample });
    console.log(`✗ ${check}: ${count} problem(s)${sample ? ` — e.g. ${JSON.stringify(sample)}` : ''}`);
  } else {
    console.log(`✓ ${check}: OK`);
  }
}

async function main() {
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME });
  const db = mongoose.connection.db;

  const employees = await db.collection('employees').find({ isDeleted: { $ne: true } }).project({ _id: 1, departmentId: 1, managerId: 1, userId: 1 }).toArray();
  const employeeIds = new Set(employees.map((e) => String(e._id)));
  const departmentIds = new Set((await db.collection('departments').find({}).project({ _id: 1 }).toArray()).map((d) => String(d._id)));
  const users = await db.collection('users').find({ deletedAt: { $exists: false } }).project({ _id: 1, employeeId: 1 }).toArray();
  const userIds = new Set(users.map((u) => String(u._id)));

  // Employee -> Department
  const orphanDeptRefs = employees.filter((e) => e.departmentId && !departmentIds.has(String(e.departmentId)));
  report('Employee.departmentId references an existing Department', orphanDeptRefs.length, orphanDeptRefs[0]?._id);

  // Employee -> Manager (self-referential)
  const orphanManagerRefs = employees.filter((e) => e.managerId && !employeeIds.has(String(e.managerId)));
  report('Employee.managerId references an existing Employee', orphanManagerRefs.length, orphanManagerRefs[0]?._id);

  // User -> Employee, and back (bidirectional link used by self-service endpoints)
  const usersWithBadEmployeeRef = users.filter((u) => u.employeeId && !employeeIds.has(String(u.employeeId)));
  report('User.employeeId references an existing Employee', usersWithBadEmployeeRef.length, usersWithBadEmployeeRef[0]?._id);

  const employeesWithBadUserRef = employees.filter((e) => e.userId && !userIds.has(String(e.userId)));
  report('Employee.userId references an existing User', employeesWithBadUserRef.length, employeesWithBadUserRef[0]?._id);

  // Workflow entities -> Employee
  for (const [collection, field] of [['interventions', 'employeeId'], ['tasks', 'employeeId'], ['decisions', 'employeeId'], ['predictions', 'employeeId']]) {
    const rows = await db.collection(collection).find({ [field]: { $ne: null } }).project({ _id: 1, [field]: 1 }).toArray();
    const orphans = rows.filter((r) => !employeeIds.has(String(r[field])));
    report(`${collection}.${field} references an existing Employee`, orphans.length, orphans[0]?._id);
  }

  // Approval -> its intervention/task actually exists
  const approvals = await db.collection('approvals').find({}).project({ _id: 1, entityType: 1, entityId: 1 }).toArray();
  const interventionIds = new Set((await db.collection('interventions').find({}).project({ _id: 1 }).toArray()).map((i) => String(i._id)));
  const taskIds = new Set((await db.collection('tasks').find({}).project({ _id: 1 }).toArray()).map((t) => String(t._id)));
  const orphanApprovals = approvals.filter((a) => {
    const set = a.entityType === 'INTERVENTION' ? interventionIds : taskIds;
    return !set.has(String(a.entityId));
  });
  report('Approval.entityId references an existing Intervention/Task', orphanApprovals.length, orphanApprovals[0]?._id);

  console.log(`\n${issues.length === 0 ? 'All consistency checks passed.' : `${issues.length} check(s) found problems — see above.`}`);
  await mongoose.disconnect();
  process.exit(issues.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Consistency check failed to run:', err.message);
  process.exit(2);
});
