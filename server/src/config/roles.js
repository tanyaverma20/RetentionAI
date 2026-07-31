export const ROLE_NAMES = Object.freeze({
  ADMIN: 'ADMIN',
  HR_MANAGER: 'HR_MANAGER',
  HR_ANALYST: 'HR_ANALYST',
  DEPARTMENT_MANAGER: 'DEPARTMENT_MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  // Sprint 8 — Executive Workforce Intelligence Center. Read-only,
  // company-wide strategic roles; distinct from HR_MANAGER (operational,
  // per-employee HR actions) since executives consume rollups/reports/
  // forecasts, not individual employee record CRUD.
  HR_DIRECTOR: 'HR_DIRECTOR',
  CHRO: 'CHRO',
  CEO: 'CEO',
});

// Sprint 9 — Enterprise Workflow Automation. Workflow permissions are
// additive to each role's existing Sprint 1-8 permission set.
const WORKFLOW_BASE = ['task.read', 'intervention.read', 'comment.write', 'notification.read', 'search.read'];

export const SYSTEM_ROLES = Object.freeze([
  { name: ROLE_NAMES.ADMIN, permissions: ['*'] },
  {
    name: ROLE_NAMES.HR_MANAGER,
    permissions: [
      'employee.read', 'prediction.read', 'intervention.write',
      ...WORKFLOW_BASE, 'task.write', 'approval.decide', 'attachment.write', 'audit.read',
    ],
  },
  {
    name: ROLE_NAMES.HR_ANALYST,
    permissions: ['employee.read', 'prediction.read', ...WORKFLOW_BASE],
  },
  {
    name: ROLE_NAMES.DEPARTMENT_MANAGER,
    permissions: ['employee.read', 'intervention.write', ...WORKFLOW_BASE, 'task.write', 'attachment.write'],
  },
  {
    name: ROLE_NAMES.EMPLOYEE,
    permissions: ['profile.read', 'profile.write', 'comment.write', 'notification.read', 'task.read'],
  },
  {
    name: ROLE_NAMES.HR_DIRECTOR,
    permissions: [
      'employee.read', 'prediction.read', 'executive.read', 'executive.write',
      ...WORKFLOW_BASE, 'task.write', 'intervention.write', 'approval.decide', 'attachment.write', 'audit.read', 'automation.admin',
    ],
  },
  {
    name: ROLE_NAMES.CHRO,
    permissions: [
      'employee.read', 'prediction.read', 'executive.read', 'executive.write',
      ...WORKFLOW_BASE, 'intervention.write', 'approval.decide', 'audit.read',
    ],
  },
  { name: ROLE_NAMES.CEO, permissions: ['executive.read', ...WORKFLOW_BASE] },
]);

/** Roles allowed to view the Executive Workforce Intelligence Center (Sprint 8, Part 10). */
export const EXECUTIVE_ROLES = Object.freeze([
  ROLE_NAMES.ADMIN,
  ROLE_NAMES.HR_DIRECTOR,
  ROLE_NAMES.CHRO,
  ROLE_NAMES.CEO,
]);

/** Roles allowed to view the HR Operations / Workflow Dashboard (Sprint 9, Part 7). */
export const WORKFLOW_DASHBOARD_ROLES = Object.freeze([
  ROLE_NAMES.ADMIN,
  ROLE_NAMES.HR_MANAGER,
  ROLE_NAMES.HR_ANALYST,
  ROLE_NAMES.DEPARTMENT_MANAGER,
  ROLE_NAMES.HR_DIRECTOR,
  ROLE_NAMES.CHRO,
]);

/** Roles that can act as an approval-chain level (Sprint 9, Part 3). */
export const APPROVAL_CHAIN_ROLES = Object.freeze([ROLE_NAMES.HR_MANAGER, ROLE_NAMES.HR_DIRECTOR, ROLE_NAMES.CHRO]);

/** Roles allowed to trigger/administer scheduled automation jobs (Sprint 9, Part 11). */
export const AUTOMATION_ADMIN_ROLES = Object.freeze([ROLE_NAMES.ADMIN, ROLE_NAMES.HR_DIRECTOR]);

/** Roles allowed to view the enterprise Audit Log viewer (Sprint 9, Part 9). */
export const AUDIT_VIEWER_ROLES = Object.freeze([
  ROLE_NAMES.ADMIN,
  ROLE_NAMES.HR_MANAGER,
  ROLE_NAMES.HR_DIRECTOR,
  ROLE_NAMES.CHRO,
]);
