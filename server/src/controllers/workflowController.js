import { workflowService } from '../services/workflowService.js';
import { sendSuccess } from '../utils/response.js';

function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export async function getDashboard(req, res, next) {
  try {
    const result = await workflowService.getWorkflowDashboard(extractOrgId(req));
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}
