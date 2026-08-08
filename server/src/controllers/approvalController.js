import { approvalService } from '../services/approvalService.js';
import { interventionService } from '../services/interventionService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

export async function getApprovalForEntity(req, res, next) {
  try {
    const { entityType, entityId } = req.query;
    if (!entityType || !entityId) throw new AppError(422, 'VALIDATION_ERROR', 'entityType and entityId are required.');
    const result = await approvalService.getByEntity(entityType, entityId, req.auth.organizationId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function decideApproval(req, res, next) {
  try {
    const { decision, reason } = req.body || {};
    if (!decision) throw new AppError(422, 'VALIDATION_ERROR', 'decision is required.');
    const approval = await approvalService.decide(req.params.id, req.auth.userId, req.auth.role, decision, reason, req.auth.organizationId);

    // If the entity is an Intervention, keep its own status in sync with the
    // now-resolved approval chain (single source of truth: the transition
    // graph in interventionService, not a duplicated status here).
    if (approval.entityType === 'INTERVENTION' && approval.overallStatus !== 'PENDING') {
      await interventionService.syncFromApproval(approval.entityId, approval, req.auth.userId);
    }

    return sendSuccess(res, 200, approval, req.requestId);
  } catch (error) {
    return next(error);
  }
}
