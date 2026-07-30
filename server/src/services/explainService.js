import axios from 'axios';
import Explanation from '../models/Explanation.js';
import { Prediction } from '../models/Prediction.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

const aiClient = axios.create({
  baseURL: AI_API_URL,
  headers: {
    Authorization: `Bearer ${AI_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Normalizes a raw axios failure into a plain Error carrying `.statusCode`/`.code`,
 * so explainController can surface the right HTTP status instead of always 502.
 * Mirrors the equivalent helper in services/aiService.js.
 */
function toExplainError(err, fallbackMessage) {
  if (!err.response) {
    const e = new Error('AI service is currently unavailable. Please try again later.');
    e.statusCode = 503;
    e.code = 'AI_SERVICE_UNAVAILABLE';
    return e;
  }
  const status = err.response.status;
  const detail = err.response.data?.detail || err.message || fallbackMessage;
  if (status === 503) {
    const e = new Error('SHAP explainer is not initialised. Please train a model first.');
    e.statusCode = 503;
    e.code = 'MODEL_NOT_TRAINED';
    return e;
  }
  if (status === 404) {
    const e = new Error('Employee not found or no prediction available for this employee.');
    e.statusCode = 404;
    e.code = 'EXPLANATION_NOT_FOUND';
    return e;
  }
  const e = new Error(`${fallbackMessage}: ${detail}`);
  e.statusCode = status === 400 ? 400 : 502;
  e.code = status === 400 ? 'INVALID_REQUEST' : 'AI_SERVICE_ERROR';
  return e;
}

/**
 * Maps a single FastAPI local-explanation payload (from explain_employee()) into
 * the shape stored by the Explanation Mongoose model.
 */
function mapExplanationPayload(data, employeeId, organizationId, predictionId) {
  const toFactor = (f) => ({
    feature: f.featureKey,
    displayName: f.displayName,
    value: f.rawValue,
    formattedValue: f.formattedValue,
    shapValue: f.shapValue,
  });

  const shapValues = {};
  for (const f of data.allFeatures || []) {
    shapValues[f.featureKey] = f.shapValue;
  }

  return {
    employeeId,
    organizationId,
    predictionId,
    topPositiveFactors: (data.topPositiveContributors || []).map(toFactor),
    topNegativeFactors: (data.topNegativeContributors || []).map(toFactor),
    shapValues,
    summary: data.narrative || '',
    baseValue: data.baseValue,
    riskScore: data.riskScore,
    riskLevel: data.riskLevel,
    generatedAt: new Date(),
  };
}

class ExplainService {
  /**
   * Get or generate a SHAP explanation for a single employee.
   * Checks MongoDB cache first; falls back to calling FastAPI.
   */
  async explainSingle(employeeId, organizationId, forceRefresh = false) {
    // 1. Check cache
    if (!forceRefresh) {
      const cached = await Explanation.findOne({ employeeId }).sort({ generatedAt: -1 }).lean();
      if (cached) return cached;
    }

    // 2. Call FastAPI
    let fastApiData;
    try {
      const response = await aiClient.get(`/explain/${employeeId}`);
      fastApiData = response.data?.data;
    } catch (err) {
      throw toExplainError(err, 'SHAP explanation failed');
    }

    // 3. Find the associated prediction
    const prediction = await Prediction.findOne({ employeeId }).sort({ createdAt: -1 });

    // 4. Insert a new explanation record — never overwrite, so explanation
    // history is preserved (getStoredExplanation/cache lookups always sort by
    // generatedAt desc and take the latest).
    const explanationDoc = await Explanation.create(
      mapExplanationPayload(fastApiData, employeeId, organizationId, prediction?._id),
    );

    return explanationDoc;
  }

  /**
   * Batch explain — calls FastAPI /explain/batch endpoint and
   * inserts all results into MongoDB (preserving history, same as explainSingle).
   */
  async explainBatch(organizationId, employeeIds = null) {
    const payload = {};
    if (employeeIds?.length) payload.employeeIds = employeeIds;

    let batchResults;
    try {
      const response = await aiClient.post('/explain/batch', payload);
      batchResults = response.data?.data?.explanations || [];
    } catch (err) {
      throw toExplainError(err, 'Batch SHAP explanation failed');
    }

    if (batchResults.length === 0) {
      return { processed: 0 };
    }

    const predictions = await Prediction.find({
      employeeId: { $in: batchResults.map((item) => item.employeeId) },
    }).sort({ createdAt: -1 });
    const predictionByEmployee = new Map();
    for (const p of predictions) {
      const key = String(p.employeeId);
      if (!predictionByEmployee.has(key)) predictionByEmployee.set(key, p);
    }

    const docs = batchResults.map((item) =>
      mapExplanationPayload(
        item,
        item.employeeId,
        organizationId,
        predictionByEmployee.get(String(item.employeeId))?._id,
      ),
    );

    await Explanation.insertMany(docs, { ordered: false });

    return { processed: docs.length };
  }

  /**
   * Get the global feature importance from FastAPI.
   */
  async getGlobalFeatureImportance() {
    try {
      const response = await aiClient.get('/feature-importance');
      return response.data?.data;
    } catch (err) {
      throw toExplainError(err, 'Global feature importance failed');
    }
  }

  /**
   * Get an explanation from MongoDB for a given employee.
   * Returns null if not found.
   */
  async getStoredExplanation(employeeId) {
    return Explanation.findOne({ employeeId }).sort({ generatedAt: -1 }).lean();
  }

  /**
   * Aggregate stored (already-generated) explanations by department to surface
   * the top attrition-risk driver per department. Reuses whatever explanations
   * already exist in Mongo — does not call FastAPI, so it stays cheap and only
   * reflects departments that have had at least one explanation generated.
   */
  async getDepartmentRiskDrivers(organizationId) {
    const rows = await Explanation.aggregate([
      { $match: { organizationId } },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $lookup: {
          from: 'departments',
          localField: 'employee.departmentId',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      { $addFields: { shapArr: { $objectToArray: '$shapValues' } } },
      { $unwind: '$shapArr' },
      {
        $group: {
          _id: { departmentId: '$employee.departmentId', feature: '$shapArr.k' },
          departmentName: { $first: { $ifNull: ['$department.name', 'Unassigned'] } },
          avgShap: { $avg: '$shapArr.v' },
          sampleSize: { $sum: 1 },
        },
      },
      { $sort: { avgShap: -1 } },
    ]);

    // Reduce to the single top positive-risk driver per department.
    const byDepartment = new Map();
    for (const row of rows) {
      const key = String(row._id.departmentId || 'unassigned');
      if (!byDepartment.has(key)) {
        byDepartment.set(key, {
          departmentId: row._id.departmentId || null,
          departmentName: row.departmentName,
          topFeature: row._id.feature,
          avgShap: row.avgShap,
          sampleSize: row.sampleSize,
        });
      }
    }

    return Array.from(byDepartment.values()).sort((a, b) => b.avgShap - a.avgShap);
  }
}

export const explainService = new ExplainService();
