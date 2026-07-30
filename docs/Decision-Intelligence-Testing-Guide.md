# AI Decision Intelligence Engine — Testing Guide

Manual test plan for the Sprint 7 Decision Engine (FastAPI `/decision/*`
endpoints, Node `/api/v1/decisions/*` integration, the merged Employee AI
Insights endpoint, Employee Profile "AI Recommendations" card, Dashboard
Recommendation Analytics, and the Manager Dashboard). This sprint composes
the existing ML prediction, SHAP explainer, Employee Intelligence (NLP), and
Knowledge Base (RAG) modules plus a new deterministic Business Rules engine
— it does not change any of those underlying pipelines. See
`docs/SHAP-Explainability-Testing-Guide.md`,
`docs/Employee-Intelligence-Testing-Guide.md`, and `docs/ai/rag-module.md`
for the modules this sprint reuses unchanged.

## 1. Prerequisites

Same three-process setup as prior guides (`ai-service` on 8000, `server` on
5000, `client` on Vite dev), plus MongoDB running locally
(`mongodb://localhost:27017/retentionai` by default). A model must already
be trained (`POST /api/v1/ai/train`) since the Decision Engine calls the
prediction + SHAP pipeline internally.

## 2. FastAPI decision endpoints (direct)

```bash
TOKEN="retentionai_local_token"   # matches AI_SERVICE_TOKEN in ai-service/.env

# Missing/invalid Authorization header → 401 on every route below
curl -i http://localhost:8000/decision/dashboard

# Single-employee recommendation — employeeData is the FULL employee document,
# not just an ID (FastAPI does not read Mongo for this route; Node fetches
# the employee and forwards it).
curl -X POST http://localhost:8000/decision/generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"employeeId": "<id>", "employeeData": { "...": "full employee doc" }, "userId": "system"}'

curl -X POST http://localhost:8000/decision/batch \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"employees": [{"employeeId": "<id1>", "employeeData": {...}}, {"employeeId": "<id2>", "employeeData": {...}}]}'

curl http://localhost:8000/decision/dashboard -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/decision/history -H "Authorization: Bearer $TOKEN"
curl http://localhost:8000/decision/<employeeId> -H "Authorization: Bearer $TOKEN"
```

Confirm:
- `/decision/generate` response includes `employeeId`, `recommendationType`
  (one of the 12 fixed taxonomy values — see
  `ai-service/app/decision/rules/rule_engine.py`), `priority`, `confidence`,
  `reasoning`, `evidence` (an object citing `prediction`, `shap`,
  `employeeIntelligence`, `knowledgeBase`, and `businessRules` — not an empty
  object), `affectedFactors`, `relatedPolicies`, `expectedOutcome`,
  `reviewDate`, `generatedAt`.
- `/decision/batch` with N employees returns `processedCount === N` and one
  decision per employee; a malformed employee in the batch shows up as an
  `error` field on its entry, not an aborted batch.
- `/decision/dashboard` and `/decision/history` return `200` (with empty/zero
  values, not an error) even before any decision has ever been generated.

## 3. Node integration — `/api/v1/decisions`

```bash
TOKEN="<HR_MANAGER or ADMIN access token>"
NON_HR_TOKEN="<EMPLOYEE or MANAGER access token>"

# Generation and status changes are HR/Admin-only
curl -i -X POST http://localhost:5000/api/v1/decisions/<employeeId>/generate -H "Authorization: Bearer $NON_HR_TOKEN"
# → expect 403

curl -X POST http://localhost:5000/api/v1/decisions/<employeeId>/generate -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/decisions/<employeeId> -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/decisions/<employeeId>/history -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:5000/api/v1/decisions/batch -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl -X PATCH http://localhost:5000/api/v1/decisions/status/<decisionId> -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status": "ACCEPTED", "note": "Approved by HR"}'
curl http://localhost:5000/api/v1/decisions/dashboard/summary -H "Authorization: Bearer $TOKEN"
curl "http://localhost:5000/api/v1/decisions/dashboard/manager?departmentId=<deptId>" -H "Authorization: Bearer $TOKEN"
```

Confirm:
- Calling `POST /:employeeId/generate` twice **without** `?refresh=true`
  returns the same cached decision (no new document) as long as the
  employee record hasn't changed since — confirm via §4 that a second call
  does not add a row to `db.decisions`.
- Updating the employee's profile (e.g. a promotion, a salary change) and
  then calling generate again (still without `refresh=true`) **does**
  regenerate, because `employee.updatedAt` is now newer than the cached
  decision's `generatedAt`.
- `PATCH /status/:id` with an invalid `status` value → `400 INVALID_STATUS`.
- `GET /:employeeId` before any generation → `404 DECISION_NOT_FOUND`.
- Stop the ai-service process, call `POST /:employeeId/generate` → Node
  returns a `503`-style AI-unavailable error, not a crash or hang.

## 4. Database

```js
db.decisions.find({ employeeId: ObjectId("<id>") }).sort({ generatedAt: -1 })
```

Confirm:
- Each generation **inserts** a new document (history preserved), never
  overwrites — `statusHistory` starts with a single `PENDING` entry written
  at generation time.
- After a `PATCH /status/:id` call, the document's `status` field changed
  AND `statusHistory` has a new entry appended (not replaced) — the audit
  trail of every status change is preserved.
- Separately, `ai-service`'s own `decisions` Mongo collection
  (`db.decisions` in FastAPI's process — same physical database, a distinct
  append-only log) gains one row per `/decision/generate` or `/decision/batch`
  call, independent of Node's canonical `Decision` documents. This is the
  "log every recommendation generation" audit trail required by the sprint.

## 5. Employee Profile — merged AI request

```bash
curl http://localhost:5000/api/v1/employees/<employeeId>/ai-insights -H "Authorization: Bearer $TOKEN"
```

Confirm the single response contains `prediction`, `explanation`,
`intelligence`, **and** `decision` keys together — this is the "one AI
request" endpoint the Employee Profile page calls on mount instead of four
separate calls.

1. Open an employee with no decision yet → "AI Recommendations" card shows
   an empty state with a "Generate Recommendation" action (HR/Admin only;
   read-only viewers should not see the action button).
2. Click it → card populates with recommendation type badge, priority,
   confidence, reasoning, affected factors, related policies, expected
   outcome, and review date.
3. Click "Accept" / "Dismiss" / "Mark Under Review" → status badge updates
   immediately and a new row is appended to the decision's `statusHistory`
   (verify via §4).
4. Click "Refresh" → regenerates and replaces the displayed card (new
   history row per §4, old one preserved).
5. Stop the ai-service process, click "Generate Recommendation" → an inline
   red error banner appears in the card, not a silent no-op.

## 6. Dashboard — Recommendation Analytics

1. Scroll to the "🎯 AI Recommendations" section.
2. With zero decisions generated org-wide: KPI tiles show `0`, and the
   distribution/trends charts show their empty states, not errors.
3. Click "Generate Recommendations" (batch) → KPI tiles populate:
   Employees with Recommendations, Acceptance Rate, HR Action Queue size.
4. Confirm each widget renders real data: Recommendation Distribution
   (bar chart), Recommendation Trends (monthly line chart), Critical
   Employees, High Priority Actions, Department Recommendations, Decision
   History, HR Action Queue — each employee-linked row navigates to
   `/employees/:id`.
5. Accept/Dismiss a few recommendations from Employee Profile, reload the
   Dashboard → Acceptance Rate reflects the new ratio.

## 7. Manager Dashboard

1. Log in as a user with a `departmentId`, navigate to **Manager
   Dashboard** in the sidebar (under "Overview").
2. Confirm Team Risk tiles (High/Medium/Low), Priority Employees, Pending
   Actions, Recommended Interventions, and Top Concerns are all scoped to
   that department only (compare against `?departmentId=` results from
   §3) — verify by checking another department's data is **not** mixed in.
3. A department with zero decisions generated shows the empty states for
   each widget, not errors.

## 8. RBAC

- A non-HR/Admin user calling any write action (`generate`, `batch`,
  `status/:id`) → `403`.
- Any authenticated user (including read-only roles) can `GET` a decision,
  its history, the dashboard summary, and the manager dashboard for their
  own department.

## 9. Regression — prior sprints must be unaffected

Re-run `docs/AI-Prediction-Testing-Guide.md`,
`docs/SHAP-Explainability-Testing-Guide.md`, and
`docs/Employee-Intelligence-Testing-Guide.md` end-to-end and confirm they
behave exactly as before — this sprint only adds the Decision Engine on top
of those pipelines and merges their read into one endpoint; it does not
change prediction, SHAP, NLP, or RAG logic itself.
