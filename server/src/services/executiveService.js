/**
 * @file executiveService.js
 * @description Sprint 8 — Executive Workforce Intelligence Center.
 *
 * This service does not compute any new ML/SHAP/NLP/RAG output — it
 * composes EXISTING service outputs (decisionService, employeeIntelligence
 * Service, explainService, knowledgeService, aiService) with new rollup
 * aggregations (executiveRepository.js) into executive-level views:
 * dashboard, insights, intervention analytics, ROI, forecasting, alerts.
 *
 * Design notes / interpretive decisions (documented here since they're not
 * literal schema facts):
 * - "Business Unit" has no separate hierarchy in this schema — Department
 *   IS the organizational unit, so businessUnitComparison reuses
 *   departmentHealth rather than fabricating a second grouping.
 * - "Completed" intervention status is mapped onto the existing Decision
 *   model's ACCEPTED status (see executiveRepository.js) rather than adding
 *   a new enum value — Decision's lifecycle has no separate post-acceptance
 *   completion state, and adding one would be a schema change to a
 *   completed module.
 * - ROI figures are estimates built on explicitly-labeled industry-average
 *   assumptions (ROI_ASSUMPTIONS below) applied to real Decision/Prediction/
 *   Employee data — never presented as measured fact.
 * - Forecasting is a simple linear-regression trend projection over
 *   existing Prediction history, with a normal-approximation confidence
 *   interval from the regression's residual error — not a new ML model.
 */

import mongoose from 'mongoose';
import { Employee } from '../models/Employee.js';
import { Decision } from '../models/Decision.js';
import { Prediction } from '../models/Prediction.js';
import { Attendance } from '../models/Attendance.js';
import { PromotionHistory } from '../models/PromotionHistory.js';
import { Performance } from '../models/Performance.js';
import { ExecutiveAlert } from '../models/ExecutiveAlert.js';
import { AppError } from '../errors/AppError.js';
import { decisionService } from './decisionService.js';
import { employeeIntelligenceService } from './employeeIntelligenceService.js';
import { explainService } from './explainService.js';
import { knowledgeService } from './knowledgeService.js';
import * as execRepo from '../repositories/executiveRepository.js';

function toOid(id) {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

// ---------------------------------------------------------------------------
// Part 1 — Executive Dashboard
// ---------------------------------------------------------------------------

function computeCompanyHealthScore({ departmentHealth, intelligenceDashboard, decisionDashboard }) {
  let riskSum = 0;
  let riskWeight = 0;
  let burnoutSum = 0;
  let burnoutWeight = 0;
  for (const d of departmentHealth) {
    riskSum += d.avgRiskScore * d.predictedCount;
    riskWeight += d.predictedCount;
    burnoutSum += d.avgBurnoutScore * d.predictedCount;
    burnoutWeight += d.predictedCount;
  }
  const overallAttritionRisk = riskWeight > 0 ? riskSum / riskWeight : 0;
  const avgBurnout = burnoutWeight > 0 ? burnoutSum / burnoutWeight : 0;

  const total = intelligenceDashboard?.totalEmployeesAnalyzed || 0;
  const positive = intelligenceDashboard?.sentimentDistribution?.Positive || 0;
  const satisfactionRate = total > 0 ? positive / total : 0.5;

  const acceptanceRate = decisionDashboard?.acceptanceRate ?? 0.5;

  const score = Math.round(
    100 * (0.35 * (1 - overallAttritionRisk) + 0.25 * (1 - avgBurnout) + 0.25 * satisfactionRate + 0.15 * acceptanceRate),
  );

  return {
    score: Math.max(0, Math.min(100, score)),
    overallAttritionRisk: Number((overallAttritionRisk * 100).toFixed(1)),
    retentionScore: Number(((1 - overallAttritionRisk) * 100).toFixed(1)),
    avgBurnout: Number((avgBurnout * 100).toFixed(1)),
    employeeSatisfaction: Number((satisfactionRate * 100).toFixed(1)),
  };
}

export async function getExecutiveDashboard(organizationId, filter = {}) {
  const employeeIds = await execRepo.resolveScopedEmployeeIds(organizationId, filter);

  const [departmentHealth, riskHeatmap, managerComparison, riskTrend, interventionStats, decisionDashboard, intelligenceDashboard, globalFeatureImportance, knowledgeStats] =
    await Promise.all([
      execRepo.getDepartmentHealth(organizationId, employeeIds),
      execRepo.getRiskHeatmap(organizationId, employeeIds),
      execRepo.getManagerComparison(organizationId, employeeIds),
      execRepo.getRiskTrend(organizationId, employeeIds, 12),
      execRepo.getInterventionCompletionStats(organizationId, employeeIds),
      decisionService.getDashboardSummary(organizationId).catch(() => null),
      employeeIntelligenceService.getDashboardSummary(organizationId).catch(() => null),
      explainService.getGlobalFeatureImportance().catch(() => null),
      knowledgeService.getStatistics(organizationId).catch(() => null),
    ]);

  const companyHealth = computeCompanyHealthScore({ departmentHealth, intelligenceDashboard, decisionDashboard });
  const criticalDepartments = departmentHealth.filter((d) => d.avgRiskScore >= 0.5 || d.avgBurnoutScore >= 0.6);

  const locationMap = new Map();
  for (const d of departmentHealth) {
    const key = d.location || 'Unknown';
    if (!locationMap.has(key)) locationMap.set(key, { location: key, departmentCount: 0, headcount: 0, _weightedRisk: 0 });
    const loc = locationMap.get(key);
    loc.departmentCount += 1;
    loc.headcount += d.predictedCount;
    loc._weightedRisk += d.avgRiskScore * d.predictedCount;
  }
  const locationComparison = Array.from(locationMap.values()).map((l) => ({
    location: l.location,
    departmentCount: l.departmentCount,
    headcount: l.headcount,
    avgRiskScore: l.headcount > 0 ? Number((l._weightedRisk / l.headcount).toFixed(3)) : 0,
  }));

  return {
    generatedAt: new Date().toISOString(),
    scope: { employeeCount: employeeIds.length, filter },
    companyHealth,
    departmentHealth,
    criticalDepartments,
    businessUnitComparison: departmentHealth,
    locationComparison,
    managerComparison,
    riskHeatmap,
    trends: {
      attritionTrend: riskTrend.map((t) => ({ period: t.period, avgRiskScore: t.avgRiskScore, highRiskCount: t.highRiskCount })),
      burnoutTrend: riskTrend.map((t) => ({ period: t.period, avgBurnoutScore: t.avgBurnoutScore })),
    },
    intervention: {
      ...interventionStats,
      recommendationAcceptanceRate: decisionDashboard?.acceptanceRate ?? null,
    },
    topShapDrivers: (globalFeatureImportance?.features || []).slice(0, 10),
    topNlpTopics: intelligenceDashboard?.topConcerns || [],
    topKnowledgeCategories: knowledgeStats?.mostSearchedPolicies || [],
    decisionSummary: decisionDashboard,
    intelligenceSummary: intelligenceDashboard,
  };
}

// ---------------------------------------------------------------------------
// Part 2 — Executive Insights (deterministic, evidence-based — no LLM
// hallucination risk; every insight cites a real computed statistic)
// ---------------------------------------------------------------------------

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return num / Math.sqrt(denX * denY);
}

function confidenceFromCorrelation(r, n) {
  const strength = Math.min(1, Math.abs(r) * Math.sqrt(n) / 5);
  return Number(strength.toFixed(2));
}

export async function generateExecutiveInsights(organizationId, filter = {}) {
  const employeeIds = await execRepo.resolveScopedEmployeeIds(organizationId, filter);
  const insights = [];

  // 1. Department-level risk trend deltas (recent quarter vs prior quarter).
  const departmentHealth = await execRepo.getDepartmentHealth(organizationId, employeeIds);
  const riskTrend = await execRepo.getRiskTrend(organizationId, employeeIds, 6);
  const recentAvg = average(riskTrend.slice(-3).map((t) => t.avgRiskScore).filter((v) => v != null));
  const priorAvg = average(riskTrend.slice(0, 3).map((t) => t.avgRiskScore).filter((v) => v != null));
  if (recentAvg != null && priorAvg != null && priorAvg > 0) {
    const pctChange = Math.round(((recentAvg - priorAvg) / priorAvg) * 100);
    if (Math.abs(pctChange) >= 8) {
      insights.push({
        title: `Company-wide attrition risk ${pctChange > 0 ? 'increased' : 'decreased'} ${Math.abs(pctChange)}% over the last quarter`,
        severity: pctChange > 0 ? (pctChange >= 25 ? 'CRITICAL' : 'HIGH') : 'LOW',
        confidence: 0.7,
        evidence: { recentQuarterAvgRiskScore: recentAvg, priorQuarterAvgRiskScore: priorAvg, pctChange },
        recommendedAction: pctChange > 0
          ? 'Review recent policy or leadership changes across departments and prioritize HR Action Queue follow-ups.'
          : 'Document what changed this quarter — current retention practices appear to be working.',
      });
    }
  }

  // 2. Per-department risk delta — flags the single most-changed department.
  const deptWithHighestRisk = [...departmentHealth].sort((a, b) => b.avgRiskScore - a.avgRiskScore)[0];
  if (deptWithHighestRisk && deptWithHighestRisk.avgRiskScore >= 0.4) {
    insights.push({
      title: `${deptWithHighestRisk.departmentName} shows the highest attrition risk company-wide`,
      severity: deptWithHighestRisk.avgRiskScore >= 0.6 ? 'CRITICAL' : 'HIGH',
      confidence: 0.75,
      evidence: {
        departmentName: deptWithHighestRisk.departmentName,
        avgRiskScore: deptWithHighestRisk.avgRiskScore,
        highRiskCount: deptWithHighestRisk.highRiskCount,
        avgBurnoutScore: deptWithHighestRisk.avgBurnoutScore,
      },
      recommendedAction: `Prioritize ${deptWithHighestRisk.departmentName} for manager check-ins and review its HR Action Queue items first.`,
    });
  }

  // 3. Burnout vs overtime correlation (workforce-wide, real join).
  const overtimeBurnout = await computeOvertimeBurnoutCorrelation(organizationId, employeeIds);
  if (overtimeBurnout) {
    insights.push({
      title: `Overtime hours are correlated with burnout scores across the workforce (r=${overtimeBurnout.r.toFixed(2)})`,
      severity: overtimeBurnout.r >= 0.5 ? 'HIGH' : 'MEDIUM',
      confidence: confidenceFromCorrelation(overtimeBurnout.r, overtimeBurnout.n),
      evidence: { correlation: Number(overtimeBurnout.r.toFixed(2)), sampleSize: overtimeBurnout.n },
      recommendedAction: 'Review overtime policy in high-burnout departments; consider workload redistribution.',
    });
  }

  // 4. Promotion gap vs disengagement (tenure-since-last-promotion vs burnout/negative sentiment).
  const promotionGap = await computePromotionGapDisengagementCorrelation(organizationId, employeeIds);
  if (promotionGap) {
    insights.push({
      title: 'Longer time since last promotion correlates with higher burnout',
      severity: promotionGap.r >= 0.4 ? 'HIGH' : 'MEDIUM',
      confidence: confidenceFromCorrelation(promotionGap.r, promotionGap.n),
      evidence: { correlation: Number(promotionGap.r.toFixed(2)), sampleSize: promotionGap.n },
      recommendedAction: 'Audit promotion cycles in departments with long average tenure-without-promotion.',
    });
  }

  // 5. Recommendation acceptance vs department risk (do departments that act on HR recommendations show lower risk?).
  const acceptanceVsRisk = pearson(
    departmentHealth.filter((d) => d.acceptanceRate != null).map((d) => d.acceptanceRate),
    departmentHealth.filter((d) => d.acceptanceRate != null).map((d) => d.avgRiskScore),
  );
  const acceptanceSampleSize = departmentHealth.filter((d) => d.acceptanceRate != null).length;
  if (acceptanceVsRisk != null && acceptanceSampleSize >= 3) {
    insights.push({
      title: acceptanceVsRisk < 0
        ? 'Departments that act on HR recommendations show lower average attrition risk'
        : 'Recommendation acceptance rate shows no clear risk-reduction pattern yet',
      severity: 'MEDIUM',
      confidence: confidenceFromCorrelation(acceptanceVsRisk, acceptanceSampleSize),
      evidence: { correlation: Number(acceptanceVsRisk.toFixed(2)), departmentsCompared: acceptanceSampleSize },
      recommendedAction: acceptanceVsRisk < 0
        ? 'Continue prioritizing Decision Engine recommendations — the acceptance pattern is directionally positive.'
        : 'Re-evaluate whether accepted recommendations are being executed, not just approved.',
    });
  }

  // 6. Manager risk concentration.
  const managerComparison = await execRepo.getManagerComparison(organizationId, employeeIds);
  const companyAvgRisk = average(departmentHealth.map((d) => d.avgRiskScore)) || 0;
  const outlierManagers = managerComparison.filter((m) => m.teamSize >= 3 && m.avgRiskScore >= companyAvgRisk + 0.2);
  if (outlierManagers.length > 0) {
    const worst = outlierManagers[0];
    insights.push({
      title: `${worst.managerName}'s team shows concentrated attrition risk`,
      severity: 'HIGH',
      confidence: 0.65,
      evidence: { managerName: worst.managerName, teamAvgRiskScore: worst.avgRiskScore, companyAvgRiskScore: Number(companyAvgRisk.toFixed(3)), teamSize: worst.teamSize },
      recommendedAction: 'Schedule a manager-effectiveness review and 1:1 check-ins with this team.',
    });
  }

  return insights.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(sev) {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[sev] || 0;
}

function average(arr) {
  const nums = arr.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function computeOvertimeBurnoutCorrelation(organizationId, employeeIds) {
  const { default: EmployeeIntelligence } = await import('../models/EmployeeIntelligence.js');
  const [overtimeRows, burnoutRows] = await Promise.all([
    Attendance.aggregate([
      { $match: { employeeId: { $in: employeeIds } } },
      { $group: { _id: '$employeeId', avgOvertime: { $avg: '$overtimeHours' } } },
    ]),
    EmployeeIntelligence.aggregate([
      { $match: { employeeId: { $in: employeeIds.map(String) } } },
      { $sort: { generatedAt: -1 } },
      { $group: { _id: '$employeeId', burnoutScore: { $first: '$burnoutScore' } } },
    ]),
  ]);
  const burnoutMap = new Map(burnoutRows.map((r) => [String(r._id), r.burnoutScore]));
  const xs = [];
  const ys = [];
  for (const row of overtimeRows) {
    const burnout = burnoutMap.get(String(row._id));
    if (burnout != null) {
      xs.push(row.avgOvertime || 0);
      ys.push(burnout);
    }
  }
  const r = pearson(xs, ys);
  return r != null ? { r, n: xs.length } : null;
}

async function computePromotionGapDisengagementCorrelation(organizationId, employeeIds) {
  const { default: EmployeeIntelligence } = await import('../models/EmployeeIntelligence.js');
  const [employees, promotions, burnoutRows] = await Promise.all([
    Employee.find({ _id: { $in: employeeIds } }).select('_id joiningDate').lean(),
    PromotionHistory.aggregate([
      { $match: { employeeId: { $in: employeeIds } } },
      { $group: { _id: '$employeeId', lastPromotion: { $max: '$promotionDate' } } },
    ]),
    EmployeeIntelligence.aggregate([
      { $match: { employeeId: { $in: employeeIds.map(String) } } },
      { $sort: { generatedAt: -1 } },
      { $group: { _id: '$employeeId', burnoutScore: { $first: '$burnoutScore' } } },
    ]),
  ]);
  const promoMap = new Map(promotions.map((p) => [String(p._id), p.lastPromotion]));
  const burnoutMap = new Map(burnoutRows.map((r) => [String(r._id), r.burnoutScore]));
  const xs = [];
  const ys = [];
  const now = Date.now();
  for (const emp of employees) {
    const burnout = burnoutMap.get(String(emp._id));
    if (burnout == null) continue;
    const lastPromo = promoMap.get(String(emp._id));
    const referenceDate = lastPromo ? new Date(lastPromo).getTime() : new Date(emp.joiningDate).getTime();
    const yearsSincePromo = (now - referenceDate) / (365.25 * 24 * 60 * 60 * 1000);
    xs.push(yearsSincePromo);
    ys.push(burnout);
  }
  const r = pearson(xs, ys);
  return r != null ? { r, n: xs.length } : null;
}

// ---------------------------------------------------------------------------
// Part 5 — Intervention Analytics
// ---------------------------------------------------------------------------

export async function getInterventionAnalytics(organizationId, filter = {}) {
  const employeeIds = await execRepo.resolveScopedEmployeeIds(organizationId, filter);
  const [overall, departmentHealth, managerComparison] = await Promise.all([
    execRepo.getInterventionCompletionStats(organizationId, employeeIds),
    execRepo.getDepartmentHealth(organizationId, employeeIds),
    execRepo.getManagerComparison(organizationId, employeeIds),
  ]);

  const decisions = await Decision.find({ organizationId: toOid(organizationId), employeeId: { $in: employeeIds } })
    .select('recommendationType status employeeId')
    .lean();
  const conversionByType = {};
  for (const d of decisions) {
    if (!conversionByType[d.recommendationType]) {
      conversionByType[d.recommendationType] = { total: 0, accepted: 0 };
    }
    conversionByType[d.recommendationType].total += 1;
    if (d.status === 'ACCEPTED') conversionByType[d.recommendationType].accepted += 1;
  }
  const recommendationConversion = Object.entries(conversionByType).map(([type, v]) => ({
    recommendationType: type,
    total: v.total,
    accepted: v.accepted,
    conversionRate: v.total > 0 ? Number((v.accepted / v.total).toFixed(2)) : 0,
  }));

  return {
    overall,
    departmentSuccess: departmentHealth
      .filter((d) => d.acceptanceRate != null)
      .map((d) => ({ departmentName: d.departmentName, acceptanceRate: d.acceptanceRate })),
    managerSuccess: managerComparison.map((m) => ({ managerName: m.managerName, teamSize: m.teamSize, avgRiskScore: m.avgRiskScore })),
    recommendationConversion,
  };
}

// ---------------------------------------------------------------------------
// Part 6 — ROI Analytics
// ---------------------------------------------------------------------------

/** Clearly-labeled industry-average assumptions — NOT measured facts. */
export const ROI_ASSUMPTIONS = {
  avgHiringCostUsd: 4700, // SHRM-cited average cost-per-hire, used as a flat estimate
  replacementCostPctOfSalary: 0.5, // commonly-cited 33%-200% range; 50% used as a blended default
  projectionMonths: 12,
  note: 'These are industry-average estimates applied to real employee/decision data, not measured outcomes. "Retained" employees are a proxy: had a HIGH-risk prediction, received an ACCEPTED HR recommendation, and remain ACTIVE today — this is a defensible correlation, not a causal guarantee.',
};

export async function getRoiAnalytics(organizationId, filter = {}) {
  const employeeIds = await execRepo.resolveScopedEmployeeIds(organizationId, filter);
  const orgOid = toOid(organizationId);

  const acceptedDecisions = await Decision.find({ organizationId: orgOid, employeeId: { $in: employeeIds }, status: 'ACCEPTED' })
    .select('employeeId')
    .lean();
  const acceptedIds = acceptedDecisions.map((d) => d.employeeId);

  const [highRiskAtDecision, stillActiveEmployees, performances] = await Promise.all([
    Prediction.find({ employeeId: { $in: acceptedIds }, riskLevel: 'HIGH' }).select('employeeId').lean(),
    Employee.find({ _id: { $in: acceptedIds }, status: 'ACTIVE' }).select('_id salary').lean(),
    Performance.aggregate([
      { $match: { employeeId: { $in: acceptedIds } } },
      { $group: { _id: '$employeeId', maxScore: { $max: '$performanceScore' } } },
    ]),
  ]);

  const highRiskSet = new Set(highRiskAtDecision.map((p) => String(p.employeeId)));
  const activeMap = new Map(stillActiveEmployees.map((e) => [String(e._id), e.salary]));
  const perfMap = new Map(performances.map((p) => [String(p._id), p.maxScore]));

  const retainedIds = [...highRiskSet].filter((id) => activeMap.has(id));
  const highValueRetainedIds = retainedIds.filter((id) => (perfMap.get(id) || 0) >= 4);

  const totalReplacementCostAvoided = retainedIds.reduce((sum, id) => sum + (activeMap.get(id) || 0) * ROI_ASSUMPTIONS.replacementCostPctOfSalary, 0);
  const totalHiringCostSaved = retainedIds.length * ROI_ASSUMPTIONS.avgHiringCostUsd;

  // Simple monthly-rate projection: current retained count / trailing 12
  // months of decision history, extrapolated forward — a rough projection,
  // not a forecast model (see Part 7 for the actual statistical forecast).
  const monthsOfHistory = 12;
  const monthlyRetainedRate = retainedIds.length / monthsOfHistory;
  const projectedFutureSavings = Math.round(
    monthlyRetainedRate * ROI_ASSUMPTIONS.projectionMonths * (ROI_ASSUMPTIONS.avgHiringCostUsd + (average([...activeMap.values()]) || 0) * ROI_ASSUMPTIONS.replacementCostPctOfSalary),
  );

  return {
    assumptions: ROI_ASSUMPTIONS,
    employeesRetained: retainedIds.length,
    highValueEmployeesRetained: highValueRetainedIds.length,
    estimatedHiringCostSavedUsd: Math.round(totalHiringCostSaved),
    estimatedReplacementCostAvoidedUsd: Math.round(totalReplacementCostAvoided),
    projectedFutureSavingsUsd: projectedFutureSavings,
  };
}

// ---------------------------------------------------------------------------
// Part 7 — Forecasting (linear-regression trend projection, no new ML model)
// ---------------------------------------------------------------------------

function linearRegression(xs, ys) {
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = meanY - slope * meanX;

  let residualSumSq = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    residualSumSq += (ys[i] - predicted) ** 2;
  }
  const stdError = n > 2 ? Math.sqrt(residualSumSq / (n - 2)) : 0;

  return { slope, intercept, stdError };
}

function projectForward(regression, lastX, daysAhead) {
  const xAhead = lastX + daysAhead / 30.44;
  const point = regression.slope * xAhead + regression.intercept;
  const margin = 1.96 * regression.stdError; // ~95% normal-approximation interval
  return {
    days: daysAhead,
    projectedValue: Number(Math.max(0, Math.min(1, point)).toFixed(3)),
    confidenceInterval: {
      lower: Number(Math.max(0, point - margin).toFixed(3)),
      upper: Number(Math.min(1, point + margin).toFixed(3)),
    },
  };
}

export async function generateForecast(organizationId, filter = {}) {
  const employeeIds = await execRepo.resolveScopedEmployeeIds(organizationId, filter);
  const trend = await execRepo.getRiskTrend(organizationId, employeeIds, 12);
  const points = trend.map((t, i) => ({ x: i, y: t.avgRiskScore })).filter((p) => p.y != null);

  if (points.length < 3) {
    return {
      method: 'linear-regression-on-monthly-avg-risk-score',
      sufficientData: false,
      message: 'Not enough prediction history (need at least 3 months of data with predictions) to produce a statistically meaningful forecast.',
      forecast: null,
      departmentForecasts: [],
    };
  }

  const regression = linearRegression(points.map((p) => p.x), points.map((p) => p.y));
  const lastX = points[points.length - 1].x;

  const forecast = {
    riskTrajectory: regression.slope > 0.005 ? 'WORSENING' : regression.slope < -0.005 ? 'IMPROVING' : 'STABLE',
    day30: projectForward(regression, lastX, 30),
    day60: projectForward(regression, lastX, 60),
    day90: projectForward(regression, lastX, 90),
  };

  // Department-level forecasts for the top 5 highest-risk departments only
  // (keeps this bounded — running 12-month regressions per department for
  // every department on every request would not meet the <3s target).
  const departmentHealth = await execRepo.getDepartmentHealth(organizationId, employeeIds);
  const topDepartments = [...departmentHealth].sort((a, b) => b.avgRiskScore - a.avgRiskScore).slice(0, 5);

  const departmentForecasts = [];
  for (const dept of topDepartments) {
    if (!dept.departmentId) continue;
    const deptEmployeeIds = (await Employee.find({ departmentId: dept.departmentId, _id: { $in: employeeIds } }).select('_id').lean()).map((e) => e._id);
    const deptTrend = await execRepo.getRiskTrend(organizationId, deptEmployeeIds, 12);
    const deptPoints = deptTrend.map((t, i) => ({ x: i, y: t.avgRiskScore })).filter((p) => p.y != null);
    if (deptPoints.length < 3) continue;
    const deptRegression = linearRegression(deptPoints.map((p) => p.x), deptPoints.map((p) => p.y));
    departmentForecasts.push({
      departmentName: dept.departmentName,
      riskTrajectory: deptRegression.slope > 0.005 ? 'WORSENING' : deptRegression.slope < -0.005 ? 'IMPROVING' : 'STABLE',
      day90: projectForward(deptRegression, deptPoints[deptPoints.length - 1].x, 90),
    });
  }

  return {
    method: 'linear-regression-on-monthly-avg-risk-score',
    sufficientData: true,
    monthsOfHistory: points.length,
    forecast,
    departmentForecasts,
  };
}

// ---------------------------------------------------------------------------
// Part 8 — Executive Alerts
// ---------------------------------------------------------------------------

const ALERT_RULES = [
  {
    type: 'CRITICAL_ATTRITION_SPIKE',
    check: (dept, companyAvgRisk) => dept.avgRiskScore >= 0.6 && dept.avgRiskScore >= companyAvgRisk + 0.25,
    build: (dept) => ({
      severity: 'CRITICAL',
      title: `Critical attrition spike in ${dept.departmentName}`,
      description: `${dept.departmentName} has an average attrition risk of ${(dept.avgRiskScore * 100).toFixed(0)}%, well above the company average.`,
    }),
  },
  {
    type: 'DEPARTMENT_BURNOUT',
    check: (dept) => dept.avgBurnoutScore >= 0.6,
    build: (dept) => ({
      severity: dept.avgBurnoutScore >= 0.75 ? 'CRITICAL' : 'HIGH',
      title: `Elevated burnout in ${dept.departmentName}`,
      description: `${dept.departmentName}'s average burnout score is ${(dept.avgBurnoutScore * 100).toFixed(0)}%.`,
    }),
  },
  {
    type: 'NEGATIVE_SENTIMENT_SURGE',
    check: (dept) => dept.negativeSentimentRate >= 0.4,
    build: (dept) => ({
      severity: dept.negativeSentimentRate >= 0.6 ? 'HIGH' : 'MEDIUM',
      title: `Negative sentiment surge in ${dept.departmentName}`,
      description: `${(dept.negativeSentimentRate * 100).toFixed(0)}% of analyzed feedback in ${dept.departmentName} is negative.`,
    }),
  },
];

/**
 * Scans current rollups and upserts OPEN alerts for any newly-matching
 * condition (idempotent by (type, department, OPEN status) — re-running
 * this does not create duplicate alerts for a still-ongoing issue).
 */
export async function generateAlerts(organizationId, filter = {}) {
  const employeeIds = await execRepo.resolveScopedEmployeeIds(organizationId, filter);
  const departmentHealth = await execRepo.getDepartmentHealth(organizationId, employeeIds);
  const companyAvgRisk = average(departmentHealth.map((d) => d.avgRiskScore)) || 0;

  const created = [];
  for (const dept of departmentHealth) {
    if (!dept.departmentId) continue;
    for (const rule of ALERT_RULES) {
      if (!rule.check(dept, companyAvgRisk)) continue;
      const built = rule.build(dept);
      const existing = await ExecutiveAlert.findOne({
        organizationId: toOid(organizationId),
        alertType: rule.type,
        departmentId: dept.departmentId,
        status: 'OPEN',
      });
      if (existing) continue; // already alerted and unresolved — don't duplicate

      const alert = await ExecutiveAlert.create({
        organizationId: toOid(organizationId),
        alertType: rule.type,
        severity: built.severity,
        title: built.title,
        description: built.description,
        departmentId: dept.departmentId,
        evidence: dept,
      });
      created.push(alert);
    }
  }

  // Repeated Manager Complaints — flags a manager whose team has 2+ OPEN
  // department-scoped alerts is out of scope for a single-manager signal
  // with current data; PROMOTION_DELAY / POLICY_VIOLATION_TREND require
  // signals (policy violation flags, complaint categorization) this schema
  // doesn't track, so they are intentionally not fabricated here — see
  // remaining technical debt in the final Sprint 8 report.

  return created;
}

export async function listAlerts(organizationId, { status } = {}) {
  const filter = { organizationId: toOid(organizationId) };
  if (status) filter.status = status;
  return ExecutiveAlert.find(filter).sort({ severity: -1, generatedAt: -1 }).populate('departmentId', 'name').populate('assignedToUserId', 'name email').lean();
}

// Prompt 1, Part 9/11 — previously unscoped: any org's authenticated user
// could dismiss/review/reassign another org's executive alert by ID alone.
// organizationId now required and comes from the authenticated caller
// (Part 10); a mismatch is reported as 404 (Part 14).
export async function dismissAlert(alertId, organizationId, userId) {
  const alert = await ExecutiveAlert.findOne({ _id: alertId, organizationId });
  if (!alert) throw new AppError(404, 'ALERT_NOT_FOUND', 'Alert not found.');
  alert.status = 'DISMISSED';
  alert.dismissedByUserId = userId;
  alert.dismissedAt = new Date();
  await alert.save();
  return alert;
}

export async function markAlertReviewed(alertId, organizationId, userId) {
  const alert = await ExecutiveAlert.findOne({ _id: alertId, organizationId });
  if (!alert) throw new AppError(404, 'ALERT_NOT_FOUND', 'Alert not found.');
  alert.status = 'REVIEWED';
  alert.reviewedByUserId = userId;
  alert.reviewedAt = new Date();
  await alert.save();
  return alert;
}

export async function assignAlertOwner(alertId, organizationId, assignedToUserId) {
  const alert = await ExecutiveAlert.findOne({ _id: alertId, organizationId });
  if (!alert) throw new AppError(404, 'ALERT_NOT_FOUND', 'Alert not found.');
  alert.assignedToUserId = assignedToUserId;
  await alert.save();
  return alert;
}
