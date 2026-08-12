/**
 * @file importGovernanceService.js
 * @description Enterprise CSV/XLSX employee data import governance engine.
 */

import crypto from 'crypto';
import { parse as parseCsv } from 'csv-parse/sync';
import { Import } from '../models/Import.js';
import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { recordAudit } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB limit
const MAX_ROW_COUNT = 5000;
const MAX_COLUMNS = 50;

/**
 * Formula Injection Protection:
 * Sanitizes cell strings starting with dangerous formula characters (=, +, -, @, \t, \r).
 */
export function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export function sanitizeRow(row) {
  const cleanRow = {};
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = sanitizeCellValue(key).replace(/^'/, '');
    cleanRow[cleanKey] = sanitizeCellValue(val);
  }
  return cleanRow;
}

export async function parseAndValidateImport({ organizationId, userId, buffer, filename, uploadId }) {
  if (!buffer || buffer.length === 0) {
    throw new AppError(400, 'EMPTY_FILE', 'Uploaded file is empty.');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new AppError(
      400,
      'FILE_TOO_LARGE',
      `File size exceeds maximum allowable limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  const effectiveUploadId = uploadId || `upl_${crypto.randomBytes(16).toString('hex')}`;

  let rawRows;
  try {
    const csvContent = buffer.toString('utf-8');
    rawRows = parseCsv(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    throw new AppError(400, 'MALFORMED_CSV', `Failed to parse CSV file: ${err.message}`);
  }

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    throw new AppError(400, 'NO_DATA_ROWS', 'CSV contains no valid data rows.');
  }

  if (rawRows.length > MAX_ROW_COUNT) {
    throw new AppError(400, 'MAX_ROWS_EXCEEDED', `Import contains ${rawRows.length} rows; maximum allowed per import is ${MAX_ROW_COUNT}.`);
  }

  const sampleRowKeys = Object.keys(rawRows[0] || {});
  if (sampleRowKeys.length > MAX_COLUMNS) {
    throw new AppError(400, 'MAX_COLUMNS_EXCEEDED', `Import contains ${sampleRowKeys.length} columns; maximum allowed is ${MAX_COLUMNS}.`);
  }

  // Fetch existing tenant employees for duplicate detection
  const existingEmployees = await Employee.find({ organizationId }).lean();
  const existingEmails = new Set(existingEmployees.map((e) => e.email.toLowerCase()));
  const existingCodes = new Set(existingEmployees.map((e) => e.employeeCode.toLowerCase()).filter(Boolean));

  // Fetch existing departments for auto-mapping
  const existingDepartments = await Department.find({ organizationId }).lean();
  const departmentMap = new Map(existingDepartments.map((d) => [d.name.toLowerCase(), d._id]));

  const validationErrors = [];
  const validStagedRows = [];

  let newCount = 0;
  let changedCount = 0;

  for (let index = 0; index < rawRows.length; index += 1) {
    const rowNum = index + 2; // 1-indexed row header = line 1
    const rawRow = rawRows[index];
    const row = sanitizeRow(rawRow);

    const firstName = row.firstName || row['First Name'] || row.first_name || '';
    const lastName = row.lastName || row['Last Name'] || row.last_name || '';
    const email = (row.email || row.Email || '').toLowerCase().replace(/^'/, '');
    const employeeCode = row.employeeCode || row['Employee Code'] || row.employee_code || `EMP-${Date.now()}-${index}`;
    const departmentName = row.department || row.Department || 'General';
    const designation = row.designation || row.Designation || row.title || 'Staff';
    const salaryNum = parseFloat(row.salary || row.Salary || '50000');

    // Schema Validation
    if (!firstName || !lastName) {
      validationErrors.push({ row: rowNum, error: 'Missing required field: firstName or lastName' });
      continue;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.push({ row: rowNum, error: `Invalid or missing email address: '${email}'` });
      continue;
    }

    if (Number.isNaN(salaryNum) || salaryNum < 0) {
      validationErrors.push({ row: rowNum, error: `Invalid numeric salary: '${row.salary}'` });
      continue;
    }

    const isDuplicate = existingEmails.has(email) || (employeeCode && existingCodes.has(employeeCode.toLowerCase()));
    if (isDuplicate) {
      changedCount += 1;
    } else {
      newCount += 1;
    }

    validStagedRows.push({
      rowNumber: rowNum,
      firstName,
      lastName,
      email,
      employeeCode,
      departmentName,
      designation,
      salary: salaryNum,
      isDuplicate,
    });
  }

  // Create or update Import job document in PREVIEW state
  let importRecord = await Import.findOne({ organizationId, uploadId: effectiveUploadId });
  if (!importRecord) {
    importRecord = new Import({
      organizationId,
      uploadId: effectiveUploadId,
      uploadedBy: userId,
      filename,
      status: 'PREVIEW',
      totalRows: rawRows.length,
      newCount,
      changedCount,
      unchangedCount: 0,
      validationErrorCount: validationErrors.length,
      validationErrors,
      stagedData: validStagedRows,
    });
  } else {
    importRecord.status = 'PREVIEW';
    importRecord.totalRows = rawRows.length;
    importRecord.newCount = newCount;
    importRecord.changedCount = changedCount;
    importRecord.validationErrorCount = validationErrors.length;
    importRecord.validationErrors = validationErrors;
    importRecord.stagedData = validStagedRows;
  }
  await importRecord.save();

  await recordAudit(organizationId, 'EMPLOYEE_IMPORT_PREVIEW', userId, {
    entityType: 'IMPORT',
    entityId: importRecord._id,
    context: { filename, totalRows: rawRows.length, errorCount: validationErrors.length },
  });

  return {
    importId: String(importRecord._id),
    uploadId: effectiveUploadId,
    filename,
    status: importRecord.status,
    totalRows: rawRows.length,
    validRowsCount: validStagedRows.length,
    newCount,
    changedCount,
    validationErrorCount: validationErrors.length,
    validationErrors,
    samplePreviewRows: validStagedRows.slice(0, 5),
  };
}

export async function commitImport({ organizationId, importId, userId }) {
  const importRecord = await Import.findOne({ _id: importId, organizationId });
  if (!importRecord) {
    throw new AppError(404, 'IMPORT_NOT_FOUND', 'Import job record not found.');
  }

  if (importRecord.status === 'COMPLETED') {
    return {
      importId: String(importRecord._id),
      status: 'COMPLETED',
      message: 'Import already completed (idempotent skip).',
      newCount: importRecord.newCount,
      changedCount: importRecord.changedCount,
    };
  }

  if (importRecord.status !== 'PREVIEW') {
    throw new AppError(400, 'INVALID_IMPORT_STATUS', `Import cannot be committed in status '${importRecord.status}'.`);
  }

  const stagedRows = importRecord.stagedData || [];
  if (!Array.isArray(stagedRows) || stagedRows.length === 0) {
    throw new AppError(400, 'NO_STAGED_ROWS', 'Import record has no valid staged rows to commit.');
  }

  let committedNewCount = 0;
  let committedUpdatedCount = 0;

  for (const row of stagedRows) {
    // Resolve or auto-create Department
    let dept = await Department.findOne({
      organizationId,
      name: { $regex: new RegExp(`^${row.departmentName}$`, 'i') },
    });

    if (!dept) {
      const codeBase = row.departmentName.replace(/[^A-Z0-9]/gi, '').substring(0, 6).toUpperCase() || 'DEPT';
      dept = await Department.create({
        organizationId,
        name: row.departmentName,
        code: `${codeBase}-${Date.now().toString(36).toUpperCase()}`.substring(0, 20),
      });
    }

    // Upsert Employee bound STRICTLY to organizationId
    const filter = {
      organizationId,
      $or: [{ email: row.email }, { employeeCode: row.employeeCode }],
    };

    const update = {
      organizationId, // AUTHORITATIVE TENANT BINDING
      departmentId: dept._id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      employeeCode: row.employeeCode,
      designation: row.designation,
      joiningDate: new Date(),
      salary: row.salary,
      status: 'ACTIVE',
    };

    const existingEmp = await Employee.findOne(filter);
    if (existingEmp) {
      await Employee.updateOne({ _id: existingEmp._id, organizationId }, update);
      committedUpdatedCount += 1;
    } else {
      await Employee.create(update);
      committedNewCount += 1;
    }
  }

  importRecord.status = 'COMPLETED';
  importRecord.completedAt = new Date();
  importRecord.newCount = committedNewCount;
  importRecord.changedCount = committedUpdatedCount;
  await importRecord.save();

  logger.info('employee_import_committed', {
    organizationId,
    importId: importRecord._id,
    newCount: committedNewCount,
    updatedCount: committedUpdatedCount,
  });

  await recordAudit(organizationId, 'EMPLOYEE_IMPORT_COMMIT', userId, {
    entityType: 'IMPORT',
    entityId: importRecord._id,
    context: { committedNewCount, committedUpdatedCount },
  });

  return {
    importId: String(importRecord._id),
    status: 'COMPLETED',
    newCount: committedNewCount,
    changedCount: committedUpdatedCount,
    totalCommitted: committedNewCount + committedUpdatedCount,
  };
}

export async function getImportHistory(organizationId) {
  const imports = await Import.find({ organizationId }).sort({ createdAt: -1 }).lean();
  return imports.map((imp) => ({
    id: String(imp._id),
    uploadId: imp.uploadId,
    filename: imp.filename,
    status: imp.status,
    totalRows: imp.totalRows,
    newCount: imp.newCount,
    changedCount: imp.changedCount,
    validationErrorCount: imp.validationErrorCount,
    completedAt: imp.completedAt,
    createdAt: imp.createdAt,
  }));
}

export async function exportImportErrorsCSV({ organizationId, importId }) {
  const importRecord = await Import.findOne({ _id: importId, organizationId }).lean();
  if (!importRecord) {
    throw new AppError(404, 'IMPORT_NOT_FOUND', 'Import record not found.');
  }

  const errors = importRecord.validationErrors || [];
  let csv = 'Row,Error\n';
  for (const err of errors) {
    const cleanErr = sanitizeCellValue(err.error).replace(/"/g, '""');
    csv += `${err.row},"${cleanErr}"\n`;
  }
  return csv;
}
