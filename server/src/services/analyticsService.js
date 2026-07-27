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
  const scopedFilter = { ...filter };
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

  const [kpis, departmentStats, demographics, monthlyTrends, insights] = await Promise.all([
    analyticsRepo.getKpiSummary(scopedFilter),
    analyticsRepo.getDepartmentAnalytics(scopedFilter),
    analyticsRepo.getDemographicDistributions(scopedFilter),
    analyticsRepo.getMonthlyTrends(scopedFilter),
    analyticsRepo.getEmployeeInsights(scopedFilter),
  ]);

  return {
    kpis,
    departmentStats,
    demographics,
    monthlyTrends,
    insights,
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

