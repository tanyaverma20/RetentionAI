/**
 * @file departmentController.js
 * @description HTTP request handlers for Department management endpoints.
 *
 * Why this file exists
 * --------------------
 * Extracts HTTP parameters, query options, and validated request body fields,
 * invokes `departmentService` functions, and returns standard success responses.
 */

import * as departmentService from '../services/departmentService.js';
import { sendSuccess } from '../utils/response.js';

export async function createDepartment(request, response, next) {
  try {
    const department = await departmentService.createDepartment(request.validatedBody, request.auth.organizationId);
    return sendSuccess(response, 201, department, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listDepartments(request, response, next) {
  try {
    const { isActive, q } = request.query;
    const filterOptions = {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      q: q ? String(q).trim() : undefined,
    };
    const departments = await departmentService.listDepartments(filterOptions, request.auth.organizationId);
    return sendSuccess(response, 200, departments, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getDepartment(request, response, next) {
  try {
    const department = await departmentService.getDepartmentDetails(request.params.departmentId, request.auth.organizationId);
    return sendSuccess(response, 200, department, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function updateDepartment(request, response, next) {
  try {
    const department = await departmentService.updateDepartment(
      request.params.departmentId,
      request.validatedBody,
      request.auth.organizationId,
    );
    return sendSuccess(response, 200, department, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function deleteDepartment(request, response, next) {
  try {
    const result = await departmentService.deleteDepartment(request.params.departmentId, request.auth.organizationId);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function deleteAllDepartments(request, response, next) {
  try {
    const result = await departmentService.deleteAllDepartments(request.auth.organizationId);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function assignManager(request, response, next) {
  try {
    const department = await departmentService.assignDepartmentManager(
      request.params.departmentId,
      request.validatedBody.managerId,
      request.auth.organizationId,
    );
    return sendSuccess(response, 200, department, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function bulkUploadDepartments(request, response, next) {
  try {
    if (!request.file) {
      return next(new Error('No CSV file uploaded.'));
    }

    const summary = await departmentService.bulkUploadDepartments(request.file.buffer, request.auth.organizationId);
    return sendSuccess(response, 200, summary, request.requestId);
  } catch (error) {
    return next(error);
  }
}
