import axios from 'axios';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Prediction } from '../models/Prediction.js';
import { ModelMetadata } from '../models/ModelMetadata.js';
import { Employee } from '../models/Employee.js';
import { AppError } from '../errors/AppError.js';
import { acquireAiSlot, releaseAiSlot } from '../utils/aiConcurrencyGate.js';

const aiClient = axios.create({
  baseURL: env.aiService.url,
  timeout: env.aiService.timeoutMs,
  headers: {
    'Authorization': `Bearer ${env.aiService.token}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Normalizes axios failures into an Error carrying `.statusCode`/`.code`
 * so aiController can surface the right HTTP status instead of always 500/502.
 */
function toServiceError(error, fallbackMessage) {
  if (!error.response) {
    // No response at all: connection refused, DNS failure, or timeout — FastAPI is unreachable.
    const err = new Error('AI service is currently unavailable. Please try again later.');
    err.statusCode = 503;
    err.code = 'AI_SERVICE_UNAVAILABLE';
    return err;
  }
  const status = error.response.status;
  const detail = error.response.data?.detail || error.response.data?.message || fallbackMessage;
  const err = new Error(detail);
  err.statusCode = status;
  err.code = status === 503 ? 'MODEL_NOT_TRAINED' : status === 404 ? 'NOT_FOUND' : status === 400 ? 'INVALID_REQUEST' : 'AI_SERVICE_ERROR';
  return err;
}

// /train fires a FastAPI BackgroundTasks job and returns almost immediately
// — unlike explainBatch/decisionService.generateBatch, this call doesn't
// stay open for the duration of the real work, so acquireAiSlot/
// releaseAiSlot can't simply bracket the request the way they do there
// (the slot would free again seconds later, while the ai-service is still
// mid-training). Training has been measured at ~90s end-to-end in
// production (see Dashboard.jsx's poll comment); hold the slot for a fixed
// window comfortably above that instead, so a batch job kicked off right
// after Train Model still gets rejected with AI_PIPELINE_BUSY rather than
// landing on the ai-service while it's mid-training.
const TRAIN_SLOT_HOLD_MS = 3 * 60 * 1000; // 3 min — ~2x the measured ~90s.

class AIService {
  async trainModel() {
    const lockToken = await acquireAiSlot('Train Model');
    try {
      const response = await aiClient.post('/train', {}, { timeout: 30000 });
      // Training itself continues in the ai-service background after this
      // resolves — release on a timer, not in `finally`, so the slot stays
      // held for the real work instead of just this quick POST.
      setTimeout(() => {
        releaseAiSlot(lockToken).catch((err) => console.error('Failed to release AI slot after training window:', err.message));
      }, TRAIN_SLOT_HOLD_MS);
      return response.data;
    } catch (error) {
      // The job never actually started — free the slot immediately rather
      // than blocking other work for 3 minutes over a request that failed.
      await releaseAiSlot(lockToken);
      throw toServiceError(error, 'Failed to start training model');
    }
  }

  // Prompt 1, Part 9/11 — the ai-service has no organization concept: given
  // just an employeeId (predictSingle) or a raw departmentId/employeeIds
  // list (predictBatch), it fetches directly from Mongo with no tenant
  // filter at all. Previously Express forwarded those straight through, so
  // any authenticated user of ANY org could run a live prediction (full PII
  // + risk score in the response) for another org's employee just by
  // knowing/guessing its ID. Express is the only layer that knows about
  // organizations, so it must verify ownership itself before ever calling
  // the ai-service — see the resolved-employeeIds approach in predictBatch.
  async predictSingle(employeeId, organizationId) {
    const owned = await Employee.exists({ _id: employeeId, organizationId });
    if (!owned) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    }
    try {
      const response = await aiClient.post('/predict', { employeeId });
      return response.data.data;
    } catch (error) {
      throw toServiceError(error, 'Failed to generate prediction from AI service');
    }
  }

  async predictBatch(departmentId, employeeIds, organizationId) {
    // Resolve the target set ourselves, scoped to the caller's org, and send
    // an explicit employeeIds list — never forward the raw departmentId/
    // employeeIds the client supplied, since the ai-service would otherwise
    // apply them with no tenant filter at all (see predictSingle's comment).
    const filter = { organizationId, isDeleted: false };
    if (employeeIds?.length) filter._id = { $in: employeeIds };
    else if (departmentId) filter.departmentId = departmentId;
    else filter.status = 'ACTIVE';

    const resolvedIds = await Employee.find(filter).distinct('_id');
    if (resolvedIds.length === 0) {
      return { processed: 0, failed: 0, totalCount: 0, predictions: [] };
    }

    try {
      const payload = { employeeIds: resolvedIds.map(String) };

      // Own budget, not env.aiService.timeoutMs (10s default meant for the
      // single-employee calls below) — same fix already applied to explain/
      // employee-intelligence/decision batch calls: a full-workforce batch
      // enriches every employee from Attendance/Performance/Survey/etc. over
      // the network and just needs longer than any single-item call does.
      const response = await aiClient.post('/predict/batch', payload, { timeout: 180000 });
      return response.data.data;
    } catch (error) {
      throw toServiceError(error, 'Failed to run batch prediction');
    }
  }

  async getModelInfo() {
    try {
      const response = await aiClient.get('/model/info');
      return response.data.data;
    } catch (error) {
      throw toServiceError(error, 'Failed to fetch model info');
    }
  }

  /**
   * Prefers the live ai-service (whatever is actually loaded right now),
   * falling back to the durable `modelMetadata` MongoDB record (written by
   * ai-service/train_model.py after every training run) when the live call
   * fails — e.g. the ai-service is mid-restart, which this deployment has
   * hit repeatedly. The Mongo record survives that; the ai-service's
   * in-memory model bundle does not. Either path returns the same shape:
   * { algorithm, metrics, benchmark, selectionReason }.
   */
  async getModelMetrics() {
    try {
      const response = await aiClient.get('/model/metrics');
      return response.data.data;
    } catch (error) {
      const fallback = await ModelMetadata.findOne({ status: 'APPROVED' }).sort({ trainedAt: -1 }).lean();
      if (!fallback) {
        throw toServiceError(error, 'Failed to fetch model metrics');
      }
      return {
        algorithm: fallback.algorithm,
        metrics: fallback.metrics,
        benchmark: fallback.benchmark,
        selectionReason: fallback.selectionReason,
        trainedAt: fallback.trainedAt,
        source: 'durable-fallback',
      };
    }
  }

  async getPredictionForEmployee(employeeId, organizationId) {
    // Read directly from MongoDB where FastAPI saved it. organizationId
    // required (Part 9/11) — Prediction carries it directly (stamped at
    // write time), so this is a direct filter, not a join.
    return await Prediction.findOne({ employeeId, organizationId });
  }

  async getDashboardRiskCounts(organizationId) {
    // Aggregation pipelines are NOT cast against the schema the way find()
    // is — the raw string org id from the request header never matched the
    // ObjectId actually stored on Prediction documents, so this silently
    // returned zero rows (HIGH/MEDIUM/LOW all 0) despite predictions
    // existing. Same class of bug already fixed in explainService's
    // getDepartmentRiskDrivers and employeeIntelligenceService's
    // getDashboardSummary.
    const orgId = mongoose.isValidObjectId(organizationId)
      ? new mongoose.Types.ObjectId(String(organizationId))
      : organizationId;

    const results = await Prediction.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
        }
      }
    ]);
    
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    results.forEach(r => {
      counts[r._id] = r.count;
    });

    const topHighRisk = await Prediction.find({ organizationId, riskLevel: 'HIGH' })
      .sort({ riskScore: -1 })
      .limit(10)
      .populate({
        path: 'employeeId',
        select: 'firstName lastName employeeCode designation departmentId profilePicture',
        populate: { path: 'departmentId', select: 'name code' },
      });

    return { counts, topHighRisk };
  }
}

export const aiService = new AIService();
