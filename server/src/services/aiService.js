import axios from 'axios';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Prediction } from '../models/Prediction.js';

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

class AIService {
  async trainModel() {
    try {
      const response = await aiClient.post('/train', {}, { timeout: 30000 });
      return response.data;
    } catch (error) {
      throw toServiceError(error, 'Failed to start training model');
    }
  }

  async predictSingle(employeeId) {
    try {
      const response = await aiClient.post('/predict', { employeeId });
      return response.data.data;
    } catch (error) {
      throw toServiceError(error, 'Failed to generate prediction from AI service');
    }
  }

  async predictBatch(departmentId = null, employeeIds = null) {
    try {
      const payload = {};
      if (departmentId) payload.departmentId = departmentId;
      if (employeeIds) payload.employeeIds = employeeIds;

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

  async getModelMetrics() {
    try {
      const response = await aiClient.get('/model/metrics');
      return response.data.data;
    } catch (error) {
      throw toServiceError(error, 'Failed to fetch model metrics');
    }
  }

  async getPredictionForEmployee(employeeId) {
    // Read directly from MongoDB where FastAPI saved it
    return await Prediction.findOne({ employeeId });
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
