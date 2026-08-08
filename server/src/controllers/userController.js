/**
 * @file userController.js
 * @description HTTP request handlers for user-management routes.
 *
 * Why this file exists
 * --------------------
 * Controllers have exactly one responsibility: extracting data from the HTTP
 * request (params, queries, validated body) and passing it to the service layer,
 * then formatting the returned result into a standard HTTP response. They contain
 * no business logic and no database queries.
 *
 * Error handling is uniform: every controller wraps its service call in a try/catch
 * and passes any errors to `next()`, where the centralised `errorHandler` formats
 * it according to the API contract.
 */

import * as userService from '../services/userService.js';
import { sendSuccess } from '../utils/response.js';

/**
 * POST /api/v1/users
 */
export async function createUser(request, response, next) {
  try {
    const user = await userService.createManagedUser(request.validatedBody, request.auth.organizationId);
    return sendSuccess(response, 201, user, request.requestId);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/users
 */
export async function listUsers(request, response, next) {
  try {
    const { page, pageSize, status, roleId, departmentId, q } = request.query;
    const result = await userService.listManagedUsers({
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      status,
      roleId,
      departmentId,
      q,
    }, request.auth.organizationId);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error);
  }
}

/**
 * GET /api/v1/users/:userId
 */
export async function getUser(request, response, next) {
  try {
    const user = await userService.getManagedUser(request.params.userId, request.auth.organizationId);
    return sendSuccess(response, 200, user, request.requestId);
  } catch (error) {
    return next(error);
  }
}

/**
 * PATCH /api/v1/users/:userId
 */
export async function updateUser(request, response, next) {
  try {
    const user = await userService.updateManagedUser(request.params.userId, request.validatedBody, request.auth.organizationId);
    return sendSuccess(response, 200, user, request.requestId);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/users/:userId/role
 */
export async function assignRole(request, response, next) {
  try {
    const user = await userService.assignUserRole(request.params.userId, request.validatedBody.roleId, request.auth.organizationId);
    return sendSuccess(response, 200, user, request.requestId);
  } catch (error) {
    return next(error);
  }
}

/**
 * POST /api/v1/users/:userId/deactivate
 */
export async function deactivateUser(request, response, next) {
  try {
    await userService.deactivateManagedUser(request.params.userId, request.auth.userId, request.auth.organizationId);
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
}
