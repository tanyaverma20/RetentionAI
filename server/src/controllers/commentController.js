import { commentService } from '../services/commentService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export async function createComment(req, res, next) {
  try {
    const result = await commentService.create(extractOrgId(req), req.body || {}, req.auth.userId);
    return sendSuccess(res, 201, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function listComments(req, res, next) {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) throw new AppError(422, 'VALIDATION_ERROR', 'entityType and entityId are required.');
    const result = await commentService.listForEntity(entityType, entityId);
    return sendSuccess(res, 200, { comments: result }, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const result = await commentService.softDelete(req.params.id, req.auth.userId, req.auth.role);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}
