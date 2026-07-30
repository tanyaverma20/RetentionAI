/**
 * @file employeeRepository.js
 * @description Data-access functions for the Employee collection.
 *
 * Why this file exists
 * --------------------
 * Encapsulates all database operations for employee profiles, search, filtering,
 * pagination, soft deletion, and bulk insertions.
 */

import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';

const defaultPopulation = [
  { path: 'departmentId', select: 'name code location' },
  { path: 'managerId', select: 'firstName lastName email employeeCode designation' },
  { path: 'userId', select: 'name email status roleId' },
];

/**
 * Create a single employee document.
 * @param {object} data
 * @returns {Promise<import('mongoose').Document>}
 */
export function createEmployee(data) {
  return Employee.create(data);
}

/**
 * Find employee by MongoDB ID with populated references.
 * @param {string} employeeId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeById(employeeId) {
  return Employee.findById(employeeId).populate(defaultPopulation);
}

/**
 * Find employee by email address.
 * @param {string} email
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeByEmail(email) {
  return Employee.findOne({ email: email.toLowerCase() }).populate(defaultPopulation);
}

/**
 * Find employee by employeeCode string (e.g. "EMP-001").
 * @param {string} code
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeByCode(code) {
  return Employee.findOne({ employeeCode: code.toUpperCase() }).populate(defaultPopulation);
}

/**
 * Find employee record linked to a User account.
 * @param {string} userId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function findEmployeeByUserId(userId) {
  return Employee.findOne({ userId, isDeleted: false }).populate(defaultPopulation);
}

/**
 * List employees with full filtering, text search, pagination, and sorting.
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
} = {}) {
  const filter = {};

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
 * Save modifications to an employee document.
 * @param {import('mongoose').Document} employee
 * @returns {Promise<import('mongoose').Document>}
 */
export function updateEmployee(employee) {
  return employee.save();
}

/**
 * Soft delete an employee by setting `isDeleted: true` and `deletedAt: Date`.
 * @param {string} employeeId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function softDeleteEmployee(employeeId) {
  return Employee.findByIdAndUpdate(
    employeeId,
    {
      isDeleted: true,
      deletedAt: new Date(),
      status: 'INACTIVE',
    },
    { new: true },
  ).populate(defaultPopulation);
}

/**
 * Restore a soft-deleted employee.
 * @param {string} employeeId
 * @returns {Promise<import('mongoose').Document | null>}
 */
export function restoreEmployee(employeeId) {
  return Employee.findByIdAndUpdate(
    employeeId,
    {
      isDeleted: false,
      deletedAt: null,
      status: 'ACTIVE',
    },
    { new: true },
  ).populate(defaultPopulation);
}

/**
 * Perform bulk insertion of multiple employee documents.
 * @param {Array<object>} records
 * @returns {Promise<Array<import('mongoose').Document>>}
 */
export function bulkInsertEmployees(records) {
  return Employee.insertMany(records, { ordered: false });
}
