import axios from 'axios';
import mongoose from 'mongoose';
import Explanation from '../models/Explanation.js';
import { Prediction } from '../models/Prediction.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

// Per-request budgets. The default covers the small single-employee/global
// calls; the batch call gets its own because it is inherently long-running —
// it runs SHAP over the entire active workforce in one shot (~12s for 1254
// employees on this dataset) and grows with headcount. Every historical
// AI_SERVICE_UNAVAILABLE in server/logs/error-*.log was logged at
// durationMs≈30010, i.e. this timeout firing, not the AI service being down.
const AI_DEFAULT_TIMEOUT_MS = 30000;
const AI_BATCH_TIMEOUT_MS = 180000;

const aiClient = axios.create({
  baseURL: AI_API_URL,
  headers: {
    Authorization: `Bearer ${AI_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: AI_DEFAULT_TIMEOUT_MS,
});

/**
 * Normalizes a raw axios failure into a plain Error carrying `.statusCode`/`.code`,
 * so explainController can surface the right HTTP status instead of always 502.
 * Mirrors the equivalent helper in services/aiService.js.
 */
function toExplainError(err, fallbackMessage) {
  if (!err.response) {
    // Distinguish "took too long" from "nothing listening". Collapsing both
    // into AI_SERVICE_UNAVAILABLE is what made the original batch failure so
    // hard to diagnose: the AI service was up and answering the whole time,
    // the request just exceeded the client timeout.
    const timedOut = err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
    const e = new Error(
      timedOut
        ? `AI service did not respond within ${err.config?.timeout ?? AI_DEFAULT_TIMEOUT_MS}ms. The request may be too large — try a smaller batch.`
        : 'AI service is currently unavailable. Please try again later.',
    );
    e.statusCode = timedOut ? 504 : 503;
    e.code = timedOut ? 'AI_SERVICE_TIMEOUT' : 'AI_SERVICE_UNAVAILABLE';
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
      const response = await aiClient.post('/explain/batch', payload, {
        timeout: AI_BATCH_TIMEOUT_MS,
      });
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

    // `ordered: false` keeps one bad record from aborting the batch, but
    // Mongoose then *resolves* even when every document fails validation —
    // it just returns the subset that made it in. Reporting docs.length here
    // meant the endpoint answered 200 {processed: 1254} while writing zero
    // rows. Report what was actually inserted, and surface the gap.
    const inserted = await Explanation.insertMany(docs, { ordered: false });
    const skipped = docs.length - inserted.length;
    if (skipped > 0) {
      console.warn(`explainBatch: ${skipped}/${docs.length} explanations were rejected on insert.`);
    }

    return { processed: inserted.length, skipped };
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
    // Aggregation pipelines are NOT cast against the schema the way find() is,
    // so the raw string org id from the request header never matches the
    // ObjectId actually stored on the document — the widget came back empty
    // even with explanations present.
    const orgId = mongoose.isValidObjectId(organizationId)
      ? new mongoose.Types.ObjectId(String(organizationId))
      : organizationId;

    const rows = await Explanation.aggregate([
      { $match: { organizationId: orgId } },
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
          // Mean ABSOLUTE SHAP, matching the global feature-importance
          // methodology (global_explainer.py's mean|SHAP|). A raw signed
          // average lets a small-magnitude but one-directional feature
          // (e.g. a binary field whose SHAP sign rarely flips) outrank a
          // feature with much larger swings that cancel out in the mean —
          // which is why "gender" was outranking Overtime Hours/Job
          // Satisfaction here despite ranking near the bottom of the
          // workforce-wide |SHAP| importance chart.
          avgShap: { $avg: { $abs: '$shapArr.v' } },
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
