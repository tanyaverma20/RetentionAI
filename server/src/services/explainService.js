import axios from 'axios';
import mongoose from 'mongoose';
import Explanation from '../models/Explanation.js';
import { Prediction } from '../models/Prediction.js';
import { Employee } from '../models/Employee.js';
import { GlobalFeatureImportance } from '../models/GlobalFeatureImportance.js';
import { acquireAiSlot, releaseAiSlot } from '../utils/aiConcurrencyGate.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

// Per-request budget for the small single-employee/global calls. The batch
// endpoint no longer needs its own longer budget — it returns a jobId
// immediately now (see pollExplainBatchJob below) instead of holding one
// request open for the whole computation.
const AI_DEFAULT_TIMEOUT_MS = 30000;

// How long to keep polling a batch explanation job before giving up. Actual
// full-workforce runs have been measured at 90-166s against production;
// this leaves generous margin above that.
const EXPLAIN_JOB_POLL_INTERVAL_MS = 3000;
const EXPLAIN_JOB_MAX_WAIT_MS = 8 * 60 * 1000;

const aiClient = axios.create({
  baseURL: AI_API_URL,
  headers: {
    Authorization: `Bearer ${AI_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: AI_DEFAULT_TIMEOUT_MS,
});

/**
 * Polls GET /explain/batch/status/:jobId with short, individually-fast
 * requests until the background job completes, fails, or this gives up.
 * Each poll uses the default (30s) axios timeout, which is never a risk —
 * status checks are cheap regardless of how long the underlying job takes.
 */
async function pollExplainBatchJob(jobId) {
  const deadline = Date.now() + EXPLAIN_JOB_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, EXPLAIN_JOB_POLL_INTERVAL_MS));
    const response = await aiClient.get(`/explain/batch/status/${jobId}`);
    const { status: jobStatus, data, error } = response.data || {};
    if (jobStatus === 'completed') return data;
    if (jobStatus === 'failed') {
      const e = new Error(`Batch SHAP explanation job failed: ${error}`);
      e.statusCode = 502;
      e.code = 'AI_SERVICE_ERROR';
      throw e;
    }
    // jobStatus === 'running' — keep polling.
  }
  const e = new Error(`Batch SHAP explanation did not complete within ${EXPLAIN_JOB_MAX_WAIT_MS / 1000}s.`);
  e.statusCode = 504;
  e.code = 'AI_SERVICE_TIMEOUT';
  throw e;
}

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
    // 0. Verify employee belongs to organizationId
    const employee = await Employee.findOne({
      _id: employeeId,
      organizationId,
      isDeleted: { $ne: true },
    }).lean();

    if (!employee) {
      const err = new Error('Employee not found or access denied.');
      err.statusCode = 404;
      err.code = 'EXPLANATION_NOT_FOUND';
      throw err;
    }

    // 1. Find the associated prediction
    const prediction = await Prediction.findOne({ employeeId, organizationId }).sort({ createdAt: -1 }).lean();

    // 2. Check cache
    if (!forceRefresh) {
      const cached = await Explanation.findOne({ employeeId, organizationId }).sort({ generatedAt: -1 }).lean();
      // Reuse explanations whenever the prediction has not changed.
      // If there is no prediction yet (prediction?._id is undefined), this checks if cached.predictionId is null.
      if (cached && String(cached.predictionId || 'null') === String(prediction?._id || 'null')) {
        return cached;
      }
    }

    // 3. Call FastAPI
    let fastApiData;
    try {
      const response = await aiClient.get(`/explain/${employeeId}`);
      fastApiData = response.data?.data;
    } catch (err) {
      throw toExplainError(err, 'SHAP explanation failed');
    }

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
    let validEmployeeIds = null;
    if (employeeIds?.length) {
      const validEmps = await Employee.find({
        _id: { $in: employeeIds },
        organizationId,
        isDeleted: { $ne: true },
      }).select('_id').lean();
      validEmployeeIds = validEmps.map((e) => String(e._id));
      if (validEmployeeIds.length === 0) {
        return { processed: 0, skipped: employeeIds.length };
      }
    } else {
      const validEmps = await Employee.find({
        organizationId,
        isDeleted: { $ne: true },
      }).select('_id').lean();
      validEmployeeIds = validEmps.map((e) => String(e._id));
      if (validEmployeeIds.length === 0) {
        return { processed: 0, skipped: 0 };
      }
    }
    payload.employeeIds = validEmployeeIds;

    // Claims the single process-wide AI-heavy-job slot (see
    // aiConcurrencyGate.js) — verified via production logs that this
    // running at the same moment as a batch decision run is exactly what
    // crashed the ai-service container on 2026-08-07 (two heavy jobs'
    // memory footprints landing on it together). Throws a 429 immediately
    // if another heavy job is already running, rather than letting them
    // stack.
    const lockToken = await acquireAiSlot('Generate Explanations (batch)');
    try {
      let batchResults;
      try {
        const startResponse = await aiClient.post('/explain/batch', payload);
        const jobId = startResponse.data?.jobId;
        if (!jobId) {
          const e = new Error('AI service did not return a jobId for the batch explanation job.');
          e.statusCode = 502;
          e.code = 'AI_SERVICE_ERROR';
          throw e;
        }
        batchResults = (await pollExplainBatchJob(jobId)).explanations || [];
      } catch (err) {
        if (err.statusCode) throw err;
        throw toExplainError(err, 'Batch SHAP explanation failed');
      }

      if (batchResults.length === 0) {
        return { processed: 0 };
      }

      const predictions = await Prediction.find({
        employeeId: { $in: batchResults.map((item) => item.employeeId) },
        organizationId,
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
    } finally {
      await releaseAiSlot(lockToken);
    }
  }

  /**
   * Get the global feature importance from FastAPI.
   * Caches in MongoDB and refreshes only when requested (after model retraining or batch explanation).
   */
  /**
   * Returns { features, narrative }. Both the cache-hit and fresh-fetch
   * paths now return this same shape — previously, `const features =
   * response.data?.data` assigned the WHOLE ai-service response object
   * (which is itself `{ features: [...], shapMatrix, baseValue, ... }`,
   * not the bare array despite the variable's name) to a field the
   * schema declares as an array of { featureKey, displayName, shapValue }.
   * Mongoose cast that mismatched object into a single-element array
   * containing only an auto-generated _id — every document ever written
   * here lost its real data, and every cached (non-forceRefresh) read
   * silently returned that empty shell instead of throwing, which is why
   * this went unnoticed: the always-forceRefresh call sites (right after
   * training/batch-explain) worked by relying on the CLIENT'S
   * `data?.features || data` fallback to paper over the still-correct
   * fresh response, before it round-tripped through the cache once.
   */
  async getGlobalFeatureImportance(forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await GlobalFeatureImportance.findOne().sort({ generatedAt: -1 }).lean();
      if (cached && Array.isArray(cached.features) && cached.features.length > 0 && cached.features[0]?.featureKey) {
        return { features: cached.features, narrative: cached.narrative || '' };
      }
    }

    try {
      const response = await aiClient.get('/feature-importance');
      const result = response.data?.data || {};
      const features = Array.isArray(result.features) ? result.features : [];
      const narrative = result.narrative || '';
      await GlobalFeatureImportance.create({ features, narrative });
      return { features, narrative };
    } catch (err) {
      throw toExplainError(err, 'Global feature importance failed');
    }
  }

  /**
   * Fetch a rendered global SHAP plot as raw PNG bytes.
   *
   * Deliberately not using the FastAPI /plots/global endpoint, which returns
   * absolute paths inside the AI service's container: this process cannot
   * read those, and streaming the bytes is the only thing that works once the
   * two services are deployed separately.
   *
   * @param {'summaryBeeswarm'|'summaryBar'|'dependence'} plotType
   * @param {string} feature   Feature for the dependence plot; ignored by the others.
   * @param {number} nSamples
   * @returns {Promise<Buffer>}
   */
  async getGlobalPlotImage(plotType, feature = 'salary', nSamples = 100) {
    try {
      const response = await aiClient.get(`/plots/global/${plotType}/image`, {
        params: { feature, n_samples: nSamples },
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data);
    } catch (err) {
      throw toExplainError(err, 'Global plot generation failed');
    }
  }

  /**
   * Get an explanation from MongoDB for a given employee. Returns null if
   * not found. organizationId required (Part 9/11) — Explanation carries it
   * directly. Previously any org could read another org's SHAP explanation
   * (top risk factors) for any employeeId via GET /explain/:employeeId.
   */
  async getStoredExplanation(employeeId, organizationId) {
    return Explanation.findOne({ employeeId, organizationId }).sort({ generatedAt: -1 }).lean();
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
