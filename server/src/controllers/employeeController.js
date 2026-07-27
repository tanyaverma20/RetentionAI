/**
 * @file employeeController.js
 * @description HTTP request handlers for Employee management endpoints.
 *
 * Why this file exists
 * --------------------
 * Extracts HTTP parameters, query options, pagination options, and validated request payloads,
 * invokes `employeeService` functions, and formats standardized responses.
 */

import { AppError } from '../errors/AppError.js';
import * as employeeService from '../services/employeeService.js';
import { aiService } from '../services/aiService.js';
import { sendSuccess } from '../utils/response.js';

export async function createEmployee(request, response, next) {
  try {
    const employee = await employeeService.createEmployee(request.validatedBody);
    return sendSuccess(response, 201, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listEmployees(request, response, next) {
  try {
    const {
      page = 1,
      limit = 10,
      departmentId,
      designation,
      status,
      includeDeleted = 'false',
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = request.query;

    const queryOptions = {
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 10, 100),
      departmentId,
      designation,
      status,
      includeDeleted: includeDeleted === 'true',
      search: search ? String(search).trim() : undefined,
      sortBy,
      sortOrder,
    };

    const result = await employeeService.listEmployees(queryOptions, request.auth);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployeeProfile(request, response, next) {
  try {
    const employee = await employeeService.getEmployeeProfile(request.params.employeeId, request.auth);
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployee360(request, response, next) {
  try {
    const data = await employeeService.getEmployee360(request.params.employeeId, request.auth);
    return sendSuccess(response, 200, data, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function explainEmployeeRisk(request, response, next) {
  try {
    const explanation = await aiService.explainEmployeeRisk(request.params.employeeId);
    return sendSuccess(response, 200, explanation, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function updateEmployee(request, response, next) {
  try {
    const employee = await employeeService.updateEmployee(
      request.params.employeeId,
      request.validatedBody,
    );
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function softDeleteEmployee(request, response, next) {
  try {
    const employee = await employeeService.softDeleteEmployee(request.params.employeeId);
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function restoreEmployee(request, response, next) {
  try {
    const employee = await employeeService.restoreEmployee(request.params.employeeId);
    return sendSuccess(response, 200, employee, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function bulkImport(request, response, next) {
  try {
    const { csvText, records } = request.validatedBody || {};
    let rowsToImport = [];

    if (csvText) {
      rowsToImport = employeeService.parseCSVText(csvText);
    } else if (Array.isArray(records)) {
      rowsToImport = records;
    }

    const result = await employeeService.bulkImportEmployees(rowsToImport);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error);
  }
}
