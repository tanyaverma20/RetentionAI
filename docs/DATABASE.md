# Database Documentation

MongoDB, accessed via Mongoose (`server/`) and Motor (`ai-service/`) —
both connect to the **same** database (`retentionai` by default); the
FastAPI service writes ML/NLP outputs, the Express server owns everything else.

## Collection groups

**HRMS core:** `employees`, `departments`, `users`, `roles`, `refreshtokens`,
`attendances`, `performances`, `traininghistories`, `promotionhistories`,
`surveys`, `employeefeedbacks`, `managernotes`.

**AI pipeline (written by `ai-service`, read by `server`):** `predictions`
(upserted — latest per employee), `predictionhistories` (insert-per-generation,
powers trend charts), `explanations` (SHAP, insert-per-generation),
`employeeintelligences` (NLP, insert-per-generation), `knowledgedocuments`
(RAG source documents), `decisions` (AI recommendations, insert-per-generation).

**Executive:** `executivealerts`.

**Workflow automation:** `interventions`, `tasks`, `approvals`,
`notifications`, `notificationpreferences`, `comments`, `attachments`.

**Compliance:** `auditlogs` — backs both the audit-log viewer and the
activity timeline (one collection, two read views).

## Key relationships

```
Employee ──< departmentId  →  Department
Employee ──< managerId     →  Employee (self-referential)
Employee ──> userId        ↔  User.employeeId   (bidirectional, self-service login link)
Decision ──> employeeId    →  Employee
Intervention ──> decisionId → Decision (optional — may be created manually)
Intervention ──> employeeId → Employee
Task ──> sourceId          → Intervention | Decision (polymorphic via sourceType)
Approval ──> entityId      → Intervention | Task (polymorphic via entityType)
Comment/Attachment ──> entityId → any of: Employee, Decision, Intervention, Task, Report, Comment
```

Referential integrity across all of the above is verified by
[`server/scripts/check-consistency.js`](../server/scripts/check-consistency.js)
— run it after any restore, migration, or bulk import:
```bash
cd server && node --env-file=.env scripts/check-consistency.js
```

## Indexes

Every collection is indexed for its primary query patterns (organization +
status/priority compounds for workflow entities, entity+date for
audit/comments, unique compounds for department codes/employee codes/user
emails). List them for any collection:
```js
db.tasks.getIndexes()
```

## Connection pooling

Configured in [`server/src/config/database.js`](../server/src/config/database.js):
`maxPoolSize: 20`, `minPoolSize: 2`. See
[Load-Testing-Report.md](./Load-Testing-Report.md) for what this ceiling
looks like under concurrent load and where it may need tuning for your
deployment's traffic.

## Backup and restore

```bash
./scripts/ops/backup.sh                                    # → backups/retentionai_<timestamp>.archive.gz
./scripts/ops/restore.sh backups/retentionai_<timestamp>.archive.gz   # destructive — prompts for confirmation
```

Both require the MongoDB Database Tools (`mongodump`/`mongorestore`) on the
host running them — already present in the official `mongo:7` Docker image.

## Migrations

`ai-service` runs one idempotent startup migration
([`app/utils/migrations.py`](../ai-service/app/utils/migrations.py)) that
reconciles a historical collection-naming mismatch between raw Motor writes
and Mongoose's pluralization convention. It's safe to run on every startup —
a no-op once already applied.
