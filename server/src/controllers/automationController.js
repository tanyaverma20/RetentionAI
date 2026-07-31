import { automationService } from '../services/automationService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';

export async function listJobs(req, res, next) {
  try {
    const result = { jobs: automationService.listJobNames(), lastRuns: automationService.getLastRuns() };
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
    const result = await automationService.runJob(jobName);
    return sendSuccess(res, 200, result, req.requestId);
  } catch (error) {
    return next(error);
  }
}
