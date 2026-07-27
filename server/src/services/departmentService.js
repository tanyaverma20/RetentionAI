/**
 * @file departmentService.js
 * @description Business logic for department operations.
 *
 * Why this file exists
 * --------------------
 * Isolates domain rules, uniqueness constraints, and transactional checks
 * for departments from controller endpoints.
 */

import { parse } from 'csv-parse/sync';
import { AppError } from '../errors/AppError.js';
import * as departmentRepository from '../repositories/departmentRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';

/**
 * Create a new department.
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
export async function createDepartment(data) {
  const code = data.code.toUpperCase();
  const existingCode = await departmentRepository.findDepartmentByCode(code);
  if (existingCode) {
    throw new AppError(409, 'DUPLICATE_DEPARTMENT_CODE', `Department code '${code}' already exists.`);
  }

  const existingName = await departmentRepository.findDepartmentByName(data.name);
  if (existingName) {
    throw new AppError(409, 'DUPLICATE_DEPARTMENT_NAME', `Department name '${data.name}' already exists.`);
  }

  if (data.managerId) {
    const manager = await employeeRepository.findEmployeeById(data.managerId);
    if (!manager) {
      throw new AppError(404, 'MANAGER_NOT_FOUND', 'Specified manager employee record was not found.');
    }
  }

  return departmentRepository.createDepartment({
    ...data,
    code,
  });
}

/**
 * Update an existing department.
 * @param {string} departmentId
 * @param {object} updates
 * @returns {Promise<import('mongoose').Document>}
 */
export async function updateDepartment(departmentId, updates) {
  const department = await departmentRepository.findDepartmentById(departmentId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  if (updates.code && updates.code.toUpperCase() !== department.code) {
    const code = updates.code.toUpperCase();
    const existing = await departmentRepository.findDepartmentByCode(code);
    if (existing && existing.id !== departmentId) {
      throw new AppError(409, 'DUPLICATE_DEPARTMENT_CODE', `Department code '${code}' is in use.`);
    }
    department.code = code;
  }

  if (updates.name && updates.name.trim() !== department.name) {
    const name = updates.name.trim();
    const existing = await departmentRepository.findDepartmentByName(name);
    if (existing && existing.id !== departmentId) {
      throw new AppError(409, 'DUPLICATE_DEPARTMENT_NAME', `Department name '${name}' is in use.`);
    }
    department.name = name;
  }

  if (updates.managerId !== undefined) {
    if (updates.managerId) {
      const manager = await employeeRepository.findEmployeeById(updates.managerId);
      if (!manager) {
        throw new AppError(404, 'MANAGER_NOT_FOUND', 'Specified manager employee record was not found.');
      }
      department.managerId = updates.managerId;
    } else {
      department.managerId = null;
    }
  }

  if (updates.description !== undefined) department.description = updates.description;
  if (updates.location !== undefined) department.location = updates.location;
  if (updates.isActive !== undefined) department.isActive = updates.isActive;

  return departmentRepository.updateDepartment(department);
}

/**
 * Delete department if no active employees are assigned.
 * @param {string} departmentId
 */
export async function deleteDepartment(departmentId) {
  const department = await departmentRepository.findDepartmentById(departmentId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  const employeeCount = await departmentRepository.countEmployeesInDepartment(departmentId);
  if (employeeCount > 0) {
    throw new AppError(
      400,
      'DEPARTMENT_IN_USE',
      `Cannot delete department containing ${employeeCount} active employee(s). Reassign them first.`,
    );
  }

  await departmentRepository.deleteDepartmentById(departmentId);
  return { id: departmentId, deleted: true };
}

/**
 * List all departments with dynamic employee counts.
 * @param {object} options
 * @returns {Promise<Array<object>>}
 */
export function listDepartments(options) {
  return departmentRepository.listDepartments(options);
}

/**
 * Get detailed view of a department.
 * @param {string} departmentId
 * @returns {Promise<object>}
 */
export async function getDepartmentDetails(departmentId) {
  const department = await departmentRepository.findDepartmentById(departmentId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  const employeeCount = await departmentRepository.countEmployeesInDepartment(departmentId);

  return {
    ...department.toObject(),
    employeeCount,
  };
}

/**
 * Assign or remove department manager.
 * @param {string} departmentId
 * @param {string | null} managerId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function assignDepartmentManager(departmentId, managerId) {
  const department = await departmentRepository.findDepartmentById(departmentId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  if (managerId) {
    const manager = await employeeRepository.findEmployeeById(managerId);
    if (!manager) {
      throw new AppError(404, 'MANAGER_NOT_FOUND', 'Specified manager employee record was not found.');
    }
    department.managerId = managerId;
  } else {
    department.managerId = null;
  }

  return departmentRepository.updateDepartment(department);
}

/**
 * Bulk upload departments from a CSV buffer.
 * @param {Buffer} fileBuffer
 * @returns {Promise<object>} Summary of successful and failed imports.
 */
export async function bulkUploadDepartments(fileBuffer) {
  let records;
  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (error) {
    throw new AppError(400, 'INVALID_CSV', 'Failed to parse CSV file. Please ensure it matches the template.');
  }

  if (records.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'The uploaded file contains no data rows.');
  }

  const departmentsToInsert = [];
  const errors = [];
  
  const seenCodes = new Set();
  const seenNames = new Set();

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;
    
    const rowData = {
      name: row.Name || row.name,
      code: row.Code || row.code,
      description: row.Description || row.description,
      location: row.Location || row.location,
      isActive: row.IsActive !== undefined ? row.IsActive : row.isActive,
    };

    if (!rowData.name || !rowData.code) {
      errors.push(`Row ${rowNum}: Name and Code are required.`);
      continue;
    }

    const code = rowData.code.toUpperCase();
    const name = rowData.name.trim();

    if (seenCodes.has(code)) {
      errors.push(`Row ${rowNum}: Duplicate code '${code}' within file.`);
      continue;
    }
    if (seenNames.has(name.toLowerCase())) {
      errors.push(`Row ${rowNum}: Duplicate name '${name}' within file.`);
      continue;
    }

    seenCodes.add(code);
    seenNames.add(name.toLowerCase());

    departmentsToInsert.push({
      name,
      code,
      description: rowData.description || undefined,
      location: rowData.location || undefined,
      isActive: rowData.isActive !== undefined && rowData.isActive !== '' ? String(rowData.isActive).toLowerCase() === 'true' : true,
    });
  }

  if (departmentsToInsert.length === 0) {
    throw new AppError(400, 'NO_VALID_DATA', 'No valid rows found to import. Details: ' + errors.join(' | '));
  }

  let insertedCount = 0;
  try {
    const result = await departmentRepository.bulkCreateDepartments(departmentsToInsert);
    insertedCount = result.length;
  } catch (error) {
    if (error.name === 'MongoBulkWriteError' && error.writeErrors) {
      insertedCount = error.insertedCount;
      error.writeErrors.forEach(err => {
        errors.push(`Database error: ${err.errmsg}`);
      });
    } else {
      throw error;
    }
  }

  return {
    success: true,
    totalAttempted: records.length,
    insertedCount,
    failedCount: records.length - insertedCount,
    errors: errors.slice(0, 50)
  };
}
