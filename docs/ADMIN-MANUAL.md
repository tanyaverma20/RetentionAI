# Admin Manual

## Roles and permissions

| Role | Scope |
|---|---|
| `ADMIN` | Everything (`*` permission) |
| `HR_MANAGER` | Employee/HR record CRUD, workflow write (interventions/tasks), approval decisions at the HR Manager level, attachments, audit read |
| `HR_ANALYST` | Read-only employee/prediction data, workflow read, comments |
| `DEPARTMENT_MANAGER` | Own-department employee read, intervention/task write, comments, attachments |
| `EMPLOYEE` | Own profile read/write, comments, own notifications |
| `HR_DIRECTOR` | Everything `HR_MANAGER` has, plus Executive Dashboard, approval decisions at the HR Director level, automation admin |
| `CHRO` | Executive Dashboard (write), approval decisions at the CHRO level, audit read |
| `CEO` | Executive Dashboard (read-only) |

Full permission strings live in [`server/src/config/roles.js`](../server/src/config/roles.js).

## Demo accounts (seeded on first startup)

| Email | Password | Role |
|---|---|---|
| `admin@example.test` | `Admin#12345` | ADMIN |
| `hr.manager@example.test` | `HrManager#12345` | HR_MANAGER |
| `hr.director@example.test` | `HrDirector#12345` | HR_DIRECTOR |
| `chro@example.test` | `Chro#12345` | CHRO |
| `ceo@example.test` | `Ceo#12345` | CEO |
| `dept.manager@example.test` | `DeptManager#12345` | DEPARTMENT_MANAGER |
| `employee@example.test` | `Employee#12345` | EMPLOYEE (linked to `EMP-0001`) |

**Change or remove these before any real deployment** — they exist purely
to make every role/permission path testable out of the box.

## Approval chains (configurable)

Defined in [`server/src/services/approvalService.js`](../server/src/services/approvalService.js)'s
`resolveChainRoles(priority)`:
- HIGH priority → HR Manager → HR Director → CHRO (3 levels)
- MEDIUM priority → HR Manager → HR Director (2 levels)
- LOW priority → HR Manager only (1 level)

Each level enforces that only a user holding that exact role can decide it.

## Automation jobs

Six scheduled jobs run automatically (in-process, no external cron needed —
see [`server/src/services/automationService.js`](../server/src/services/automationService.js)):

| Job | Cadence | Does |
|---|---|---|
| `OVERDUE_TASK_REMINDERS` | Hourly | Notifies task owners of newly-overdue tasks |
| `OVERDUE_ESCALATION` | Hourly | Auto-escalates tasks overdue >24h to their creator |
| `AUTO_CLOSE_INTERVENTIONS` | Every 30 min | Closes interventions whose linked tasks are all complete |
| `DAILY_HR_DIGEST` | Daily | Workload snapshot to HR Managers/Analysts |
| `WEEKLY_EXECUTIVE_DIGEST` | Weekly | Company health snapshot to HR Director/CHRO/CEO |
| `MONTHLY_RETENTION_SUMMARY` | Monthly | ROI/retention snapshot to HR Director/CHRO |

Admins (ADMIN, HR_DIRECTOR) can inspect and manually trigger any job:
```bash
GET  /api/v1/automation/jobs
POST /api/v1/automation/jobs/:jobName/run
```

## Monitoring

- `GET /health` — fast liveness (no dependency calls).
- `GET /health/deep` — Mongo status, AI service status, memory/CPU, and
  rolling p50/p95 latency per pipeline category (prediction, decision,
  knowledge, dashboard). Both `server` (5000) and `ai-service` (8000) expose this pair.

## Audit and compliance

Every login/logout, RBAC denial, AI-pipeline call, workflow status change,
comment, approval decision, and export is recorded in `AuditLog`. View via
`GET /api/v1/audit` (filterable by action/entity/user/date) or export as CSV
via `GET /api/v1/audit/export`. The same collection backs the unified
activity timeline at `GET /api/v1/audit/timeline`.

## Backups

See [DATABASE.md](./DATABASE.md#backup-and-restore) — `scripts/ops/backup.sh`
should run on a schedule in any real deployment; it is not automatic.
