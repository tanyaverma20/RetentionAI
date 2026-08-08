/**
 * @file departmentRepository.js
 * @description Data-access functions for the Department collection.
 *
 * Why this file exists
 * --------------------
 * Encapsulates all Mongoose query execution for Department documents so that
 * business logic remains decoupled from the database layer.
 *
 * Tenant scoping
 * --------------
 * Every read/write here takes an explicit `organizationId` and filters by
 * it. This was NOT true before: an organization.integration.test.js smoke
 * test (Phase 1, item 2 — see docs/PLATFORM_BLUEPRINT.md) created a
 * department in one organization and found it fully visible, editable, and
 * deletable from a second, unrelated organization — every function here
 * queried Department/Employee with no organizationId filter at all. That
 * was a real, currently-exploitable cross-tenant data leak, not a
 * hypothetical: `deleteAllDepartments` would have deleted every tenant's
 * departments, not just the caller's.
 */

import mongoose from 'mongoose';
import { Department } from '../models/Department.js';
import { Employee } from '../models/Employee.js';

const managerPopulation = {
  path: 'managerId',
  select: 'firstName lastName email employeeCode designation',
};

/**
 * Create a new department. `data.organizationId` must already be set by
 * the caller (departmentService stamps it from the authenticated request).
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function createDepartment(data) {
  return Department.create(data);
}

/**
 * Find department by ID, scoped to one organization.
 * @param {string} departmentId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findDepartmentById(departmentId, organizationId) {
  return Department.findOne({ _id: departmentId, organizationId }).populate(managerPopulation);
}

/**
 * Find department by uppercase department code, scoped to one organization.
 * @param {string} code
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findDepartmentByCode(code, organizationId) {
  return Department.findOne({ code: code.toUpperCase(), organizationId }).populate(managerPopulation);
}

/**
 * Find department by exact name, scoped to one organization.
 * @param {string} name
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findDepartmentByName(name, organizationId) {
  return Department.findOne({ name: new RegExp(`^${name.trim()}$`, 'i'), organizationId }).populate(
    managerPopulation,
  );
}

/**
 * List departments with optional text search and active status filter,
 * scoped to one organization. Also computes employee counts per department.
 *
 * @param {{ isActive?: boolean, q?: string }} options
 * @param {string} organizationId
 * @returns {Promise<Array<object>>}
 */
export async function listDepartments({ isActive, q } = {}, organizationId) {
  const filter = { organizationId };
  if (typeof isActive === 'boolean') {
    filter.isActive = isActive;
  }
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { code: { $regex: escaped, $options: 'i' } },
      { location: { $regex: escaped, $options: 'i' } },
    ];
  }

  const departments = await Department.find(filter)
    .populate(managerPopulation)
    .sort({ name: 1 })
    .lean();

  // Aggregate active employee count per department — scoped to the same
  // organization so a department's count can never include another
  // tenant's employees even if departmentIds were ever to collide.
  //
  // aggregate() does NOT auto-cast a string to ObjectId the way find() does
  // (Department.find(filter) above works fine with a raw string; this does
  // not) — without the explicit cast this silently matches zero employees
  // and every department would report employeeCount: 0.
  const orgObjectId = mongoose.Types.ObjectId.isValid(organizationId)
    ? new mongoose.Types.ObjectId(organizationId)
    : organizationId;
  const employeeCounts = await Employee.aggregate([
    { $match: { isDeleted: false, organizationId: orgObjectId } },
    { $group: { _id: '$departmentId', count: { $sum: 1 } } },
  ]);

  const countMap = new Map(
    employeeCounts.map((item) => [item._id ? item._id.toString() : null, item.count]),
  );

  return departments.map((dept) => ({
    ...dept,
    employeeCount: countMap.get(dept._id.toString()) || 0,
  }));
}

/**
 * Save updated department document. No separate org check needed here —
 * the document was already fetched via a scoped findDepartmentById above.
 * @param {import('mongoose').Document} department
 * @returns {Promise<import('mongoose').Document>}
 */
export function updateDepartment(department) {
  return department.save();
}

/**
 * Delete a department by ID, scoped to one organization.
 * @param {string} departmentId
 * @param {string} organizationId
 * @returns {Promise<object | null>}
 */
export function deleteDepartmentById(departmentId, organizationId) {
  return Department.findOneAndDelete({ _id: departmentId, organizationId });
}

/**
 * Count employees assigned to a given department, scoped to one
 * organization (a departmentId is only ever meaningful within the
 * organization that owns it, but this is called with IDs already
 * confirmed to belong to the caller's org by the service layer — the
 * explicit filter here is defense in depth, not the only guard).
 * @param {string} departmentId
 * @param {string} organizationId
 * @returns {Promise<number>}
 */
export function countEmployeesInDepartment(departmentId, organizationId) {
  return Employee.countDocuments({ departmentId, organizationId, isDeleted: false });
}

/**
 * Bulk create departments. Each record must already have organizationId
 * stamped by the caller (departmentService).
 * @param {Array<object>} departmentsArray
 * @returns {Promise<any>}
 */
export function bulkCreateDepartments(departmentsArray) {
  return Department.insertMany(departmentsArray, { ordered: false });
}
