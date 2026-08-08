/**
 * @file analyticsService.js
 * @description Service layer for workforce analytics, KPI computation, and RBAC scope enforcement.
 *
 * Why this file exists
 * --------------------
 * Applies Role-Based Access Control (RBAC) security rules to analytics queries.
 * ADMIN and HR_MANAGER view company-wide data; DEPARTMENT_MANAGER views only their department;
 * EMPLOYEE receives personal metrics.
 */

import { ROLE_NAMES } from '../config/roles.js';
import * as analyticsRepo from '../repositories/analyticsRepository.js';

/**
 * Enforces role-based query scope restrictions.
 */
function applyRbacScope(authContext, filter = {}) {
  // organizationId is the FIRST scope applied, unconditionally, before role
  // narrows it further — every analytics query used to run with no tenant
  // scope at all (Employee/Attendance/Performance/Survey/TrainingHistory/
  // PromotionHistory/EmployeeFeedback all queried with no organizationId
  // filter), so a brand-new organization's dashboard showed the seeded
  // default organization's entire workforce. Confirmed live: signing up a
  // fresh org and loading /dashboard showed "Total Employees: 1,470" —
  // another tenant's real headcount — instead of 0.
  const scopedFilter = { ...filter, organizationId: authContext?.organizationId };
  const role = authContext?.role;

  if (role === ROLE_NAMES.ADMIN || role === ROLE_NAMES.HR_MANAGER || role === ROLE_NAMES.HR_ANALYST) {
    // Unrestricted company-wide access
    return scopedFilter;
  }

  if (role === ROLE_NAMES.DEPARTMENT_MANAGER || role === 'DEPT_MANAGER') {
    // Restrict strictly to manager's assigned department
    if (authContext.departmentId) {
      scopedFilter.departmentId = authContext.departmentId;
    }
    return scopedFilter;
  }

  if (role === ROLE_NAMES.EMPLOYEE) {
    // Restrict to personal or department scope
    if (authContext.departmentId) {
      scopedFilter.departmentId = authContext.departmentId;
    }
    return scopedFilter;
  }

  return scopedFilter;
}

/**
 * Get comprehensive dashboard overview summary.
 */
export async function getDashboardSummary(authContext, filter = {}) {
  const scopedFilter = applyRbacScope(authContext, filter);

  const [kpis, departmentStats, demographics, monthlyTrends, insights, advancedCharts] = await Promise.all([
    analyticsRepo.getKpiSummary(scopedFilter),
    analyticsRepo.getDepartmentAnalytics(scopedFilter),
    analyticsRepo.getDemographicDistributions(scopedFilter),
    analyticsRepo.getMonthlyTrends(scopedFilter),
    analyticsRepo.getEmployeeInsights(scopedFilter),
    analyticsRepo.getAdvancedCharts(scopedFilter),
  ]);

  return {
    kpis,
    departmentStats,
    demographics,
    monthlyTrends,
    insights,
    advancedCharts,
    userScope: {
      role: authContext.role,
      departmentId: authContext.departmentId || null,
      isRestricted: authContext.role !== ROLE_NAMES.ADMIN && authContext.role !== ROLE_NAMES.HR_MANAGER,
    },
  };
}

/**
 * Get standalone KPI statistics.
 */
export async function getKpis(authContext, filter = {}) {
  const scopedFilter = applyRbacScope(authContext, filter);
  return analyticsRepo.getKpiSummary(scopedFilter);
}

/**
 * Get department statistics breakdown.
 */
export async function getDepartmentStats(authContext, filter = {}) {
  const scopedFilter = applyRbacScope(authContext, filter);
  return analyticsRepo.getDepartmentAnalytics(scopedFilter);
}

/**
 * Get monthly hiring and attrition trend datasets.
 */
export async function getMonthlyTrends(authContext, filter = {}) {
  const scopedFilter = applyRbacScope(authContext, filter);
  return analyticsRepo.getMonthlyTrends(scopedFilter);
}

/**
 * Get employee demographic chart distributions.
 */
export async function getDemographics(authContext, filter = {}) {
  const scopedFilter = applyRbacScope(authContext, filter);
  return analyticsRepo.getDemographicDistributions(scopedFilter);
}

/**
 * Get employee career insights.
 */
export async function getEmployeeInsights(authContext, filter = {}) {
  const scopedFilter = applyRbacScope(authContext, filter);
  return analyticsRepo.getEmployeeInsights(scopedFilter);
}

/**
 * Get HR metrics from new collections.
 */
export async function getHrMetrics(authContext, filter = {}) {
  const scopedFilter = applyRbacScope(authContext, filter);
  return analyticsRepo.getHrMetrics(scopedFilter);
}

export async function getPerformanceAnalytics(authContext, filter = {}) {
  return analyticsRepo.getPerformanceAnalytics(applyRbacScope(authContext, filter));
}

export async function getAttendanceAnalytics(authContext, filter = {}) {
  return analyticsRepo.getAttendanceAnalytics(applyRbacScope(authContext, filter));
}

export async function getTrainingAnalytics(authContext, filter = {}) {
  return analyticsRepo.getTrainingAnalytics(applyRbacScope(authContext, filter));
}
