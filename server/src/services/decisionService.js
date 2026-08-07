import axios from 'axios';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { Decision, STATUS_VALUES } from '../models/Decision.js';
import { Employee } from '../models/Employee.js';
import { toAiServiceError } from '../utils/aiServiceError.js';
import { AppError } from '../errors/AppError.js';
import { recordAudit } from './auditService.js';
import { logger } from '../utils/logger.js';
import { acquireAiSlot, releaseAiSlot } from '../utils/aiConcurrencyGate.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

// Default budget for the single-employee call — the full ML+SHAP+NLP+RAG+LLM
// pipeline for one employee legitimately takes a while, but not this long.
// The batch call gets its own, much larger budget below.
//
// generate_batch_decisions (ai-service) now runs employees with bounded
// concurrency (semaphore of 20) instead of one at a time, but that only
// helps up to a point: measured directly against this endpoint, raising
// concurrency from 10 to 20 made essentially no difference to total wall
// time (40 employees: 9.86s either way; full ~1250-employee workforce:
// ~319.5s). The Groq call log confirms why — request timestamps cluster at
// a flat ~4/sec regardless of client-side concurrency, meaning Groq's own
// account-level rate ceiling, not this code, is the bottleneck once you're
// past a handful of concurrent requests. No amount of added concurrency
// here can exceed that external ceiling.
const AI_DEFAULT_TIMEOUT_MS = 60000;
const DECISION_JOB_POLL_INTERVAL_MS = 5000;
const DECISION_JOB_MAX_WAIT_MS = 12 * 60 * 1000; // 12 min max wait

const aiClient = axios.create({
  baseURL: AI_API_URL,
  headers: {
    Authorization: `Bearer ${AI_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: AI_DEFAULT_TIMEOUT_MS,
});

async function pollDecisionBatchJob(jobId) {
  const deadline = Date.now() + DECISION_JOB_MAX_WAIT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, DECISION_JOB_POLL_INTERVAL_MS));
    const response = await aiClient.get(`/decision/batch/status/${jobId}`);
    const { status: jobStatus, data, error } = response.data || {};
    if (jobStatus === 'completed') return data.decisions;
    if (jobStatus === 'failed') {
      const e = new Error(`Batch decision generation job failed: ${error}`);
      e.statusCode = 502;
      e.code = 'AI_SERVICE_ERROR';
      throw e;
    }
    // running, keep polling
  }
  const e = new Error(`Batch decision generation did not complete within ${DECISION_JOB_MAX_WAIT_MS / 1000}s.`);
  e.statusCode = 504;
  e.code = 'AI_SERVICE_TIMEOUT';
  throw e;
}

// ── Express-level batch job store ─────────────────────────────────────────
// Why this exists: chunking (below) fixed the ai-service container crash on
// the full workforce, but a direct production test after that fix still
// failed — not with an HTTP error, but with a bare `fetch failed` at exactly
// t=304s, no status code, no body. That is not this app's timeout (nothing
// here is configured anywhere near 304s); it is Render's own platform proxy
// severing a connection it considers held open too long, while Express was
// still mid-`await` inside the controller for what projects to ~870s total
// across ~5 chunks. Chunking alone cannot fix this: the outer HTTP
// request/response cycle itself cannot survive the platform's connection
// ceiling no matter how the work inside it is subdivided.
//
// The fix is the same shape already used for /explain/batch and the
// ai-service's own /decision/batch: the client-facing endpoint returns a
// jobId immediately (this returns in milliseconds — no network calls before
// responding), the chunked work in generateBatch() runs in the background
// via a fire-and-forget promise, and the client polls
// GET /decisions/batch/status/:jobId until it sees 'completed' or 'failed'.
// No single leg of that round trip is ever held open longer than one poll
// interval, so the platform's connection ceiling is never in play.
const _BATCH_JOBS = new Map();
const _JOB_TTL_MS = 30 * 60 * 1000; // 30 min — long enough to cover polling, short enough not to leak memory across many runs.

function _pruneOldJobs() {
  const cutoff = Date.now() - _JOB_TTL_MS;
  for (const [id, job] of _BATCH_JOBS) {
    if (job.startedAt.getTime() < cutoff) _BATCH_JOBS.delete(id);
  }
}

function mapDecisionToDoc(employeeId, organizationId, data, userId) {
  return {
    employeeId,
    organizationId,
    recommendationType: data.recommendationType,
    priority: data.priority,
    confidence: data.confidence,
    reasoning: data.reasoning,
    evidence: data.evidence || {},
    affectedFactors: data.affectedFactors || [],
    relatedPolicies: data.relatedPolicies || [],
    recommendedActions: data.recommendedActions || [],
    expectedOutcome: data.expectedOutcome || '',
    reviewDate: data.reviewDate ? new Date(data.reviewDate) : undefined,
    status: 'PENDING',
    statusHistory: [{ status: 'PENDING', changedBy: userId, changedAt: new Date(), note: 'Generated' }],
    generatedAt: data.generatedAt ? new Date(data.generatedAt) : new Date(),
    generatedBy: data.generatedBy || 'system',
  };
}

class DecisionService {
  /**
   * Get or generate the AI recommendation for one employee. Cached unless
   * forceRefresh is set OR the employee's profile has been updated more
   * recently than the cached decision — "do not regenerate unless employee
   * data changes".
   */
  async generateForEmployee(employeeId, organizationId, userId, forceRefresh = false) {
    const employee = await Employee.findById(employeeId).lean();
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    }

    if (!forceRefresh) {
      const cached = await Decision.findOne({ employeeId }).sort({ generatedAt: -1 }).lean();
      if (cached && employee.updatedAt && cached.generatedAt >= employee.updatedAt) {
        return cached;
      }
    }

    let data;
    try {
      const response = await aiClient.post('/decision/generate', {
        employeeId: String(employeeId),
        employeeData: employee,
        userId: String(userId || 'system'),
      });
      data = response.data;
    } catch (err) {
      throw toAiServiceError(err, 'Decision generation failed', {
        notReadyMessage: 'The Decision Engine is not ready yet (model/SHAP/NLP/RAG may still be initializing). Please try again shortly.',
      });
    }

    const decision = await Decision.create(mapDecisionToDoc(employeeId, organizationId, data, userId));
    logger.info('decision_generated', { employeeId, recommendationType: decision.recommendationType, priority: decision.priority, userId });
    if (userId) {
      await recordAudit(organizationId, 'RECOMMENDATION_GENERATED', userId, {
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        context: { decisionId: decision._id, recommendationType: decision.recommendationType },
      });
    }
    return decision;
  }

  /**
   * Generates recommendations for many employees at once (explicit list, a
   * department, or every ACTIVE employee), mirroring explainBatch/
   * generateEmployeeIntelligenceBatch's filtering shape.
   */
  async generateBatch(organizationId, employeeIds, departmentId, userId) {
    const filter = { organizationId };
    if (employeeIds?.length) filter._id = { $in: employeeIds };
    else if (departmentId) filter.departmentId = departmentId;
    else filter.status = 'ACTIVE';
    filter.isDeleted = false;

    const employees = await Employee.find(filter).lean();
    if (employees.length === 0) {
      return { processed: 0, failed: 0, totalCount: 0 };
    }

    // Chunked, rather than one request carrying the whole workforce. Two
    // separate production failures made this necessary, both measured
    // directly against the deployed service:
    //
    //   1. Crash on the large payload. Sending all ~1320 employees at once
    //      (a ~1.1MB body) returned 502 after ~51s and the ai-service
    //      container restarted (uptime reset to 16s). Chunks of 300 — a
    //      ~252KB body — complete cleanly.
    //   2. Total wall time. 300 employees took 197s (~0.66s each, bounded by
    //      Groq's account-level rate ceiling, not by this code). The full
    //      workforce therefore projects to ~870s, past both this service's
    //      12-minute poll ceiling AND the browser's own budget — so even
    //      without the crash it could not have finished in one request.
    //
    // Each chunk's decisions are persisted as soon as that chunk returns, so
    // a failure partway through keeps the work already done instead of
    // discarding everything. `ordered: false` keeps one bad document from
    // aborting a chunk's insert.
    const CHUNK_SIZE = 300;
    let processed = 0;
    let failed = 0;

    // Claims the single process-wide AI-heavy-job slot (see
    // aiConcurrencyGate.js) — verified via production logs that a batch
    // explain running at the same moment as a batch decision run is exactly
    // what crashed the ai-service container (two heavy jobs' memory
    // footprints landing on it together). Throws a 429 immediately if
    // another heavy job (train / explain-batch / employee-intelligence
    // batch) is already running, rather than letting them stack.
    acquireAiSlot('Generate Recommendations (batch)');
    try {
      for (let start = 0; start < employees.length; start += CHUNK_SIZE) {
        const chunk = employees.slice(start, start + CHUNK_SIZE);

        let rawDecisions;
        try {
          const response = await aiClient.post('/decision/batch', {
            employees: chunk.map((e) => ({
              employeeId: String(e._id),
              employeeData: e,
              userId: String(userId || 'system'),
            })),
          });

          const jobId = response.data?.jobId;
          if (!jobId) {
            throw new Error('No job ID returned from AI service');
          }

          rawDecisions = await pollDecisionBatchJob(jobId);
        } catch (err) {
          // Surface the failure, but only after keeping whatever earlier
          // chunks already wrote — reporting how far it got is far more
          // useful than failing the whole run silently.
          logger.error('decision_batch_chunk_failed', {
            chunkStart: start,
            chunkSize: chunk.length,
            processedBeforeFailure: processed,
            error: err.message,
          });
          if (processed > 0) {
            const e = new Error(
              `Batch decision generation stopped after ${processed}/${employees.length} employees: ${err.message}`,
            );
            e.statusCode = err.statusCode || 502;
            e.code = err.code || 'AI_SERVICE_ERROR';
            throw e;
          }
          throw toAiServiceError(err, 'Batch decision generation failed', {
            notReadyMessage: 'The Decision Engine is not ready yet. Please try again shortly.',
          });
        }

        const docs = [];
        for (const d of rawDecisions) {
          if (d.error) {
            failed += 1;
            continue;
          }
          docs.push(mapDecisionToDoc(d.employeeId, organizationId, d, userId));
        }

        if (docs.length > 0) {
          await Decision.insertMany(docs, { ordered: false });
          processed += docs.length;
        }

        logger.info('decision_batch_chunk_done', {
          chunkStart: start,
          chunkProcessed: docs.length,
          totalProcessed: processed,
          totalCount: employees.length,
        });
      }

      return { processed, failed, totalCount: employees.length };
    } finally {
      releaseAiSlot();
    }
  }

  /**
   * Kicks off generateBatch() in the background and returns a jobId
   * immediately. See the _BATCH_JOBS comment above for why this exists —
   * the request/response cycle for this call must stay short (it does no
   * chunk work itself), unlike the synchronous generateBatch() it wraps.
   */
  startBatchJob(organizationId, employeeIds, departmentId, userId) {
    _pruneOldJobs();
    const jobId = randomUUID();
    _BATCH_JOBS.set(jobId, { status: 'running', startedAt: new Date() });

    this.generateBatch(organizationId, employeeIds, departmentId, userId)
      .then((result) => {
        _BATCH_JOBS.set(jobId, { status: 'completed', startedAt: _BATCH_JOBS.get(jobId).startedAt, result });
      })
      .catch((err) => {
        logger.error('decision_batch_job_failed', { jobId, error: err.message });
        _BATCH_JOBS.set(jobId, {
          status: 'failed',
          startedAt: _BATCH_JOBS.get(jobId).startedAt,
          error: err.message,
          statusCode: err.statusCode,
          code: err.code,
        });
      });

    return { jobId };
  }

  /** Poll target for startBatchJob(). Throws 404 if the job is unknown/expired. */
  getBatchJobStatus(jobId) {
    const job = _BATCH_JOBS.get(jobId);
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Batch job not found. It may have expired or the ID is invalid.');
    }
    return job;
  }

  /** Latest decision for one employee (used by the merged AI Insights endpoint). */
  async getStored(employeeId) {
    return Decision.findOne({ employeeId }).sort({ generatedAt: -1 }).lean();
  }

  /** Full decision history for one employee. */
  async getHistory(employeeId) {
    return Decision.find({ employeeId }).sort({ generatedAt: -1 }).lean();
  }

  /**
   * HR accept/dismiss/under-review workflow. Every status change is
   * appended to statusHistory (audit trail) — restricted to HR/Admin at
   * the route layer.
   */
  async updateStatus(decisionId, status, changedByUserId, note = '') {
    if (!STATUS_VALUES.includes(status)) {
      throw new AppError(400, 'INVALID_STATUS', `Status must be one of: ${STATUS_VALUES.join(', ')}`);
    }
    const decision = await Decision.findById(decisionId);
    if (!decision) {
      throw new AppError(404, 'DECISION_NOT_FOUND', 'Decision not found.');
    }
    const fromStatus = decision.status;
    decision.status = status;
    decision.statusHistory.push({ status, changedBy: changedByUserId, changedAt: new Date(), note });
    await decision.save();
    await recordAudit(decision.organizationId, 'RECOMMENDATION_STATUS_CHANGED', changedByUserId, {
      entityType: 'EMPLOYEE',
      entityId: decision.employeeId,
      changes: { old: fromStatus, new: status },
      context: { decisionId: decision._id, note },
    });
    return decision;
  }

  // ── Dashboard analytics ─────────────────────────────────────────────────

  async getDashboardSummary(organizationId) {
    const orgObjectId = mongoose.Types.ObjectId.isValid(organizationId)
      ? new mongoose.Types.ObjectId(organizationId)
      : organizationId;

    const latestPerEmployee = await Decision.aggregate([
      { $match: { organizationId: orgObjectId } },
      { $sort: { generatedAt: -1 } },
      {
        $group: {
          _id: '$employeeId',
          decisionId: { $first: '$_id' },
          recommendationType: { $first: '$recommendationType' },
          priority: { $first: '$priority' },
          confidence: { $first: '$confidence' },
          status: { $first: '$status' },
          generatedAt: { $first: '$generatedAt' },
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

    const recommendationDistribution = {};
    const departmentBreakdown = new Map();
    const criticalEmployees = [];
    const highPriorityActions = [];

    for (const row of latestPerEmployee) {
      recommendationDistribution[row.recommendationType] = (recommendationDistribution[row.recommendationType] || 0) + 1;

      const deptKey = String(row.department?._id || 'unassigned');
      if (!departmentBreakdown.has(deptKey)) {
        departmentBreakdown.set(deptKey, { departmentId: row.department?._id || null, departmentName: row.department?.name || 'Unassigned', high: 0, medium: 0, low: 0, total: 0 });
      }
      const dept = departmentBreakdown.get(deptKey);
      dept.total += 1;
      if (row.priority === 'HIGH') dept.high += 1;
      else if (row.priority === 'MEDIUM') dept.medium += 1;
      else dept.low += 1;

      if (row.priority === 'HIGH') {
        const entry = {
          employeeId: row._id,
          employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
          departmentName: row.department?.name || 'Unassigned',
          recommendationType: row.recommendationType,
          confidence: row.confidence,
          status: row.status,
        };
        criticalEmployees.push(entry);
        if (row.status === 'PENDING') highPriorityActions.push({ ...entry, decisionId: row.decisionId });
      }
    }

    criticalEmployees.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    // Recommendation trends — monthly count, last 12 months, across ALL history (not just latest-per-employee).
    const trendRows = await Decision.aggregate([
      { $match: { organizationId: orgObjectId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$generatedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 12 },
    ]);
    const recommendationTrends = trendRows.map((r) => ({ period: r._id, count: r.count }));

    // Decision history — recent 10 across the org.
    const decisionHistory = await Decision.find({ organizationId })
      .sort({ generatedAt: -1 })
      .limit(10)
      .populate('employeeId', 'firstName lastName')
      .lean();

    // HR Action Queue — all pending decisions, priority-first.
    const priorityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const hrActionQueue = [...latestPerEmployee]
      .filter((r) => r.status === 'PENDING')
      .sort((a, b) => (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0))
      .slice(0, 20)
      .map((row) => ({
        decisionId: row.decisionId,
        employeeId: row._id,
        employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
        recommendationType: row.recommendationType,
        priority: row.priority,
      }));

    // Recommendation acceptance rate — among decisions that have reached a
    // terminal status (ACCEPTED or DISMISSED); PENDING/UNDER_REVIEW excluded
    // since they haven't been decided on yet.
    const [acceptedCount, dismissedCount] = await Promise.all([
      Decision.countDocuments({ organizationId, status: 'ACCEPTED' }),
      Decision.countDocuments({ organizationId, status: 'DISMISSED' }),
    ]);
    const decidedTotal = acceptedCount + dismissedCount;
    const acceptanceRate = decidedTotal > 0 ? Math.round((acceptedCount / decidedTotal) * 100) / 100 : null;

    return {
      totalEmployeesWithDecisions: latestPerEmployee.length,
      recommendationDistribution,
      criticalEmployees: criticalEmployees.slice(0, 10),
      highPriorityActions: highPriorityActions.slice(0, 10),
      departmentBreakdown: Array.from(departmentBreakdown.values()),
      recommendationTrends,
      decisionHistory,
      hrActionQueue,
      acceptanceRate,
      acceptedCount,
      dismissedCount,
    };
  }

  /**
   * Manager Dashboard — same shape of data as getDashboardSummary, but
   * scoped to a single department (a Department Manager's own team).
   */
  async getManagerDashboard(organizationId, departmentId) {
    const employees = await Employee.find({ organizationId, departmentId, isDeleted: false }).select('_id firstName lastName').lean();
    const employeeIds = employees.map((e) => e._id);
    const employeeNameById = new Map(employees.map((e) => [String(e._id), `${e.firstName} ${e.lastName}`]));

    const latest = await Decision.aggregate([
      { $match: { employeeId: { $in: employeeIds } } },
      { $sort: { generatedAt: -1 } },
      {
        $group: {
          _id: '$employeeId',
          decisionId: { $first: '$_id' },
          recommendationType: { $first: '$recommendationType' },
          priority: { $first: '$priority' },
          status: { $first: '$status' },
          affectedFactors: { $first: '$affectedFactors' },
        },
      },
    ]);

    const teamRisk = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    const recommendedInterventions = {};
    const concernCounts = new Map();
    const priorityEmployees = [];
    const pendingActions = [];

    for (const row of latest) {
      if (row.priority in teamRisk) teamRisk[row.priority] += 1;
      recommendedInterventions[row.recommendationType] = (recommendedInterventions[row.recommendationType] || 0) + 1;
      for (const factor of row.affectedFactors || []) {
        concernCounts.set(factor, (concernCounts.get(factor) || 0) + 1);
      }
      const name = employeeNameById.get(String(row._id)) || 'Unknown';
      if (row.priority === 'HIGH') {
        priorityEmployees.push({ employeeId: row._id, employeeName: name, recommendationType: row.recommendationType });
      }
      if (row.status === 'PENDING') {
        pendingActions.push({ decisionId: row.decisionId, employeeId: row._id, employeeName: name, recommendationType: row.recommendationType, priority: row.priority });
      }
    }

    const topConcerns = Array.from(concernCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([factor, count]) => ({ factor, count }));

    return {
      teamSize: employees.length,
      teamRisk,
      pendingActions: pendingActions.slice(0, 10),
      recommendedInterventions,
      topConcerns,
      priorityEmployees: priorityEmployees.slice(0, 10),
    };
  }
}

export const decisionService = new DecisionService();
