import { workflowService } from '../services/workflowService.js';
import { sendSuccess } from '../utils/response.js';


export async function getDashboard(req, res, next) {
  try {
    const result = await workflowService.getWorkflowDashboard(req.auth.organizationId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}
