/**
 * @file executiveRepository.js
 * @description Sprint 8 — new aggregations for the Executive Workforce
 * Intelligence Center that aren't already covered by analyticsRepository.js/
 * decisionService.js/employeeIntelligenceService.js/explainService.js. Every
 * function here reads EXISTING collections only (Employee, Department,
 * Prediction, PredictionHistory, Decision, EmployeeIntelligence) — no new
 * per-employee data is computed; this is a rollup layer on top of what the
 * existing AI pipeline already produced.
 */

import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Prediction } from '../models/Prediction.js';
import { PredictionHistory } from '../models/PredictionHistory.js';
import { Decision } from '../models/Decision.js';

function toOid(id) {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

/**
 * Builds an executive-scope Employee match filter. Extends
 * analyticsRepository.js's buildMatchFilter with the additional Sprint 8
 * filter dimensions (Part 4): location, manager, gender, experience range,
 * performance — Risk/Burnout/Sentiment are applied downstream (they live on
 * Prediction/EmployeeIntelligence, not Employee) via filterEmployeeIdsByAiScope.
 */
export function buildExecutiveMatchFilter(filter = {}) {
  const match = { isDeleted: false };

  if (filter.departmentId) match.departmentId = toOid(filter.departmentId);
  if (filter.managerId) match.managerId = toOid(filter.managerId);
  if (filter.gender) match.gender = filter.gender;
  if (filter.role || filter.designation) match.designation = new RegExp(filter.role || filter.designation, 'i');
  if (filter.employmentType) match.employmentType = filter.employmentType;
  if (filter.status) match.status = filter.status;

  if (filter.startDate || filter.endDate) {
    match.joiningDate = {};
    if (filter.startDate) match.joiningDate.$gte = new Date(filter.startDate);
    if (filter.endDate) match.joiningDate.$lte = new Date(filter.endDate);
  }

  return match;
}

/** Applies the Experience (years of tenure) filter, which needs a computed
 * field rather than a plain match, so it's handled as a post-filter. */
function withinExperienceRange(employee, filter) {
  if (filter.minExperienceYears == null && filter.maxExperienceYears == null) return true;
  const years = (Date.now() - new Date(employee.joiningDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (filter.minExperienceYears != null && years < Number(filter.minExperienceYears)) return false;
  if (filter.maxExperienceYears != null && years > Number(filter.maxExperienceYears)) return false;
  return true;
}

/**
 * Resolves the final scoped employee _id list for executive queries,
 * applying Employee-level filters plus the AI-derived ones (Risk, Burnout,
 * Sentiment, Performance) that live on Prediction/EmployeeIntelligence/
 * Performance rather than Employee itself.
 */
export async function resolveScopedEmployeeIds(organizationId, filter = {}) {
  const match = { organizationId: toOid(organizationId), ...buildExecutiveMatchFilter(filter) };
  let employees = await Employee.find(match).select('_id joiningDate').lean();

  if (filter.minExperienceYears != null || filter.maxExperienceYears != null) {
    employees = employees.filter((e) => withinExperienceRange(e, filter));
  }
  let ids = employees.map((e) => e._id);

  if (filter.riskLevel) {
    const risky = await Prediction.find({ employeeId: { $in: ids }, riskLevel: filter.riskLevel }).select('employeeId').lean();
    const riskySet = new Set(risky.map((r) => String(r.employeeId)));
    ids = ids.filter((id) => riskySet.has(String(id)));
  }

  if (filter.minPerformance != null) {
    const { Performance } = await import('../models/Performance.js');
    const rows = await Performance.aggregate([
      { $match: { employeeId: { $in: ids } } },
      { $group: { _id: '$employeeId', score: { $max: '$performanceScore' } } },
      { $match: { score: { $gte: Number(filter.minPerformance) } } },
    ]);
    const perfSet = new Set(rows.map((r) => String(r._id)));
    ids = ids.filter((id) => perfSet.has(String(id)));
  }

  if (filter.burnoutRisk || filter.sentiment) {
    const { default: EmployeeIntelligence } = await import('../models/EmployeeIntelligence.js');
    const eiMatch = { employeeId: { $in: ids.map(String) } };
    if (filter.burnoutRisk) eiMatch.burnoutRisk = filter.burnoutRisk;
    if (filter.sentiment) eiMatch.sentiment = filter.sentiment;
    const rows = await EmployeeIntelligence.find(eiMatch).select('employeeId').lean();
    const eiSet = new Set(rows.map((r) => String(r.employeeId)));
    ids = ids.filter((id) => eiSet.has(String(id)));
  }

  return ids;
}

/**
 * Risk Heatmap — Department x Risk Level matrix, from the latest Prediction
 * per employee (reused, not recomputed).
 */
export async function getRiskHeatmap(organizationId, employeeIds) {
  return Prediction.aggregate([
    { $match: { organizationId: toOid(organizationId), employeeId: { $in: employeeIds } } },
    {
      $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' },
    },
    { $unwind: '$employee' },
    {
      $lookup: { from: 'departments', localField: 'employee.departmentId', foreignField: '_id', as: 'department' },
    },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { departmentId: '$employee.departmentId', riskLevel: '$riskLevel' },
        departmentName: { $first: { $ifNull: ['$department.name', 'Unassigned'] } },
        count: { $sum: 1 },
        avgRiskScore: { $avg: '$riskScore' },
      },
    },
    {
      $group: {
        _id: '$_id.departmentId',
        departmentName: { $first: '$departmentName' },
        levels: { $push: { level: '$_id.riskLevel', count: '$count', avgRiskScore: { $round: ['$avgRiskScore', 3] } } },
        totalPredicted: { $sum: '$count' },
      },
    },
    { $sort: { totalPredicted: -1 } },
  ]);
}

/**
 * Department Health — composite per-department rollup: headcount, avg
 * attrition risk, avg burnout, avg sentiment (positive %), decision
 * acceptance rate. This is the "Department Health" / "Critical Departments"
 * widget's data source (Part 1).
 */
export async function getDepartmentHealth(organizationId, employeeIds) {
  const orgOid = toOid(organizationId);

  const [predictionRows, intelligenceRows, decisionRows, deptRows] = await Promise.all([
    Prediction.aggregate([
      { $match: { organizationId: orgOid, employeeId: { $in: employeeIds } } },
      { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' } },
      { $unwind: '$employee' },
      {
        $group: {
          _id: '$employee.departmentId',
          avgRiskScore: { $avg: '$riskScore' },
          highRiskCount: { $sum: { $cond: [{ $eq: ['$riskLevel', 'HIGH'] }, 1, 0] } },
          predictedCount: { $sum: 1 },
        },
      },
    ]),
    (async () => {
      const { default: EmployeeIntelligence } = await import('../models/EmployeeIntelligence.js');
      return EmployeeIntelligence.aggregate([
        { $match: { organizationId: orgOid, employeeId: { $in: employeeIds.map(String) } } },
        { $sort: { generatedAt: -1 } },
        { $group: { _id: '$employeeId', sentiment: { $first: '$sentiment' }, burnoutScore: { $first: '$burnoutScore' } } },
        { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'employee' } },
        { $unwind: '$employee' },
        {
          $group: {
            _id: '$employee.departmentId',
            avgBurnoutScore: { $avg: '$burnoutScore' },
            positiveSentimentCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'Positive'] }, 1, 0] } },
            negativeSentimentCount: { $sum: { $cond: [{ $eq: ['$sentiment', 'Negative'] }, 1, 0] } },
            intelligenceCount: { $sum: 1 },
          },
        },
      ]);
    })(),
    Decision.aggregate([
      { $match: { organizationId: orgOid, employeeId: { $in: employeeIds } } },
      { $sort: { generatedAt: -1 } },
      { $group: { _id: '$employeeId', status: { $first: '$status' }, departmentSnapshot: { $first: '$employeeId' } } },
      { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'employee' } },
      { $unwind: '$employee' },
      {
        $group: {
          _id: '$employee.departmentId',
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'ACCEPTED'] }, 1, 0] } },
          dismissed: { $sum: { $cond: [{ $eq: ['$status', 'DISMISSED'] }, 1, 0] } },
          decided: { $sum: { $cond: [{ $in: ['$status', ['ACCEPTED', 'DISMISSED']] }, 1, 0] } },
        },
      },
    ]),
    (async () => {
      const { Department } = await import('../models/Department.js');
      return Department.find({}).select('_id name code location').lean();
    })(),
  ]);

  const byDept = new Map();
  const ensure = (id) => {
    const key = String(id || 'unassigned');
    if (!byDept.has(key)) {
      const dept = deptRows.find((d) => String(d._id) === key);
      byDept.set(key, {
        departmentId: id || null,
        departmentName: dept?.name || 'Unassigned',
        location: dept?.location || 'Unknown',
        avgRiskScore: 0,
        highRiskCount: 0,
        predictedCount: 0,
        avgBurnoutScore: 0,
        positiveSentimentRate: 0,
        negativeSentimentRate: 0,
        acceptanceRate: null,
      });
    }
    return byDept.get(key);
  };

  for (const row of predictionRows) {
    const entry = ensure(row._id);
    entry.avgRiskScore = Number((row.avgRiskScore || 0).toFixed(3));
    entry.highRiskCount = row.highRiskCount;
    entry.predictedCount = row.predictedCount;
  }
  for (const row of intelligenceRows) {
    const entry = ensure(row._id);
    entry.avgBurnoutScore = Number((row.avgBurnoutScore || 0).toFixed(3));
    entry.positiveSentimentRate = row.intelligenceCount ? Number((row.positiveSentimentCount / row.intelligenceCount).toFixed(2)) : 0;
    entry.negativeSentimentRate = row.intelligenceCount ? Number((row.negativeSentimentCount / row.intelligenceCount).toFixed(2)) : 0;
  }
  for (const row of decisionRows) {
    const entry = ensure(row._id);
    entry.acceptanceRate = row.decided > 0 ? Number((row.accepted / row.decided).toFixed(2)) : null;
  }

  return Array.from(byDept.values()).sort((a, b) => b.avgRiskScore - a.avgRiskScore);
}

/** Manager Comparison (Part 1) — same shape of rollup as department health, grouped by managerId instead. */
export async function getManagerComparison(organizationId, employeeIds) {
  const orgOid = toOid(organizationId);
  const rows = await Prediction.aggregate([
    { $match: { organizationId: orgOid, employeeId: { $in: employeeIds } } },
    { $lookup: { from: 'employees', localField: 'employeeId', foreignField: '_id', as: 'employee' } },
    { $unwind: '$employee' },
    { $match: { 'employee.managerId': { $ne: null } } },
    {
      $group: {
        _id: '$employee.managerId',
        avgRiskScore: { $avg: '$riskScore' },
        highRiskCount: { $sum: { $cond: [{ $eq: ['$riskLevel', 'HIGH'] }, 1, 0] } },
        teamSize: { $sum: 1 },
      },
    },
    { $lookup: { from: 'employees', localField: '_id', foreignField: '_id', as: 'manager' } },
    { $unwind: '$manager' },
    {
      $project: {
        _id: 0,
        managerId: '$_id',
        managerName: { $concat: ['$manager.firstName', ' ', '$manager.lastName'] },
        avgRiskScore: { $round: ['$avgRiskScore', 3] },
        highRiskCount: 1,
        teamSize: 1,
      },
    },
    { $sort: { avgRiskScore: -1 } },
    { $limit: 20 },
  ]);
  return rows;
}

/**
 * Attrition Trend / Burnout Trend (Part 1) — monthly time series over the
 * last N months. Uses PredictionHistory (insert-per-generation, full
 * history preserved), NOT Prediction (which is upserted to hold only the
 * latest prediction per employee — grouping that by month would just show
 * "when was each employee's current prediction generated", not a real
 * trend). This is also the raw input Forecasting (Part 7) projects from.
 */
export async function getRiskTrend(organizationId, employeeIds, months = 12) {
  const orgOid = toOid(organizationId);
  const since = new Date();
  since.setMonth(since.getMonth() - (months - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const [riskRows, burnoutRows] = await Promise.all([
    PredictionHistory.aggregate([
      { $match: { organizationId: orgOid, employeeId: { $in: employeeIds }, predictedAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$predictedAt' }, month: { $month: '$predictedAt' } },
          avgRiskScore: { $avg: '$riskScore' },
          highRiskCount: { $sum: { $cond: [{ $eq: ['$riskLevel', 'HIGH'] }, 1, 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
    (async () => {
      const { default: EmployeeIntelligence } = await import('../models/EmployeeIntelligence.js');
      return EmployeeIntelligence.aggregate([
        { $match: { organizationId: orgOid, employeeId: { $in: employeeIds.map(String) }, generatedAt: { $gte: since } } },
        {
          $group: {
            _id: { year: { $year: '$generatedAt' }, month: { $month: '$generatedAt' } },
            avgBurnoutScore: { $avg: '$burnoutScore' },
            count: { $sum: 1 },
          },
        },
      ]);
    })(),
  ]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trend = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(since.getFullYear(), since.getMonth() + i, 1);
    const yr = d.getFullYear();
    const m = d.getMonth() + 1;
    const risk = riskRows.find((r) => r._id.year === yr && r._id.month === m);
    const burnout = burnoutRows.find((r) => r._id.year === yr && r._id.month === m);
    trend.push({
      period: `${monthNames[d.getMonth()]} ${yr}`,
      year: yr,
      month: m,
      avgRiskScore: risk ? Number(risk.avgRiskScore.toFixed(3)) : null,
      highRiskCount: risk ? risk.highRiskCount : 0,
      predictionCount: risk ? risk.count : 0,
      avgBurnoutScore: burnout ? Number(burnout.avgBurnoutScore.toFixed(3)) : null,
    });
  }
  return trend;
}

/**
 * Intervention completion time (Part 5) — time from a Decision's
 * generation to its first non-PENDING status change (i.e. time-to-first-
 * action), computed from the existing statusHistory array. No new field —
 * pure derivation from data the Decision Engine already writes.
 */
export async function getInterventionCompletionStats(organizationId, employeeIds) {
  const decisions = await Decision.find({ organizationId: toOid(organizationId), employeeId: { $in: employeeIds } })
    .select('status generatedAt statusHistory employeeId')
    .lean();

  let totalMs = 0;
  let resolvedCount = 0;
  const byStatus = { PENDING: 0, ACCEPTED: 0, DISMISSED: 0, UNDER_REVIEW: 0 };

  for (const d of decisions) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
    const firstAction = (d.statusHistory || []).find((h) => h.status !== 'PENDING');
    if (firstAction) {
      totalMs += new Date(firstAction.changedAt).getTime() - new Date(d.generatedAt).getTime();
      resolvedCount += 1;
    }
  }

  const avgCompletionHours = resolvedCount > 0 ? Number((totalMs / resolvedCount / (1000 * 60 * 60)).toFixed(1)) : null;
  const decided = byStatus.ACCEPTED + byStatus.DISMISSED;

  return {
    totalCreated: decisions.length,
    accepted: byStatus.ACCEPTED,
    rejected: byStatus.DISMISSED,
    // "Completed" is mapped onto ACCEPTED — this Decision lifecycle has no
    // separate post-acceptance completion state (see executiveService.js
    // header comment for why this mapping was chosen over adding one).
    completed: byStatus.ACCEPTED,
    pending: byStatus.PENDING + byStatus.UNDER_REVIEW,
    avgCompletionTimeHours: avgCompletionHours,
    successRate: decided > 0 ? Number((byStatus.ACCEPTED / decided).toFixed(2)) : null,
  };
}
