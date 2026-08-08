/**
 * @file employeeRepository.js
 * @description Data-access functions for the Employee collection.
 *
 * Why this file exists
 * --------------------
 * Encapsulates all database operations for employee profiles, search, filtering,
 * pagination, soft deletion, and bulk insertions.
 *
 * Tenant scoping
 * --------------
 * Every read/write here takes an explicit `organizationId` and filters by
 * it. This was NOT true before — none of these functions filtered by
 * organization at all, meaning any authenticated ADMIN/HR_MANAGER (from
 * ANY organization) could list, read, and edit every OTHER organization's
 * employee records, including salary and other PII. Found via
 * organization.integration.test.js while verifying Phase 1's multi-tenancy
 * work (docs/PLATFORM_BLUEPRINT.md) — see departmentRepository.js's header
 * for the twin bug that test first caught.
 */

import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';

const defaultPopulation = [
  { path: 'departmentId', select: 'name code location' },
  { path: 'managerId', select: 'firstName lastName email employeeCode designation' },
  { path: 'userId', select: 'name email status roleId' },
];

/**
 * Create a single employee document. `data.organizationId` must already be
 * set by the caller (employeeService stamps it from the authenticated
 * request).
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function createEmployee(data) {
  return Employee.create(data);
}

/**
 * Find employee by MongoDB ID with populated references, scoped to one
 * organization.
 * @param {string} employeeId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeById(employeeId, organizationId) {
  return Employee.findOne({ _id: employeeId, organizationId }).populate(defaultPopulation);
}

/**
 * Find employee by email address, scoped to one organization (two
 * different organizations may each have an employee with the same email).
 * @param {string} email
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeByEmail(email, organizationId) {
  return Employee.findOne({ email: email.toLowerCase(), organizationId }).populate(defaultPopulation);
}

/**
 * Find employee by employeeCode string (e.g. "EMP-001"), scoped to one
 * organization.
 * @param {string} code
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeByCode(code, organizationId) {
  return Employee.findOne({ employeeCode: code.toUpperCase(), organizationId }).populate(defaultPopulation);
}

/**
 * Find employee record linked to a User account, scoped to one organization.
 * @param {string} userId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeByUserId(userId, organizationId) {
  return Employee.findOne({ userId, organizationId, isDeleted: false }).populate(defaultPopulation);
}

/**
 * List employees with full filtering, text search, pagination, and sorting,
 * scoped to one organization.
 *
 * @param {object} options
 * @param {number} [options.page=1]
 * @param {number} [options.limit=10]
 * @param {string} [options.departmentId]
 * @param {string} [options.designation]
 * @param {string} [options.status]
 * @param {boolean} [options.includeDeleted=false]
 * @param {string} [options.search]
 * @param {string} [options.sortBy='createdAt']
 * @param {string} [options.sortOrder='desc']
 * @param {string} [options.sentiment] Filter by latest Employee Intelligence sentiment (Positive/Neutral/Negative)
 * @param {string} [options.burnoutRisk] Filter by latest Employee Intelligence burnout risk (Low/Medium/High)
 * @param {string} [options.emotion] Filter by latest Employee Intelligence dominant emotion
 * @param {string} organizationId
 * @returns {Promise<{ items: Array, totalItems: number, page: number, totalPages: number }>}
 */
export async function listEmployees({
  page = 1,
  limit = 10,
  departmentId,
  designation,
  status,
  includeDeleted = false,
  search,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  sentiment,
  burnoutRisk,
  emotion,
} = {}, organizationId) {
  // Aggregate() does NOT auto-cast query values to the schema's ObjectId
  // type the way find()/findOne() do (unlike findEmployeeById etc. above,
  // which use findOne and cast automatically) — matching organizationId as
  // a raw string here would silently match zero documents, exactly the
  // "processed: 1254, persisted 0" class of bug already hit elsewhere in
  // this codebase (see decisionService.js's getDashboardSummary comment).
  const filter = {
    organizationId: mongoose.Types.ObjectId.isValid(organizationId)
      ? new mongoose.Types.ObjectId(organizationId)
      : organizationId,
  };

  if (!includeDeleted) {
    filter.isDeleted = false;
  }

  if (departmentId && mongoose.Types.ObjectId.isValid(departmentId)) {
    filter.departmentId = new mongoose.Types.ObjectId(departmentId);
  }

  if (designation) {
    filter.designation = { $regex: designation.trim(), $options: 'i' };
  }

  if (status) {
    filter.status = status;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { firstName: { $regex: escaped, $options: 'i' } },
      { lastName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { employeeCode: { $regex: escaped, $options: 'i' } },
      { designation: { $regex: escaped, $options: 'i' } },
    ];
  }

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const validSortFields = [
    'firstName', 'lastName', 'email', 'joiningDate', 'salary', 'createdAt', 'employeeCode',
    'riskScore', 'burnoutScore', 'sentiment', 'emotion',
  ];
  const sortFieldMap = {
    riskScore: 'latestPrediction.riskScore',
    burnoutScore: 'latestIntelligence.burnoutScore',
    sentiment: 'latestIntelligence.sentiment',
    emotion: 'latestIntelligence.emotion',
  };
  const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
  const sortOption = { [sortFieldMap[actualSortBy] || actualSortBy]: sortDirection };

  const skip = (page - 1) * limit;

  // Join the latest Employee Intelligence profile (if any) the same way the
  // latest Prediction is joined below — a $lookup sub-pipeline sorted by
  // generatedAt desc + limit 1, since (unlike Prediction) EmployeeIntelligence
  // keeps a full history and is not unique per employee.
  const intelligenceLookupStages = [
    {
      $lookup: {
        from: 'employeeintelligences',
        let: { eid: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$employeeId', '$$eid'] } } },
          { $sort: { generatedAt: -1 } },
          { $limit: 1 },
        ],
        as: 'latestIntelligence',
      },
    },
    { $unwind: { path: '$latestIntelligence', preserveNullAndEmptyArrays: true } },
  ];

  const intelligenceMatch = {};
  if (sentiment) intelligenceMatch['latestIntelligence.sentiment'] = sentiment;
  if (burnoutRisk) intelligenceMatch['latestIntelligence.burnoutRisk'] = burnoutRisk;
  if (emotion) intelligenceMatch['latestIntelligence.emotion'] = emotion;
  const hasIntelligenceFilter = Object.keys(intelligenceMatch).length > 0;

  // Always join the latest prediction so the risk badge/filter has data
  // regardless of which column the list is sorted by.
  const pipeline = [
    { $match: filter },
    {
      $lookup: {
        from: 'predictions',
        localField: '_id',
        foreignField: 'employeeId',
        as: 'latestPrediction'
      }
    },
    {
      $unwind: {
        path: '$latestPrediction',
        preserveNullAndEmptyArrays: true
      }
    },
    ...intelligenceLookupStages,
    ...(hasIntelligenceFilter ? [{ $match: intelligenceMatch }] : []),
    { $sort: sortOption },
    { $skip: skip },
    { $limit: limit }
  ];

  const countPipeline = [
    { $match: filter },
    ...(hasIntelligenceFilter ? [...intelligenceLookupStages, { $match: intelligenceMatch }] : []),
    { $count: 'total' }
  ];

  const [aggItems, countResult] = await Promise.all([
    Employee.aggregate(pipeline),
    Employee.aggregate(countPipeline)
  ]);

  // Populate the resulting plain objects similar to find().populate()
  const items = await Employee.populate(aggItems, defaultPopulation);
  const totalItems = countResult.length > 0 ? countResult[0].total : 0;

  return {
    items,
    totalItems,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(totalItems / limit) || 1,
  };
}

/**
 * Save modifications to an employee document. No separate org check needed
 * here — the document was already fetched via a scoped findEmployeeById.
 * @param {import('mongoose').Document} employee
 * @returns {Promise<import('mongoose').Document>}
 */
export function updateEmployee(employee) {
  return employee.save();
}

/**
 * Soft delete an employee by setting `isDeleted: true` and `deletedAt: Date`,
 * scoped to one organization.
 * @param {string} employeeId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function softDeleteEmployee(employeeId, organizationId) {
  return Employee.findOneAndUpdate(
    { _id: employeeId, organizationId },
    {
      isDeleted: true,
      deletedAt: new Date(),
      status: 'INACTIVE',
    },
    { new: true },
  ).populate(defaultPopulation);
}

/**
 * Restore a soft-deleted employee, scoped to one organization.
 * @param {string} employeeId
 * @param {string} organizationId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function restoreEmployee(employeeId, organizationId) {
  return Employee.findOneAndUpdate(
    { _id: employeeId, organizationId },
    {
      isDeleted: false,
      deletedAt: null,
      status: 'ACTIVE',
    },
    { new: true },
  ).populate(defaultPopulation);
}

/**
 * Soft delete every employee not already soft-deleted, scoped to one
 * organization — this used to update EVERY tenant's employees at once.
 * @param {string} organizationId
 * @returns {Promise<number>} count of employees updated
 */
export async function softDeleteAllEmployees(organizationId) {
  const result = await Employee.updateMany(
    { organizationId, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date(), status: 'INACTIVE' } },
  );
  return result.modifiedCount;
}

/**
 * Perform bulk insertion of multiple employee documents. Each record must
 * already have organizationId stamped by the caller (employeeService).
 * @param {Array<object>} records
 * @returns {Promise<Array<import('mongoose').Document>>}
 */
export function bulkInsertEmployees(records) {
  return Employee.insertMany(records, { ordered: false });
}
