/**
 * @file departmentService.js
 * @description Business logic for department operations.
 *
 * Why this file exists
 * --------------------
 * Isolates domain rules, uniqueness constraints, and transactional checks
 * for departments from controller endpoints.
 *
 * Every function takes an explicit `organizationId` (from
 * `req.auth.organizationId`, resolved server-side in authenticate.js — see
 * departmentRepository.js's header comment for why this exists).
 */

import { parse } from 'csv-parse/sync';
import { AppError } from '../errors/AppError.js';
import * as departmentRepository from '../repositories/departmentRepository.js';
import * as employeeRepository from '../repositories/employeeRepository.js';

/**
 * Create a new department.
 * @param {object} data
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function createDepartment(data, organizationId) {
  const code = data.code.toUpperCase();
  const existingCode = await departmentRepository.findDepartmentByCode(code, organizationId);
  if (existingCode) {
    throw new AppError(409, 'DUPLICATE_DEPARTMENT_CODE', `Department code '${code}' already exists.`);
  }

  const existingName = await departmentRepository.findDepartmentByName(data.name, organizationId);
  if (existingName) {
    throw new AppError(409, 'DUPLICATE_DEPARTMENT_NAME', `Department name '${data.name}' already exists.`);
  }

  if (data.managerId) {
    const manager = await employeeRepository.findEmployeeById(data.managerId, organizationId);
    if (!manager) {
      throw new AppError(404, 'MANAGER_NOT_FOUND', 'Specified manager employee record was not found.');
    }
  }

  return departmentRepository.createDepartment({
    ...data,
    code,
    organizationId,
  });
}

/**
 * Update an existing department.
 * @param {string} departmentId
 * @param {object} updates
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function updateDepartment(departmentId, updates, organizationId) {
  const department = await departmentRepository.findDepartmentById(departmentId, organizationId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  if (updates.code && updates.code.toUpperCase() !== department.code) {
    const code = updates.code.toUpperCase();
    const existing = await departmentRepository.findDepartmentByCode(code, organizationId);
    if (existing && existing.id !== departmentId) {
      throw new AppError(409, 'DUPLICATE_DEPARTMENT_CODE', `Department code '${code}' is in use.`);
    }
    department.code = code;
  }

  if (updates.name && updates.name.trim() !== department.name) {
    const name = updates.name.trim();
    const existing = await departmentRepository.findDepartmentByName(name, organizationId);
    if (existing && existing.id !== departmentId) {
      throw new AppError(409, 'DUPLICATE_DEPARTMENT_NAME', `Department name '${name}' is in use.`);
    }
    department.name = name;
  }

  if (updates.managerId !== undefined) {
    if (updates.managerId) {
      const manager = await employeeRepository.findEmployeeById(updates.managerId, organizationId);
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
 * @param {string} organizationId
 */
export async function deleteDepartment(departmentId, organizationId) {
  const department = await departmentRepository.findDepartmentById(departmentId, organizationId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  const employeeCount = await departmentRepository.countEmployeesInDepartment(departmentId, organizationId);
  if (employeeCount > 0) {
    throw new AppError(
      400,
      'DEPARTMENT_IN_USE',
      `Cannot delete department containing ${employeeCount} active employee(s). Reassign them first.`,
    );
  }

  await departmentRepository.deleteDepartmentById(departmentId, organizationId);
  return { id: departmentId, deleted: true };
}

/**
 * Delete every department in the caller's organization that has no active
 * employees assigned, applying the exact same guard as deleteDepartment()
 * per department instead of bypassing it — a department still holding
 * employees is skipped and reported rather than deleted, so this can never
 * silently orphan an employee's departmentId reference. Hard-delete, same
 * as the single-department path (departments have no soft-delete/restore
 * concept). Scoped to one organization — this used to delete EVERY
 * tenant's departments; see this file's header / departmentRepository.js.
 * @param {string} organizationId
 * @returns {Promise<{ deletedCount: number, skippedCount: number, skipped: Array<{id: string, name: string, employeeCount: number}> }>}
 */
export async function deleteAllDepartments(organizationId) {
  const departments = await departmentRepository.listDepartments({}, organizationId);

  const skipped = [];
  let deletedCount = 0;

  for (const department of departments) {
    const employeeCount = await departmentRepository.countEmployeesInDepartment(department._id, organizationId);
    if (employeeCount > 0) {
      skipped.push({ id: department._id.toString(), name: department.name, employeeCount });
      continue;
    }
    await departmentRepository.deleteDepartmentById(department._id, organizationId);
    deletedCount += 1;
  }

  return { deletedCount, skippedCount: skipped.length, skipped };
}

/**
 * List all departments with dynamic employee counts.
 * @param {object} options
 * @param {string} organizationId
 * @returns {Promise<Array<object>>}
 */
export function listDepartments(options, organizationId) {
  return departmentRepository.listDepartments(options, organizationId);
}

/**
 * Get detailed view of a department.
 * @param {string} departmentId
 * @param {string} organizationId
 * @returns {Promise<object>}
 */
export async function getDepartmentDetails(departmentId, organizationId) {
  const department = await departmentRepository.findDepartmentById(departmentId, organizationId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  const employeeCount = await departmentRepository.countEmployeesInDepartment(departmentId, organizationId);

  return {
    ...department.toObject(),
    employeeCount,
  };
}

/**
 * Assign or remove department manager.
 * @param {string} departmentId
 * @param {string | null} managerId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function assignDepartmentManager(departmentId, managerId, organizationId) {
  const department = await departmentRepository.findDepartmentById(departmentId, organizationId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Department not found.');
  }

  if (managerId) {
    const manager = await employeeRepository.findEmployeeById(managerId, organizationId);
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
 * @param {string} organizationId
 * @returns {Promise<object>} Summary of successful and failed imports.
 */
export async function bulkUploadDepartments(fileBuffer, organizationId) {
  let records;
  try {
    records = parse(fileBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch {
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
      organizationId,
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
