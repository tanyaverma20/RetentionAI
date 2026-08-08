import { automationService } from '../services/automationService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

export async function listJobs(req, res, next) {
  try {
    // Part 13 — scoped to the caller's own organization; see
    // automationService.getLastRuns()'s docstring for why this must never
    // return the scheduler's raw cross-org log to a per-tenant caller.
    const result = { jobs: automationService.listJobNames(), lastRuns: automationService.getLastRuns(req.auth.organizationId) };
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function runJobNow(req, res, next) {
  try {
    const { jobName } = req.params;
    if (!automationService.listJobNames().includes(jobName)) {
      throw new AppError(404, 'JOB_NOT_FOUND', `Unknown automation job: ${jobName}`);
    }
    // Part 13 — scoped to the caller's own organization; automationService.runJob()
    // (all-org) is reserved for the internal scheduler only. See its docstring.
    const result = await automationService.runJobForOrganization(jobName, req.auth.organizationId);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}
