import { Task } from '../models/Task.js';
import { Intervention } from '../models/Intervention.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { notify, notifyByRole } from './notificationService.js';
import { interventionService } from './interventionService.js';
import { workflowService } from './workflowService.js';
import * as executiveService from './executiveService.js';
import { recordAudit } from './auditService.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_ORGANIZATION_ID } from '../config/tenancy.js';

const ESCALATION_THRESHOLD_HOURS = 24;

/**
 * This MVP is still transitioning to multi-tenancy, and User.organizationId
 * is frequently left unset on pre-existing accounts (authenticate.js falls
 * back to DEFAULT_ORGANIZATION_ID rather than requiring it on the user doc)
 * — so deriving orgs from User would find none. Task/Intervention are
 * always created with a real organizationId (every controller reads it from
 * req.auth.organizationId, resolved once in authenticate.js), so they're
 * the reliable source; the default is unioned in so the very first run
 * (before any workflow doc exists yet) still processes the one real
 * organization.
 */
async function getOrganizationIds() {
  const [taskOrgIds, interventionOrgIds] = await Promise.all([
    Task.distinct('organizationId'),
    Intervention.distinct('organizationId'),
  ]);
  const ids = new Set([...taskOrgIds, ...interventionOrgIds].map(String));
  ids.add(DEFAULT_ORGANIZATION_ID);
  return Array.from(ids);
}

async function getSystemUserId(organizationId) {
  const adminRole = await Role.findOne({ name: 'ADMIN', isSystem: true }).select('_id').lean();
  if (!adminRole) return null;
  const admin = await User.findOne({ organizationId, roleId: adminRole._id, status: 'ACTIVE' }).select('_id').lean();
  return admin?._id || null;
}

/** Job 1 — notify task owners of newly-overdue tasks (deduped: skip if an unread TASK_OVERDUE notification already exists). */
async function runOverdueTaskReminders(organizationId) {
  const overdue = await Task.find({
    organizationId,
    status: { $nin: ['COMPLETED', 'CANCELLED', 'ESCALATED'] },
    dueDate: { $ne: null, $lt: new Date() },
    ownerUserId: { $ne: null },
  }).lean();

  let notified = 0;
  for (const task of overdue) {
    const alreadyNotified = await Notification.exists({
      recipientUserId: task.ownerUserId,
      type: 'TASK_OVERDUE',
      entityId: task._id,
      isRead: false,
    });
    if (alreadyNotified) continue;
    await notify(organizationId, task.ownerUserId, {
      type: 'TASK_OVERDUE',
      severity: 'HIGH',
      title: 'Task is overdue',
      message: task.title,
      entityType: 'TASK',
      entityId: task._id,
    });
    notified += 1;
  }
  return { notified, checked: overdue.length };
}

/** Job 2 — auto-escalate tasks overdue by more than the threshold to their creator. */
async function runOverdueEscalation(organizationId) {
  const threshold = new Date(Date.now() - ESCALATION_THRESHOLD_HOURS * 60 * 60 * 1000);
  const overdue = await Task.find({
    organizationId,
    status: { $nin: ['COMPLETED', 'CANCELLED', 'ESCALATED'] },
    dueDate: { $ne: null, $lt: threshold },
  }).lean();

  const systemUserId = await getSystemUserId(organizationId);
  let escalated = 0;
  for (const task of overdue) {
    const escalateTo = task.createdByUserId;
    if (!escalateTo) continue;
    await Task.updateOne(
      { _id: task._id },
      {
        status: 'ESCALATED',
        escalatedToUserId: escalateTo,
        escalatedAt: new Date(),
        $push: { history: { action: 'ESCALATED', byUserId: systemUserId || escalateTo, at: new Date(), note: `Auto-escalated: overdue by more than ${ESCALATION_THRESHOLD_HOURS}h`, toValue: String(escalateTo) } },
      },
    );
    await notify(organizationId, escalateTo, {
      type: 'TASK_ESCALATED',
      severity: 'HIGH',
      title: 'Task auto-escalated (overdue)',
      message: task.title,
      entityType: 'TASK',
      entityId: task._id,
    });
    escalated += 1;
  }
  return { escalated, checked: overdue.length };
}

/** Job 3 — auto-close interventions whose linked tasks have all completed. */
async function runAutoCloseInterventions(organizationId) {
  const inProgress = await Intervention.find({ organizationId, status: 'IN_PROGRESS' }).lean();
  const systemUserId = await getSystemUserId(organizationId);
  let closed = 0;
  for (const intervention of inProgress) {
    const linkedTasks = await Task.find({ organizationId, sourceType: 'INTERVENTION', sourceId: intervention._id }).select('status').lean();
    if (linkedTasks.length === 0) continue;
    const allDone = linkedTasks.every((t) => t.status === 'COMPLETED');
    if (!allDone) continue;
    await interventionService.transition(intervention._id, organizationId, 'COMPLETED', systemUserId || intervention.createdByUserId, {
      note: 'Auto-closed: all linked tasks completed.',
    });
    closed += 1;
  }
  return { closed, checked: inProgress.length };
}

/** Job 4 — daily digest to HR Managers: open workload snapshot. */
async function runDailyHrDigest(organizationId) {
  const dashboard = await workflowService.getWorkflowDashboard(organizationId);
  const recipients = await notifyByRole(organizationId, ['HR_MANAGER', 'HR_ANALYST'], {
    type: 'DIGEST',
    severity: 'LOW',
    title: 'Daily HR Digest',
    message: `Pending approvals: ${dashboard.pendingApprovals} | Open interventions: ${dashboard.openInterventions} | Tasks due today: ${dashboard.tasksDueToday} | Overdue: ${dashboard.overdueTasks}`,
  });
  return { recipientCount: recipients.length };
}

/** Job 5 — weekly digest to executives: company health snapshot (reuses Sprint 8's executive dashboard, no new computation). */
async function runWeeklyExecutiveDigest(organizationId) {
  const dashboard = await executiveService.getExecutiveDashboard(organizationId, {});
  const recipients = await notifyByRole(organizationId, ['HR_DIRECTOR', 'CHRO', 'CEO'], {
    type: 'DIGEST',
    severity: 'LOW',
    title: 'Weekly Executive Digest',
    message: `Company Health Score: ${dashboard.companyHealth.score}/100 | Attrition Risk: ${dashboard.companyHealth.overallAttritionRisk}% | Critical Departments: ${dashboard.criticalDepartments.length}`,
  });
  return { recipientCount: recipients.length };
}

/** Job 6 — monthly retention summary to CHRO/HR Director (reuses Sprint 8's ROI analytics, no new computation). */
async function runMonthlyRetentionSummary(organizationId) {
  const roi = await executiveService.getRoiAnalytics(organizationId, {});
  const recipients = await notifyByRole(organizationId, ['HR_DIRECTOR', 'CHRO'], {
    type: 'DIGEST',
    severity: 'LOW',
    title: 'Monthly Retention Summary',
    message: `Estimated employees retained this period: ${roi.employeesRetained} | Hiring cost saved: $${roi.estimatedHiringCostSavedUsd.toLocaleString()}`,
  });
  return { recipientCount: recipients.length };
}

const JOBS = {
  OVERDUE_TASK_REMINDERS: runOverdueTaskReminders,
  OVERDUE_ESCALATION: runOverdueEscalation,
  AUTO_CLOSE_INTERVENTIONS: runAutoCloseInterventions,
  DAILY_HR_DIGEST: runDailyHrDigest,
  WEEKLY_EXECUTIVE_DIGEST: runWeeklyExecutiveDigest,
  MONTHLY_RETENTION_SUMMARY: runMonthlyRetentionSummary,
};

/** Runs one named job across every organization in the system; used by both the scheduler and the manual "run now" endpoint. */
async function runJob(jobName) {
  const jobFn = JOBS[jobName];
  if (!jobFn) throw new Error(`Unknown automation job: ${jobName}`);
  const orgIds = await getOrganizationIds();
  const results = [];
  for (const orgId of orgIds) {
    try {
      const result = await jobFn(orgId);
      results.push({ organizationId: orgId, ...result });
      await recordAudit(orgId, 'AUTOMATION_JOB_RUN', (await getSystemUserId(orgId)) || undefined, { context: { jobName, result } });
    } catch (err) {
      results.push({ organizationId: orgId, error: err.message });
    }
  }
  return { jobName, ranAt: new Date().toISOString(), results };
}

// ── Scheduler ────────────────────────────────────────────────────────────
// In-process interval scheduler — no external cron infra required, matching
// "no external email provider required, mock is acceptable" for Part 11.
// Intervals are deliberately short relative to the job's real-world cadence
// so the automation is actually observable during a live demo/verification
// session rather than only firing once a day/week/month in production.
const SCHEDULE = [
  { jobName: 'OVERDUE_TASK_REMINDERS', intervalMs: 60 * 60 * 1000 }, // hourly
  { jobName: 'OVERDUE_ESCALATION', intervalMs: 60 * 60 * 1000 }, // hourly
  { jobName: 'AUTO_CLOSE_INTERVENTIONS', intervalMs: 30 * 60 * 1000 }, // every 30 min
  { jobName: 'DAILY_HR_DIGEST', intervalMs: 24 * 60 * 60 * 1000 }, // daily
  { jobName: 'WEEKLY_EXECUTIVE_DIGEST', intervalMs: 7 * 24 * 60 * 60 * 1000 }, // weekly
  { jobName: 'MONTHLY_RETENTION_SUMMARY', intervalMs: 30 * 24 * 60 * 60 * 1000 }, // monthly
];

// setInterval/setTimeout delays are clamped to a signed 32-bit int
// (~24.8 days) — passing WEEKLY_EXECUTIVE_DIGEST's fine, but
// MONTHLY_RETENTION_SUMMARY's 30-day interval silently overflows to `1`,
// which would fire the job in a runaway loop instead of monthly. This
// chains setTimeout calls in safe-sized chunks so arbitrarily long
// intervals fire correctly instead of relying on setInterval directly.
const MAX_SAFE_DELAY_MS = 2 ** 31 - 1;

function safeRepeat(fn, intervalMs) {
  let cancelled = false;
  function scheduleNext(remaining) {
    if (cancelled) return;
    const chunk = Math.min(remaining, MAX_SAFE_DELAY_MS);
    const timer = setTimeout(() => {
      if (cancelled) return;
      if (remaining > chunk) {
        scheduleNext(remaining - chunk);
      } else {
        fn();
        scheduleNext(intervalMs);
      }
    }, chunk);
    timer.unref?.();
    timers.push(timer);
  }
  scheduleNext(intervalMs);
  return { cancel: () => { cancelled = true; } };
}

const timers = [];
const cancelHandles = [];
const lastRunLog = {};

function startScheduler() {
  for (const { jobName, intervalMs } of SCHEDULE) {
    const handle = safeRepeat(async () => {
      try {
        lastRunLog[jobName] = await runJob(jobName);
      } catch (err) {
        logger.error('automation_job_failed', { jobName, message: err.message });
      }
    }, intervalMs);
    cancelHandles.push(handle);
  }
  logger.info('automation_scheduler_started', { jobCount: SCHEDULE.length });
}

function stopScheduler() {
  cancelHandles.forEach((h) => h.cancel());
  cancelHandles.length = 0;
  timers.forEach(clearTimeout);
  timers.length = 0;
}

function getLastRuns() {
  return lastRunLog;
}

function listJobNames() {
  return Object.keys(JOBS);
}

export const automationService = { runJob, startScheduler, stopScheduler, getLastRuns, listJobNames };
export default automationService;
