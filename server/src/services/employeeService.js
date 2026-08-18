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
import { Employee } from '../models/Employee.js';
import { Import } from '../models/Import.js';
import { EmployeeChange } from '../models/EmployeeChange.js';
import { aiService } from './aiService.js';
import { Performance } from '../models/Performance.js';
import { Survey } from '../models/Survey.js';
import { EmployeeFeedback } from '../models/EmployeeFeedback.js';
import { ManagerNote } from '../models/ManagerNote.js';
import { PredictionHistory } from '../models/PredictionHistory.js';
import { TrainingHistory } from '../models/TrainingHistory.js';
import { PromotionHistory } from '../models/PromotionHistory.js';

/**
 * Fetch a complete 360° profile aggregating all HR sub-collections.
 * @param {string} employeeId
 * @param {object} authContext
 */
export async function getEmployee360(employeeId, authContext) {
  const employee = await getEmployeeProfile(employeeId, authContext);

  const [attendance, performance, surveys, feedback, managerNotes] = await Promise.all([
    Attendance.find({ employeeId }).sort({ attendanceDate: -1 }).limit(12).lean(),
    Performance.find({ employeeId }).sort({ reviewPeriod: -1 }).lean(),
    Survey.find({ employeeId }).sort({ surveyDate: -1 }).lean(),
    EmployeeFeedback.find({ employeeId }).sort({ feedbackDate: -1 }).limit(20).lean(),
    ManagerNote.find({ employeeId }).sort({ noteDate: -1 }).limit(20).lean(),
  ]);

  return { employee, attendance, performance, surveys, feedback, managerNotes };
}

/**
 * Create a new employee.
 * @param {object} data
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function createEmployee(data, organizationId) {
  const email = data.email.toLowerCase();
  const code = data.employeeCode.toUpperCase();

  const existingEmail = await employeeRepository.findEmployeeByEmail(email, organizationId);
  if (existingEmail) {
    throw new AppError(409, 'DUPLICATE_EMAIL', `Employee with email '${email}' already exists.`);
  }

  const existingCode = await employeeRepository.findEmployeeByCode(code, organizationId);
  if (existingCode) {
    throw new AppError(409, 'DUPLICATE_EMPLOYEE_CODE', `Employee code '${code}' already exists.`);
  }

  const department = await departmentRepository.findDepartmentById(data.departmentId, organizationId);
  if (!department) {
    throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Specified department was not found.');
  }

  if (data.managerId) {
    const manager = await employeeRepository.findEmployeeById(data.managerId, organizationId);
    if (!manager) {
      throw new AppError(404, 'MANAGER_NOT_FOUND', 'Specified manager employee record was not found.');
    }
  }

  return employeeRepository.createEmployee({
    ...data,
    email,
    employeeCode: code,
    organizationId,
  });
}

/**
 * Get employee profile by ID with RBAC scope check.
 *
 * @param {string} employeeId - Target employee ID.
 * @param {{ userId: string, role: string, departmentId?: string, organizationId: string }} authContext - Request auth context.
 * @returns {Promise<import('mongoose').Document>}
 */
export async function getEmployeeProfile(employeeId, authContext) {
  const employee = await employeeRepository.findEmployeeById(employeeId, authContext.organizationId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  const { role, userId, departmentId, employeeId: callerEmployeeId } = authContext;

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

  // EMPLOYEE can only view their own profile — matched via the bidirectional
  // User<->Employee link (either direction may be the one actually set).
  // Regression fix: the previous check's second clause (`employee.id ===
  // employeeId`) was always true — `employee` was just fetched BY that same
  // `employeeId`, so it could never disagree — making every EMPLOYEE token
  // able to view any other employee's full profile including salary.
  if (role === 'EMPLOYEE') {
    const employeeIdStr = employeeId.toString();
    const isOwnProfile =
      (callerEmployeeId && callerEmployeeId === employeeIdStr) ||
      (employee.userId && employee.userId._id?.toString() === userId) ||
      (employee.userId && employee.userId.toString?.() === userId);

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
 * @param {{ userId: string, role: string, departmentId?: string, organizationId: string }} authContext
 * @returns {Promise<object>}
 */
export async function listEmployees(queryOptions, authContext) {
  const { role, departmentId, organizationId } = authContext;

  // If role is Department Manager, automatically restrict query to their department
  if (role === 'DEPARTMENT_MANAGER' || role === 'DEPT_MANAGER') {
    if (!departmentId) {
      throw new AppError(403, 'FORBIDDEN', 'Department Manager has no assigned department scope.');
    }
    queryOptions.departmentId = departmentId;
  }

  return employeeRepository.listEmployees(queryOptions, organizationId);
}

/**
 * Update an existing employee profile.
 * @param {string} employeeId
 * @param {object} updates
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function updateEmployee(employeeId, updates, organizationId) {
  const employee = await employeeRepository.findEmployeeById(employeeId, organizationId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  if (updates.email && updates.email.toLowerCase() !== employee.email) {
    const email = updates.email.toLowerCase();
    const existing = await employeeRepository.findEmployeeByEmail(email, organizationId);
    if (existing && existing.id !== employeeId) {
      throw new AppError(409, 'DUPLICATE_EMAIL', `Email '${email}' is already in use.`);
    }
    employee.email = email;
  }

  if (updates.employeeCode && updates.employeeCode.toUpperCase() !== employee.employeeCode) {
    const code = updates.employeeCode.toUpperCase();
    const existing = await employeeRepository.findEmployeeByCode(code, organizationId);
    if (existing && existing.id !== employeeId) {
      throw new AppError(409, 'DUPLICATE_EMPLOYEE_CODE', `Employee code '${code}' is already in use.`);
    }
    employee.employeeCode = code;
  }

  if (updates.departmentId) {
    const department = await departmentRepository.findDepartmentById(updates.departmentId, organizationId);
    if (!department) {
      throw new AppError(404, 'DEPARTMENT_NOT_FOUND', 'Specified department was not found.');
    }
    employee.departmentId = updates.departmentId;
  }

  if (updates.managerId !== undefined) {
    if (updates.managerId) {
      const manager = await employeeRepository.findEmployeeById(updates.managerId, organizationId);
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
    'profilePicture',
    'profileNotes',
  ];

  for (const field of updatableFields) {
    if (updates[field] !== undefined) {
      employee[field] = updates[field];
    }
  }

  // Handle nested object fields
  if (updates.address) {
    employee.address = { ...(employee.address || {}), ...updates.address };
  }
  if (updates.emergencyContact) {
    employee.emergencyContact = { ...(employee.emergencyContact || {}), ...updates.emergencyContact };
  }
  if (updates.skills !== undefined) {
    employee.skills = updates.skills;
  }

  return employeeRepository.updateEmployee(employee);
}

/**
 * Soft delete an employee.
 * @param {string} employeeId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function softDeleteEmployee(employeeId, organizationId) {
  const employee = await employeeRepository.findEmployeeById(employeeId, organizationId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  if (employee.isDeleted) {
    throw new AppError(400, 'ALREADY_DELETED', 'Employee is already soft-deleted.');
  }

  return employeeRepository.softDeleteEmployee(employeeId, organizationId);
}

/**
 * Restore a soft-deleted employee.
 * @param {string} employeeId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document>}
 */
export async function restoreEmployee(employeeId, organizationId) {
  const employee = await employeeRepository.findEmployeeById(employeeId, organizationId);
  if (!employee) {
    throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found.');
  }

  if (!employee.isDeleted) {
    throw new AppError(400, 'NOT_DELETED', 'Employee is active and not soft-deleted.');
  }

  return employeeRepository.restoreEmployee(employeeId, organizationId);
}

/**
 * Soft delete every active (not already soft-deleted) employee in the
 * caller's organization at once. Scoped — this used to update EVERY
 * tenant's employees; see this file's header. Same reversible operation as
 * softDeleteEmployee — restore individually via POST /:employeeId/restore.
 * No hard-delete path exists for employees.
 * @param {string} organizationId
 * @returns {Promise<{ deletedCount: number }>}
 */
export async function bulkSoftDeleteAllEmployees(organizationId) {
  const deletedCount = await employeeRepository.softDeleteAllEmployees(organizationId);
  return { deletedCount };
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
 * Implements change detection (NEW, CHANGED, UNCHANGED, INACTIVE), uses employeeCode
 * as canonical identity, stores an aggregate Import summary and granular EmployeeChange diffs,
 * and triggers selective predictions for NEW and CHANGED employees.
 *
 * @param {Array<object>} rows
 * @param {string} organizationId
 * @param {object} [options]
 * @param {string} [options.mode='FULL_SNAPSHOT'] - 'FULL_SNAPSHOT' or 'PARTIAL_UPDATE'
 * @param {string} [options.filename='import.csv']
 * @param {string} [options.userId]
 * @returns {Promise<{ uploadId: string, mode: string, total: number, new: number, changed: number, unchanged: number, inactive: number, validationErrors: number, errors: Array }>}
 */
export async function bulkImportEmployees(rows, organizationId, options = {}) {
  const { mode = 'FULL_SNAPSHOT', filename = 'import.csv', userId = null } = options;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new AppError(400, 'EMPTY_IMPORT_DATA', 'No employee records were provided for bulk import.');
  }

  const uploadId = `IMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const errors = [];
  const validRows = [];
  const processedCodes = new Set();

  const departmentsList = await departmentRepository.listDepartments({}, organizationId);
  const deptIdMap = new Map(departmentsList.map((d) => [d._id.toString(), d._id.toString()]));
  const deptCodeMap = new Map(departmentsList.map((d) => [d.code.toUpperCase(), d._id.toString()]));
  const deptNameMap = new Map(departmentsList.map((d) => [d.name.trim().toLowerCase(), d._id.toString()]));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 1;
    const row = rows[i];

    try {
      const employeeCode = (row.employeeCode || row.EmployeeID || row.employee_code || '').toString().trim().toUpperCase();
      const firstName = (row.firstName || row.First_Name || row['First Name'] || '').toString().trim();
      const lastName = (row.lastName || row.Last_Name || row['Last Name'] || '').toString().trim();
      const email = (row.email || row.Email || '').toString().trim().toLowerCase();
      const designation = (row.designation || row.Designation || row.JobRole || row.jobRole || row.role || row.Role || row.title || '').toString().trim();
      const deptKey = (
        row.departmentCode ||
        row.department ||
        row.Department ||
        row.departmentName ||
        row.DepartmentName ||
        row.DepartmentID ||
        row.Department_ID ||
        ''
      ).toString().trim();

      if (!employeeCode || !firstName || !lastName || !email || !designation || !deptKey) {
        errors.push({
          row: rowNum,
          error: 'Missing required fields (employeeCode, firstName, lastName, email, designation, department).',
        });
        continue;
      }

      if (processedCodes.has(employeeCode)) {
        errors.push({
          row: rowNum,
          error: `Duplicate employee code '${employeeCode}' within the same import file.`,
        });
        continue;
      }

      const normalizedDeptName = deptKey.toLowerCase();
      let departmentId =
        deptIdMap.get(deptKey) ||
        deptCodeMap.get(deptKey.toUpperCase()) ||
        deptNameMap.get(normalizedDeptName);

      if (!departmentId) {
        // Auto-create department within current organization/tenant scope
        const rawDeptName = deptKey;
        function createCode(name) {
          let clean = (name || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
          if (clean.length < 2) clean = `${clean || 'DEPT'}_DEPT`;
          if (clean.length > 20) clean = clean.slice(0, 20);
          return clean;
        }

        const baseCode = createCode(rawDeptName);
        let codeAttempt = baseCode;
        let counter = 1;
        while (deptCodeMap.has(codeAttempt)) {
          const existingId = deptCodeMap.get(codeAttempt);
          if (deptIdMap.has(existingId) && deptNameMap.get(normalizedDeptName) === existingId) {
            break;
          }
          const suffix = `_${counter}`;
          codeAttempt = (baseCode.slice(0, 20 - suffix.length) + suffix).toUpperCase();
          counter++;
        }

        try {
          const newDept = await departmentRepository.createDepartment({
            name: rawDeptName,
            code: codeAttempt,
            organizationId,
            description: 'Auto-created during employee CSV import',
            isActive: true,
          });
          departmentId = newDept._id.toString();
          deptIdMap.set(departmentId, departmentId);
          deptNameMap.set(normalizedDeptName, departmentId);
          deptCodeMap.set(codeAttempt.toUpperCase(), departmentId);
        } catch (deptErr) {
          // Race condition / unique index duplicate recovery
          const existingByName = await departmentRepository.findDepartmentByName(rawDeptName, organizationId);
          const existingByCode = await departmentRepository.findDepartmentByCode(codeAttempt, organizationId);
          const fallbackDept = existingByName || existingByCode;
          if (fallbackDept) {
            departmentId = fallbackDept._id.toString();
            deptIdMap.set(departmentId, departmentId);
            deptNameMap.set(normalizedDeptName, departmentId);
            deptCodeMap.set(fallbackDept.code.toUpperCase(), departmentId);
          } else {
            errors.push({
              row: rowNum,
              error: `Failed to auto-create department '${rawDeptName}': ${deptErr.message}`,
            });
            continue;
          }
        }
      }

      processedCodes.add(employeeCode);
      const genderVal = (row.gender || row.Gender || '').toString().toUpperCase();
      const empTypeVal = (row.employmentType || row.EmploymentType || row.Status || row.status || '').toString().toUpperCase();
      const hireDateVal = row.joiningDate || row.Joining_Date || row.HireDate || row.hireDate;
      const salaryVal = Number(row.salary || row.Salary || row.MonthlySalaryINR || row.monthlySalaryINR || row.MonthlySalary) || 0;
      const locationVal = row.workLocation || row.WorkLocation || row.Location || row.location || 'Office';

      validRows.push({
        rowNum,
        employeeCode,
        firstName,
        lastName,
        email,
        departmentId,
        designation,
        phone: row.phone || row.Phone || '',
        gender: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'].includes(genderVal)
          ? genderVal
          : 'PREFER_NOT_TO_SAY',
        dateOfBirth: row.dateOfBirth || row.DOB ? new Date(row.dateOfBirth || row.DOB) : null,
        joiningDate: hireDateVal ? new Date(hireDateVal) : new Date(),
        employmentType: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'].includes(empTypeVal)
          ? empTypeVal
          : 'FULL_TIME',
        salary: salaryVal,
        workLocation: locationVal,
      });
    } catch (err) {
      errors.push({ row: rowNum, error: err.message || 'Row parsing error.' });
    }
  }

  // Pre-fetch all existing employees for this organization indexed by employeeCode
  const existingEmployees = await Employee.find({ organizationId }).lean();
  const existingCodeMap = new Map(existingEmployees.map((e) => [e.employeeCode.toUpperCase(), e]));

  let newCount = 0;
  let changedCount = 0;
  let unchangedCount = 0;
  let inactiveCount = 0;

  const predictEmployeeIds = [];
  const changesToInsert = [];

  for (const item of validRows) {
    const existing = existingCodeMap.get(item.employeeCode);

    if (!existing) {
      // NEW employee
      const created = await employeeRepository.createEmployee({
        ...item,
        organizationId,
        status: 'ACTIVE',
      });
      newCount++;
      predictEmployeeIds.push(created._id.toString());
    } else {
      // Compare tracked fields
      const diffs = [];

      const checkField = (field, oldVal, newVal) => {
        if (field === 'departmentId') {
          const oldDeptStr = oldVal?._id ? oldVal._id.toString() : oldVal ? oldVal.toString() : '';
          const newDeptStr = newVal ? newVal.toString() : '';
          if (oldDeptStr !== newDeptStr) {
            diffs.push({ field, previousValue: oldDeptStr, newValue: newDeptStr });
          }
          return;
        }
        if (field === 'salary') {
          if (Number(oldVal || 0) !== Number(newVal || 0)) {
            diffs.push({ field, previousValue: oldVal, newValue: newVal });
          }
          return;
        }
        if (String(oldVal || '').trim() !== String(newVal || '').trim()) {
          diffs.push({ field, previousValue: oldVal, newValue: newVal });
        }
      };

      checkField('firstName', existing.firstName, item.firstName);
      checkField('lastName', existing.lastName, item.lastName);
      checkField('email', existing.email, item.email);
      checkField('departmentId', existing.departmentId, item.departmentId);
      checkField('designation', existing.designation, item.designation);
      checkField('salary', existing.salary, item.salary);
      checkField('workLocation', existing.workLocation, item.workLocation);
      checkField('employmentType', existing.employmentType, item.employmentType);
      checkField('gender', existing.gender, item.gender);

      const statusRestored = existing.status !== 'ACTIVE' || existing.isDeleted;

      if (diffs.length > 0 || statusRestored) {
        // CHANGED employee
        await Employee.findByIdAndUpdate(
          existing._id,
          {
            $set: {
              firstName: item.firstName,
              lastName: item.lastName,
              email: item.email,
              departmentId: item.departmentId,
              designation: item.designation,
              salary: item.salary,
              workLocation: item.workLocation,
              employmentType: item.employmentType,
              gender: item.gender,
              phone: item.phone,
              status: 'ACTIVE',
              isDeleted: false,
            },
          },
          { new: true },
        );

        if (diffs.length > 0) {
          changesToInsert.push({
            organizationId,
            uploadId,
            employeeId: existing._id,
            employeeCode: item.employeeCode,
            changedFields: diffs,
          });
        }

        changedCount++;
        predictEmployeeIds.push(existing._id.toString());
      } else {
        // UNCHANGED employee
        unchangedCount++;
      }
    }
  }

  // Insert change details into EmployeeChange collection (unbounded scale safe)
  if (changesToInsert.length > 0) {
    await EmployeeChange.insertMany(changesToInsert);
  }

  // Handle FULL_SNAPSHOT mode for missing active employees
  if (mode === 'FULL_SNAPSHOT') {
    const incomingCodesUpper = new Set(validRows.map((r) => r.employeeCode));
    const missingActiveEmployees = existingEmployees.filter(
      (e) => e.status === 'ACTIVE' && !e.isDeleted && !incomingCodesUpper.has(e.employeeCode.toUpperCase()),
    );

    if (missingActiveEmployees.length > 0) {
      const missingIds = missingActiveEmployees.map((e) => e._id);
      await Employee.updateMany(
        { _id: { $in: missingIds } },
        { $set: { status: 'INACTIVE' } },
      );
      inactiveCount = missingActiveEmployees.length;
    }
  }

  let predictionStatus = 'SKIPPED';
  if (predictEmployeeIds.length > 0) {
    predictionStatus = 'PROCESSING';
  }

  const importDoc = await Import.create({
    organizationId,
    uploadId,
    uploadedBy: userId,
    mode,
    status: 'COMPLETED',
    filename,
    totalRows: rows.length,
    newCount,
    changedCount,
    unchangedCount,
    inactiveCount,
    validationErrorCount: errors.length,
    validationErrors: errors,
    predictionStatus,
    completedAt: new Date(),
  });

  // Trigger Selective Predictions for NEW and CHANGED employees
  if (predictEmployeeIds.length > 0) {
    aiService.predictBatch(null, predictEmployeeIds, organizationId)
      .then(() => {
        Import.findByIdAndUpdate(importDoc._id, { $set: { predictionStatus: 'COMPLETED' } }).catch(() => {});
      })
      .catch((err) => {
        console.error(`Prediction batch failed for import ${uploadId}:`, err.message);
        Import.findByIdAndUpdate(importDoc._id, { $set: { predictionStatus: 'FAILED' } }).catch(() => {});
      });
  }

  return {
    uploadId,
    mode,
    total: rows.length,
    new: newCount,
    changed: changedCount,
    unchanged: unchangedCount,
    inactive: inactiveCount,
    validationErrors: errors.length,
    errors,
  };
}

/**
 * Get a chronological timeline of all events for an employee.
 * Aggregates: join date, attendance highlights, performance reviews, trainings, promotions.
 * @param {string} employeeId
 * @param {object} authContext
 * @returns {Promise<Array<{date: string, type: string, title: string, description: string}>>}
 */
export async function getEmployeeTimeline(employeeId, authContext) {
  const employee = await getEmployeeProfile(employeeId, authContext);
  const events = [];

  // Joining event
  events.push({
    date: employee.joiningDate,
    type: 'JOINED',
    title: 'Joined Company',
    description: `Joined as ${employee.designation} in ${employee.departmentId?.name || 'Unknown'} department.`,
  });

  // Attendance milestones (recent 30)
  const attendanceRecords = await Attendance.find({ employeeId })
    .sort({ attendanceDate: -1 })
    .limit(30)
    .lean();
  for (const a of attendanceRecords) {
    if (a.attendanceStatus !== 'PRESENT') {
      events.push({
        date: a.attendanceDate,
        type: 'ATTENDANCE',
        title: `Attendance: ${a.attendanceStatus.replace('_', ' ')}`,
        description: a.leaveType !== 'NONE' ? `Leave type: ${a.leaveType}` : (a.remarks || ''),
      });
    }
  }

  // Performance reviews
  const reviews = await Performance.find({ employeeId }).sort({ createdAt: -1 }).lean();
  for (const r of reviews) {
    events.push({
      date: r.createdAt,
      type: 'PERFORMANCE',
      title: `Performance Review: ${r.reviewPeriod}`,
      description: `Score: ${r.performanceScore}/5. ${r.promotionRecommendation ? '⭐ Promotion recommended.' : ''}`,
    });
  }

  // Trainings
  const trainings = await TrainingHistory.find({ employeeId }).sort({ completionDate: -1 }).lean();
  for (const t of trainings) {
    events.push({
      date: t.completionDate,
      type: 'TRAINING',
      title: `Training: ${t.courseName}`,
      description: `Provider: ${t.provider}. Duration: ${t.durationHours}h.${t.certificationEarned ? ' 🎓 Certified.' : ''}`,
    });
  }

  // Promotions
  const promotions = await PromotionHistory.find({ employeeId }).sort({ promotionDate: -1 }).lean();
  for (const p of promotions) {
    events.push({
      date: p.promotionDate,
      type: 'PROMOTION',
      title: `Promoted: ${p.previousRole} → ${p.newRole}`,
      description: `Salary increase: ${p.salaryIncreasePercentage}%.${p.reason ? ` Reason: ${p.reason}` : ''}`,
    });
  }

  // Sort all events by date descending
  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  return events;
}

/**
 * Fetch chronological prediction history for an employee (Risk Timeline).
 * Enforces tenant ownership and caller RBAC scope restrictions.
 *
 * @param {string} employeeId
 * @param {object} authContext
 * @param {{ page?: number, limit?: number }} [pagination]
 * @returns {Promise<{ items: Array, totalItems: number, page: number, limit: number, totalPages: number }>}
 */
export async function getEmployeeRiskTimeline(employeeId, authContext, pagination = {}) {
  await getEmployeeProfile(employeeId, authContext);

  const page = Math.max(pagination.page || 1, 1);
  const limit = Math.min(pagination.limit || 20, 100);
  const skip = (page - 1) * limit;

  const filter = {
    organizationId: authContext.organizationId,
    employeeId,
  };

  const [totalItems, history] = await Promise.all([
    PredictionHistory.countDocuments(filter),
    PredictionHistory.find(filter)
      .sort({ predictedAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  return {
    items: history,
    totalItems,
    page,
    limit,
    totalPages: Math.ceil(totalItems / limit) || 1,
  };
}
