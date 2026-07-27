/**
 * @file employeeService.js
 * @description Business logic for employee operations, profile security, and CSV import.
 *
 * Why this file exists
 * --------------------
 * Enforces business rules for employee lifecycle (create, update, soft delete, restore),
 * authorization scope restrictions (Department Managers viewing their department,
 * Employees viewing their own profile), and bulk CSV processing.
 */

import { AppError } from '../errors/AppError.js';
import * as departmentRepository from '../repositories/departmentRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';

/**
 * Create a new employee.
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
export async function createEmployee(data) {
  const email = data.email.toLowerCase();
  const code = data.employeeCode.toUpperCase();

  const existingEmail = await employeeRepository.findEmployeeByEmail(email);
  if (existingEmail) {
    throw new AppError(409, 'DUPLICATE_EMAIL', `Employee with email '${email}' already exists.`);
  }

  const existingCode = await employeeRepository.findEmployeeByCode(code);
  if (existingCode) {
    throw new AppError(409, 'DUPLICATE_EMPLOYEE_CODE', `Employee code '${code}' already exists.`);
  }

  const department = await departmentRepository.findDepartmentById(data.departmentId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Specified department was not found.');
  }

  if (data.managerId) {
    const manager = await employeeRepository.findEmployeeById(data.managerId);
    if (!manager) {
      throw new AppError(404, 'MANAGER_NOT_FOUND', 'Specified manager employee record was not found.');
    }
  }

  return employeeRepository.createEmployee({
    ...data,
    email,
    employeeCode: code,
  });
}

/**
 * Get employee profile by ID with RBAC scope check.
 *
 * @param {string} employeeId - Target employee ID.
 * @param {{ userId: string, role: string, departmentId?: string }} authContext - Request auth context.
 * @returns {Promise<import('mongoose').Document>}
 */
export async function getEmployeeProfile(employeeId, authContext) {
  const employee = await employeeRepository.findEmployeeById(employeeId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  const { role, userId, departmentId } = authContext;

  // ADMIN and HR_MANAGER have unrestricted view access
  if (role === 'ADMIN' || role === 'HR_MANAGER') {
    return employee;
  }

  // DEPARTMENT_MANAGER can view employees in their own department
  if (role === 'DEPARTMENT_MANAGER' || role === 'DEPT_MANAGER') {
    if (!departmentId || employee.departmentId?._id?.toString() !== departmentId) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied. You can only view employees in your department.');
    }
    return employee;
  }

  // EMPLOYEE can only view their own profile (match by userId or linked employee record)
  if (role === 'EMPLOYEE') {
    const isOwnProfile =
      (employee.userId && employee.userId._id?.toString() === userId) ||
      employee.id === employeeId;

    if (!isOwnProfile) {
      throw new AppError(403, 'FORBIDDEN', 'Access denied. You can only view your own employee profile.');
    }
    return employee;
  }

  throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this profile.');
}

/**
 * List employees with filtering, searching, pagination, and RBAC department scope checks.
 *
 * @param {object} queryOptions
 * @param {{ userId: string, role: string, departmentId?: string }} authContext
 * @returns {Promise<object>}
 */
export async function listEmployees(queryOptions, authContext) {
  const { role, departmentId } = authContext;

  // If role is Department Manager, automatically restrict query to their department
  if (role === 'DEPARTMENT_MANAGER' || role === 'DEPT_MANAGER') {
    if (!departmentId) {
      throw new AppError(403, 'FORBIDDEN', 'Department Manager has no assigned department scope.');
    }
    queryOptions.departmentId = departmentId;
  }

  return employeeRepository.listEmployees(queryOptions);
}

/**
 * Update an existing employee profile.
 * @param {string} employeeId
 * @param {object} updates
 * @returns {Promise<import('mongoose').Document>}
 */
export async function updateEmployee(employeeId, updates) {
  const employee = await employeeRepository.findEmployeeById(employeeId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  if (updates.email && updates.email.toLowerCase() !== employee.email) {
    const email = updates.email.toLowerCase();
    const existing = await employeeRepository.findEmployeeByEmail(email);
    if (existing && existing.id !== employeeId) {
      throw new AppError(409, 'DUPLICATE_EMAIL', `Email '${email}' is already in use.`);
    }
    employee.email = email;
  }

  if (updates.employeeCode && updates.employeeCode.toUpperCase() !== employee.employeeCode) {
    const code = updates.employeeCode.toUpperCase();
    const existing = await employeeRepository.findEmployeeByCode(code);
    if (existing && existing.id !== employeeId) {
      throw new AppError(409, 'DUPLICATE_EMPLOYEE_CODE', `Employee code '${code}' is already in use.`);
    }
    employee.employeeCode = code;
  }

  if (updates.departmentId) {
    const department = await departmentRepository.findDepartmentById(updates.departmentId);
    if (!department) {
      throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Specified department was not found.');
    }
    employee.departmentId = updates.departmentId;
  }

  if (updates.managerId !== undefined) {
    if (updates.managerId) {
      const manager = await employeeRepository.findEmployeeById(updates.managerId);
      if (!manager) {
        throw new AppError(404, 'MANAGER_NOT_FOUND', 'Specified manager record was not found.');
      }
      employee.managerId = updates.managerId;
    } else {
      employee.managerId = null;
    }
  }

  const updatableFields = [
    'firstName',
    'lastName',
    'phone',
    'gender',
    'dateOfBirth',
    'designation',
    'joiningDate',
    'employmentType',
    'salary',
    'workLocation',
    'status',
    'userId',
  ];

  for (const field of updatableFields) {
    if (updates[field] !== undefined) {
      employee[field] = updates[field];
    }
  }

  return employeeRepository.updateEmployee(employee);
}

/**
 * Soft delete an employee.
 * @param {string} employeeId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function softDeleteEmployee(employeeId) {
  const employee = await employeeRepository.findEmployeeById(employeeId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  if (employee.isDeleted) {
    throw new AppError(400, 'ALREADY_DELETED', 'Employee is already soft-deleted.');
  }

  return employeeRepository.softDeleteEmployee(employeeId);
}

/**
 * Restore a soft-deleted employee.
 * @param {string} employeeId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function restoreEmployee(employeeId) {
  const employee = await employeeRepository.findEmployeeById(employeeId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  if (!employee.isDeleted) {
    throw new AppError(400, 'NOT_DELETED', 'Employee is active and not soft-deleted.');
  }

  return employeeRepository.restoreEmployee(employeeId);
}

/**
 * Helper to parse CSV string into array of objects.
 * Handles comma separation and quotes.
 *
 * @param {string} csvText
 * @returns {Array<object>}
 */
export function parseCSVText(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const parseRow = (text) => {
    const result = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(field.trim());
        field = '';
      } else {
        field += char;
      }
    }
    result.push(field.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]).map((v) => v.replace(/^"|"$/g, '').trim());
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Bulk import employees from an array of raw objects or parsed CSV rows.
 * Validates department existence, email uniqueness, and code uniqueness per row.
 *
 * @param {Array<object>} rows
 * @returns {Promise<{ importedCount: number, failedCount: number, errors: Array<{ row: number, error: string }>, items: Array }>}
 */
export async function bulkImportEmployees(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError(400, 'EMPTY_IMPORT_DATA', 'No employee records were provided for bulk import.');
  }

  const errors = [];
  const validRecords = [];

  // Pre-fetch departments map by code and name
  const departmentsList = await departmentRepository.listDepartments();
  const deptCodeMap = new Map(departmentsList.map((d) => [d.code.toUpperCase(), d._id.toString()]));
  const deptNameMap = new Map(departmentsList.map((d) => [d.name.toLowerCase(), d._id.toString()]));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const row = rows[i];

    try {
      const employeeCode = (row.employeeCode || row.EmployeeID || row.employee_code || '').toString().trim().toUpperCase();
      const firstName = (row.firstName || row.First_Name || row['First Name'] || '').toString().trim();
      const lastName = (row.lastName || row.Last_Name || row['Last Name'] || '').toString().trim();
      const email = (row.email || row.Email || '').toString().trim().toLowerCase();
      const designation = (row.designation || row.Designation || '').toString().trim();
      const deptKey = (row.departmentCode || row.department || row.Department || '').toString().trim();

      if (!employeeCode || !firstName || !lastName || !email || !designation || !deptKey) {
        errors.push({
          row: rowNum,
          error: 'Missing required fields (employeeCode, firstName, lastName, email, designation, department).',
        });
        continue;
      }

      // Resolve department
      let departmentId = deptCodeMap.get(deptKey.toUpperCase()) || deptNameMap.get(deptKey.toLowerCase());
      if (!departmentId) {
        errors.push({
          row: rowNum,
          error: `Department '${deptKey}' does not exist.`,
        });
        continue;
      }

      const existingCode = await employeeRepository.findEmployeeByCode(employeeCode);
      if (existingCode) {
        errors.push({ row: rowNum, error: `Employee code '${employeeCode}' already exists.` });
        continue;
      }

      const existingEmail = await employeeRepository.findEmployeeByEmail(email);
      if (existingEmail) {
        errors.push({ row: rowNum, error: `Employee email '${email}' already exists.` });
        continue;
      }

      validRecords.push({
        employeeCode,
        firstName,
        lastName,
        email,
        phone: row.phone || row.Phone || '',
        gender: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(row.gender?.toUpperCase())
          ? row.gender.toUpperCase()
          : 'PREFER_NOT_TO_SAY',
        dateOfBirth: row.dateOfBirth || row.DOB ? new Date(row.dateOfBirth || row.DOB) : null,
        departmentId,
        designation,
        joiningDate: row.joiningDate || row.Joining_Date ? new Date(row.joiningDate || row.Joining_Date) : new Date(),
        employmentType: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(row.employmentType?.toUpperCase())
          ? row.employmentType.toUpperCase()
          : 'FULL_TIME',
        salary: Number(row.salary || row.Salary) || 0,
        workLocation: row.workLocation || row.Location || 'Office',
        status: 'ACTIVE',
      });
    } catch (err) {
      errors.push({ row: rowNum, error: err.message || 'Row parsing error.' });
    }
  }

  let importedItems = [];
  if (validRecords.length > 0) {
    importedItems = await employeeRepository.bulkInsertEmployees(validRecords);
  }

  return {
    importedCount: importedItems.length,
    failedCount: errors.length,
    errors,
    items: importedItems,
  };
}
