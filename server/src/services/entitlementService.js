/**
 * @file entitlementService.js
 * @description Entitlement verification and tenant usage telemetry engine.
 */

import { TenantEntitlement } from '../models/TenantEntitlement.js';
import { Employee } from '../models/Employee.js';
import { User } from '../models/User.js';
import { AiTelemetry } from '../models/AiTelemetry.js';
import { Organization } from '../models/Organization.js';
import { AppError } from '../errors/AppError.js';

export const PLAN_DEFAULTS = {
  FREE: { maxEmployees: 50, maxUsers: 5, maxAiRequestsPerMonth: 100 },
  GROWTH: { maxEmployees: 500, maxUsers: 25, maxAiRequestsPerMonth: 5000 },
  ENTERPRISE: { maxEmployees: 10000, maxUsers: 500, maxAiRequestsPerMonth: 100000 },
};

export async function getOrCreateEntitlement(organizationId) {
  let entitlement = await TenantEntitlement.findOne({ organizationId });
  if (!entitlement) {
    const org = await Organization.findById(organizationId).lean();
    const plan = org?.plan || 'FREE';
    const defaults = PLAN_DEFAULTS[plan] || PLAN_DEFAULTS.FREE;
    entitlement = await TenantEntitlement.create({
      organizationId,
      plan,
      maxEmployees: org?.employeeLimit || defaults.maxEmployees,
      maxUsers: defaults.maxUsers,
      maxAiRequestsPerMonth: defaults.maxAiRequestsPerMonth,
    });
  }
  return entitlement;
}

export async function getTenantUsageSummary(organizationId) {
  const entitlement = await getOrCreateEntitlement(organizationId);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [currentEmployeeCount, currentActiveUsersCount, currentMonthAiRequests] = await Promise.all([
    Employee.countDocuments({ organizationId }),
    User.countDocuments({ organizationId, status: 'ACTIVE', deletedAt: null }),
    AiTelemetry.countDocuments({ organizationId, createdAt: { $gte: startOfMonth } }),
  ]);

  return {
    plan: entitlement.plan,
    quotas: {
      maxEmployees: entitlement.maxEmployees,
      maxUsers: entitlement.maxUsers,
      maxAiRequestsPerMonth: entitlement.maxAiRequestsPerMonth,
    },
    usage: {
      employees: currentEmployeeCount,
      activeUsers: currentActiveUsersCount,
      aiRequestsThisMonth: currentMonthAiRequests,
    },
    utilizationPercentages: {
      employees: entitlement.maxEmployees > 0 ? Math.min(100, Math.round((currentEmployeeCount / entitlement.maxEmployees) * 100)) : 0,
      activeUsers: entitlement.maxUsers > 0 ? Math.min(100, Math.round((currentActiveUsersCount / entitlement.maxUsers) * 100)) : 0,
      aiRequests: entitlement.maxAiRequestsPerMonth > 0 ? Math.min(100, Math.round((currentMonthAiRequests / entitlement.maxAiRequestsPerMonth) * 100)) : 0,
    },
  };
}

export async function checkEmployeeQuota(organizationId, incomingCount = 1) {
  const summary = await getTenantUsageSummary(organizationId);
  if (summary.usage.employees + incomingCount > summary.quotas.maxEmployees) {
    throw new AppError(
      429,
      'EMPLOYEE_QUOTA_EXCEEDED',
      `Cannot add ${incomingCount} employee(s). Organization limit of ${summary.quotas.maxEmployees} employees reached.`,
    );
  }
  return true;
}

export async function checkAiRequestQuota(organizationId) {
  const summary = await getTenantUsageSummary(organizationId);
  if (summary.usage.aiRequestsThisMonth >= summary.quotas.maxAiRequestsPerMonth) {
    throw new AppError(
      429,
      'AI_QUOTA_EXCEEDED',
      `Monthly AI request limit (${summary.quotas.maxAiRequestsPerMonth} requests) reached for plan ${summary.plan}.`,
    );
  }
  return true;
}
