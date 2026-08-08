import axios from 'axios';
import mongoose from 'mongoose';
import EmployeeIntelligence from '../models/EmployeeIntelligence.js';
import { toAiServiceError } from '../utils/aiServiceError.js';
import { acquireAiSlot, releaseAiSlot } from '../utils/aiConcurrencyGate.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

// Default budget for the small single-employee/dashboard calls, which return
// in well under a second. The workforce-wide batch gets its own budget below:
// even fully optimized it runs the NLP models over every distinct text in the
// corpus, which is seconds-to-minutes of genuine compute, not a hung request.
// Kept under Node's 300s default server.requestTimeout so Express doesn't kill
// the inbound request before axios reports on the outbound one.
const AI_DEFAULT_TIMEOUT_MS = 30000;
const AI_BATCH_TIMEOUT_MS = 240000;

const aiClient = axios.create({
  baseURL: AI_API_URL,
  headers: {
    Authorization: `Bearer ${AI_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: AI_DEFAULT_TIMEOUT_MS,
});

function mapProfileToDoc(employeeId, organizationId, data) {
  return {
    employeeId,
    organizationId,
    sentiment: data.sentiment,
    sentimentScore: data.sentimentScore,
    emotion: data.emotion,
    emotionBreakdown: data.emotionBreakdown || {},
    burnoutRisk: data.burnoutRisk,
    burnoutScore: data.burnoutScore,
    topics: data.topics || [],
    keywords: data.keywords || [],
    confidence: data.confidence,
    summary: data.summary || '',
    dataPoints: data.dataPoints || 0,
    generatedAt: new Date(),
  };
}

class EmployeeIntelligenceService {
  /**
   * Get or generate the Employee Intelligence profile for one employee.
   * Checks MongoDB cache first (unless forceRefresh); falls back to FastAPI.
   */
  async generateForEmployee(employeeId, organizationId, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await EmployeeIntelligence.findOne({ employeeId }).sort({ generatedAt: -1 }).lean();
      if (cached) return cached;
    }

    let data;
    try {
      const response = await aiClient.post('/employee-intelligence', { employeeId });
      data = response.data;
    } catch (err) {
      throw toAiServiceError(err, 'Employee Intelligence generation failed', {
        notReadyMessage: 'The NLP models are not ready yet. Please try again shortly.',
        notFoundMessage: 'Employee not found.',
      });
    }

    return EmployeeIntelligence.create(mapProfileToDoc(employeeId, organizationId, data));
  }

  /**
   * Generate Employee Intelligence profiles for many employees at once
   * (explicit list, a department, or — with neither — every ACTIVE employee).
   * Mirrors explainService.explainBatch: calls FastAPI's batch endpoint, then
   * inserts one new history record per employee (never overwritten).
   */
  async generateBatch(organizationId, employeeIds = null, departmentId = null) {
    const payload = {};
    if (employeeIds?.length) payload.employeeIds = employeeIds;
    else if (departmentId) payload.departmentId = departmentId;

    // Claims the single process-wide AI-heavy-job slot (see
    // aiConcurrencyGate.js) — see decisionService.js/explainService.js for
    // the production incident this prevents. Throws a 429 immediately if
    // another heavy job is already running, rather than letting them stack.
    const lockToken = await acquireAiSlot('Generate Employee Intelligence (batch)');
    try {
      let profiles;
      try {
        const response = await aiClient.post('/employee-intelligence/batch', payload, {
          timeout: AI_BATCH_TIMEOUT_MS,
        });
        profiles = response.data?.profiles || [];
      } catch (err) {
        throw toAiServiceError(err, 'Batch Employee Intelligence generation failed', {
          notReadyMessage: 'The NLP models are not ready yet. Please try again shortly.',
        });
      }

      if (profiles.length === 0) {
        return { processed: 0 };
      }

      const docs = profiles.map((p) => mapProfileToDoc(p.employeeId, organizationId, p));

      // `ordered: false` keeps one bad record from aborting the batch, but
      // Mongoose then resolves even when documents fail validation — it just
      // returns the subset that made it in. Report what was actually written
      // rather than what we intended to write, so a silent drop can't be
      // mistaken for success (this is exactly how the SHAP batch reported
      // "processed: 1254" while persisting zero rows).
      const inserted = await EmployeeIntelligence.insertMany(docs, { ordered: false });
      const skipped = docs.length - inserted.length;
      if (skipped > 0) {
        console.warn(`generateBatch: ${skipped}/${docs.length} Employee Intelligence profiles were rejected on insert.`);
      }

      return { processed: inserted.length, skipped };
    } finally {
      await releaseAiSlot(lockToken);
    }
  }

  /**
   * Get the latest stored Employee Intelligence profile for one employee.
   * Returns null if none has been generated yet. organizationId required
   * (Part 9/11) — EmployeeIntelligence carries it directly. Previously any
   * org could read another org's sentiment/burnout/emotion profile for any
   * employeeId via GET /employee-intelligence/:id.
   */
  async getStored(employeeId, organizationId) {
    return EmployeeIntelligence.findOne({ employeeId, organizationId }).sort({ generatedAt: -1 }).lean();
  }

  /**
   * Workforce-wide dashboard aggregation — Sentiment Distribution, Burnout
   * Distribution, Emotion Distribution, Top Concerns (topic frequency), and
   * Department Sentiment/Burnout — computed over stored (already-generated)
   * Employee Intelligence profiles, one per employee (their latest).
   */
  async getDashboardSummary(organizationId) {
    // .aggregate() does NOT auto-cast query values to the schema's ObjectId
    // type the way .find()/.findOne() do — matching on a raw string here
    // would silently match zero documents.
    const orgObjectId = mongoose.Types.ObjectId.isValid(organizationId)
      ? new mongoose.Types.ObjectId(organizationId)
      : organizationId;

    const latestPerEmployee = await EmployeeIntelligence.aggregate([
      { $match: { organizationId: orgObjectId } },
      { $sort: { generatedAt: -1 } },
      {
        $group: {
          _id: '$employeeId',
          sentiment: { $first: '$sentiment' },
          emotion: { $first: '$emotion' },
          burnoutRisk: { $first: '$burnoutRisk' },
          topics: { $first: '$topics' },
        },
      },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
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
    ]);

    const sentimentDistribution = { Positive: 0, Neutral: 0, Negative: 0 };
    const burnoutDistribution = { Low: 0, Medium: 0, High: 0 };
    const emotionDistribution = {};
    const topicCounts = new Map();
    const byDepartment = new Map();

    for (const row of latestPerEmployee) {
      if (row.sentiment in sentimentDistribution) sentimentDistribution[row.sentiment] += 1;
      if (row.burnoutRisk in burnoutDistribution) burnoutDistribution[row.burnoutRisk] += 1;
      emotionDistribution[row.emotion] = (emotionDistribution[row.emotion] || 0) + 1;
      for (const topic of row.topics || []) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      }

      const deptKey = String(row.department?._id || 'unassigned');
      if (!byDepartment.has(deptKey)) {
        byDepartment.set(deptKey, {
          departmentId: row.department?._id || null,
          departmentName: row.department?.name || 'Unassigned',
          sentimentCounts: { Positive: 0, Neutral: 0, Negative: 0 },
          burnoutCounts: { Low: 0, Medium: 0, High: 0 },
          employeeCount: 0,
        });
      }
      const dept = byDepartment.get(deptKey);
      dept.employeeCount += 1;
      if (row.sentiment in dept.sentimentCounts) dept.sentimentCounts[row.sentiment] += 1;
      if (row.burnoutRisk in dept.burnoutCounts) dept.burnoutCounts[row.burnoutRisk] += 1;
    }

    const topConcerns = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([topic, count]) => ({ topic, count }));

    const departmentBreakdown = Array.from(byDepartment.values()).sort((a, b) => b.employeeCount - a.employeeCount);

    // Trend over time — monthly average sentiment/burnout across ALL history
    // (not just the latest per employee), last 12 months.
    const trendRows = await EmployeeIntelligence.aggregate([
      { $match: { organizationId: orgObjectId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$generatedAt' } },
          avgSentimentScore: { $avg: '$sentimentScore' },
          avgBurnoutScore: { $avg: '$burnoutScore' },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);
    const trendOverTime = trendRows.map((r) => ({
      period: r._id,
      avgSentimentScore: Math.round((r.avgSentimentScore || 0) * 100) / 100,
      avgBurnoutScore: Math.round((r.avgBurnoutScore || 0) * 100) / 100,
    }));

    return {
      totalEmployeesAnalyzed: latestPerEmployee.length,
      sentimentDistribution,
      burnoutDistribution,
      emotionDistribution,
      topConcerns,
      departmentBreakdown,
      trendOverTime,
    };
  }
}

export const employeeIntelligenceService = new EmployeeIntelligenceService();
