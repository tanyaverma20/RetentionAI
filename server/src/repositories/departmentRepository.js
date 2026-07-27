/**
 * @file departmentRepository.js
 * @description Data-access functions for the Department collection.
 *
 * Why this file exists
 * --------------------
 * Encapsulates all Mongoose query execution for Department documents so that
 * business logic remains decoupled from the database layer.
 */

import { Department } from '../models/Department.js';
import { Employee } from '../models/Employee.js';

const managerPopulation = {
  path: 'managerId',
  select: 'firstName lastName email employeeCode designation',
};

/**
 * Create a new department.
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function createDepartment(data) {
  return Department.create(data);
}

/**
 * Find department by ID.
 * @param {string} departmentId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findDepartmentById(departmentId) {
  return Department.findById(departmentId).populate(managerPopulation);
}

/**
 * Find department by uppercase department code.
 * @param {string} code
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findDepartmentByCode(code) {
  return Department.findOne({ code: code.toUpperCase() }).populate(managerPopulation);
}

/**
 * Find department by exact name.
 * @param {string} name
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findDepartmentByName(name) {
  return Department.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') }).populate(
    managerPopulation,
  );
}

/**
 * List departments with optional text search and active status filter.
 * Also computes employee counts per department.
 *
 * @param {{ isActive?: boolean, q?: string }} options
 * @returns {Promise<Array<object>>}
 */
export async function listDepartments({ isActive, q } = {}) {
  const filter = {};
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

  // Aggregate active employee count per department
  const employeeCounts = await Employee.aggregate([
    { $match: { isDeleted: false } },
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
 * Save updated department document.
 * @param {import('mongoose').Document} department
 * @returns {Promise<import('mongoose').Document>}
 */
export function updateDepartment(department) {
  return department.save();
}

/**
 * Delete a department by ID.
 * @param {string} departmentId
 * @returns {Promise<object | null>}
 */
export function deleteDepartmentById(departmentId) {
  return Department.findByIdAndDelete(departmentId);
}

/**
 * Count employees assigned to a given department.
 * @param {string} departmentId
 * @returns {Promise<number>}
 */
export function countEmployeesInDepartment(departmentId) {
  return Employee.countDocuments({ departmentId, isDeleted: false });
}

/**
 * Bulk create departments.
 * @param {Array<object>} departmentsArray
 * @returns {Promise<any>}
 */
export function bulkCreateDepartments(departmentsArray) {
  return Department.insertMany(departmentsArray, { ordered: false });
}
