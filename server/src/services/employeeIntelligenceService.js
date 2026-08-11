import axios from 'axios';
import mongoose from 'mongoose';
import EmployeeIntelligence from '../models/EmployeeIntelligence.js';
import { Employee } from '../models/Employee.js';
import { EmployeeFeedback } from '../models/EmployeeFeedback.js';
import { AppError } from '../errors/AppError.js';
import { getRedisClient, isRedisConfigured } from '../utils/redisClient.js';
import { toAiServiceError } from '../utils/aiServiceError.js';
import { acquireAiSlot, releaseAiSlot } from '../utils/aiConcurrencyGate.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

const AI_DEFAULT_TIMEOUT_MS = 30000;
const AI_BATCH_TIMEOUT_MS = 240000;

const localNlpCache = new Map();

function makeNlpCacheKey(organizationId, employeeId, feedbackId, nlpVersion = '1.0.0') {
  return `nlp:${organizationId}:${employeeId}:${feedbackId}:${nlpVersion}`;
}

async function getCachedNlp(key) {
  if (isRedisConfigured()) {
    try {
      const redis = getRedisClient();
      const val = await redis.get(key);
      if (val) return typeof val === 'string' ? JSON.parse(val) : val;
    } catch {
      // Ignore cache read failures
    }
  }
  return localNlpCache.get(key) || null;
}

async function setCachedNlp(key, value, ttlSeconds = 86400) {
  if (isRedisConfigured()) {
    try {
      const redis = getRedisClient();
      await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
      return;
    } catch {
      // Fall through to local cache
    }
  }
  localNlpCache.set(key, value);
}

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
      const cached = await EmployeeIntelligence.findOne({ employeeId, organizationId }).sort({ generatedAt: -1 }).lean();
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

  /**
   * Create a new employee feedback record with tenant isolation and optional NLP auto-analysis.
   */
  async createFeedback(organizationId, employeeId, data) {
    const employee = await Employee.findOne({ _id: employeeId, organizationId, isDeleted: { $ne: true } });
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found for this organization.');
    }

    const {
      feedbackText,
      feedbackDate,
      submittedAt,
      category = 'OTHER',
      source = 'FEEDBACK',
      anonymous = false,
      visibility = 'HR_ONLY',
      attachments = [],
    } = data;

    if (!feedbackText || !feedbackText.trim()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Feedback text is required.');
    }

    let nlpAnalysis = null;
    try {
      const response = await aiClient.post('/nlp/analyze', {
        employeeId: String(employeeId),
        sourceCollection: 'employeefeedbacks',
        sourceDocumentId: new mongoose.Types.ObjectId().toString(),
        text: feedbackText,
      });
      nlpAnalysis = response.data;
    } catch (err) {
      console.warn('NLP auto-analysis unavailable during feedback creation, saving unanalyzed record:', err.message);
    }

    const feedbackDoc = await EmployeeFeedback.create({
      organizationId,
      employeeId,
      feedbackText: feedbackText.trim(),
      feedbackDate: feedbackDate || submittedAt || new Date(),
      submittedAt: submittedAt || new Date(),
      category,
      source,
      anonymous: !!anonymous,
      visibility,
      attachments,
      sentiment: nlpAnalysis?.sentiment || undefined,
      sentimentScore: nlpAnalysis?.sentimentScore !== undefined ? nlpAnalysis.sentimentScore : undefined,
      confidence: nlpAnalysis?.confidence !== undefined ? nlpAnalysis.confidence : undefined,
      topics: nlpAnalysis?.detectedTopics || [],
      emotionSignals: nlpAnalysis?.detectedEmotions || {},
      summary: nlpAnalysis?.summary || '',
      nlpProvider: 'VADER+Transformers',
      nlpModel: 'roberta-go_emotions+distilbart',
      nlpVersion: '1.0.0',
      analyzedAt: nlpAnalysis ? new Date() : undefined,
    });

    if (nlpAnalysis) {
      const cacheKey = makeNlpCacheKey(organizationId, employeeId, feedbackDoc._id, '1.0.0');
      await setCachedNlp(cacheKey, feedbackDoc.toObject());
    }

    return feedbackDoc;
  }

  /**
   * Get employee feedback history scoped strictly by organizationId and employeeId.
   */
  async getEmployeeFeedback(organizationId, employeeId) {
    const employee = await Employee.findOne({ _id: employeeId, organizationId, isDeleted: { $ne: true } });
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found for this organization.');
    }

    return EmployeeFeedback.find({ organizationId, employeeId }).sort({ submittedAt: -1, feedbackDate: -1 }).lean();
  }

  /**
   * Run or re-run NLP sentiment analysis on an existing feedback item.
   */
  async analyzeFeedback(organizationId, employeeId, feedbackId) {
    const employee = await Employee.findOne({ _id: employeeId, organizationId, isDeleted: { $ne: true } });
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found for this organization.');
    }

    const feedback = await EmployeeFeedback.findOne({ _id: feedbackId, employeeId, organizationId });
    if (!feedback) {
      throw new AppError(404, 'FEEDBACK_NOT_FOUND', 'Feedback record not found for this employee/organization.');
    }

    const cacheKey = makeNlpCacheKey(organizationId, employeeId, feedbackId, '1.0.0');
    const cached = await getCachedNlp(cacheKey);
    if (cached && cached.analyzedAt) {
      return cached;
    }

    let nlpAnalysis;
    try {
      const response = await aiClient.post('/nlp/analyze', {
        employeeId: String(employeeId),
        sourceCollection: 'employeefeedbacks',
        sourceDocumentId: String(feedbackId),
        text: feedback.feedbackText,
      });
      nlpAnalysis = response.data;
    } catch (err) {
      throw toAiServiceError(err, 'Feedback sentiment analysis failed', {
        notReadyMessage: 'NLP models are preparing. Please try again shortly.',
      });
    }

    feedback.sentiment = nlpAnalysis.sentiment;
    feedback.sentimentScore = nlpAnalysis.sentimentScore;
    feedback.confidence = nlpAnalysis.confidence;
    feedback.topics = nlpAnalysis.detectedTopics || [];
    feedback.emotionSignals = nlpAnalysis.detectedEmotions || {};
    feedback.summary = nlpAnalysis.summary || '';
    feedback.nlpProvider = 'VADER+Transformers';
    feedback.nlpModel = 'roberta-go_emotions+distilbart';
    feedback.nlpVersion = '1.0.0';
    feedback.analyzedAt = new Date();

    await feedback.save();
    const updated = feedback.toObject();
    await setCachedNlp(cacheKey, updated);
    return updated;
  }

  /**
   * Retrieve chronological sentiment timeline for an employee.
   * Scoped strictly by organizationId.
   */
  async getSentimentTimeline(employeeId, organizationId) {
    const employee = await Employee.findOne({ _id: employeeId, organizationId, isDeleted: { $ne: true } });
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee profile not found for this organization.');
    }

    const feedbackList = await EmployeeFeedback.find({ organizationId, employeeId }).sort({ submittedAt: 1, feedbackDate: 1 }).lean();
    const intelligenceList = await EmployeeIntelligence.find({ organizationId, employeeId }).sort({ generatedAt: 1 }).lean();

    const timelineEvents = [];

    for (const fb of feedbackList) {
      timelineEvents.push({
        id: String(fb._id),
        date: fb.submittedAt || fb.feedbackDate || fb.createdAt,
        type: 'FEEDBACK',
        source: fb.source || 'FEEDBACK',
        category: fb.category || 'OTHER',
        sentiment: fb.sentiment || 'Neutral',
        sentimentScore: fb.sentimentScore ?? 0.5,
        confidence: fb.confidence ?? 0.5,
        topics: fb.topics || [],
        emotionSignals: fb.emotionSignals || {},
        summary: fb.summary || fb.feedbackText || '',
        nlpVersion: fb.nlpVersion || '1.0.0',
      });
    }

    for (const intel of intelligenceList) {
      timelineEvents.push({
        id: String(intel._id),
        date: intel.generatedAt,
        type: 'AGGREGATED_INTELLIGENCE',
        source: 'AGGREGATED_NLP',
        sentiment: intel.sentiment || 'Neutral',
        sentimentScore: intel.sentimentScore ?? 0.5,
        confidence: intel.confidence ?? 0.5,
        burnoutRisk: intel.burnoutRisk || 'Low',
        burnoutScore: intel.burnoutScore ?? 0.0,
        dominantEmotion: intel.emotion || 'Satisfied',
        topics: intel.topics || [],
        summary: intel.summary || '',
        nlpVersion: '1.0.0',
      });
    }

    timelineEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      employeeId: String(employeeId),
      organizationId: String(organizationId),
      totalEvents: timelineEvents.length,
      timeline: timelineEvents,
    };
  }
}

export const employeeIntelligenceService = new EmployeeIntelligenceService();
