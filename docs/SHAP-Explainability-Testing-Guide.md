# SHAP Explainability — Testing Guide

Manual test plan for the Sprint 4 explainability feature (SHAP service, FastAPI
`/explain*` endpoints, Node integration, Employee Profile, Dashboard widgets,
and the Employee Directory "Why?" modal). See `docs/AI-Prediction-Testing-Guide.md`
for the underlying prediction pipeline this sprint reuses unchanged.

## 1. Prerequisites

Same three-process setup as the prediction testing guide (`ai-service` on 8000,
`server` on 5000, `client` on Vite dev). A model must be trained first —
`POST /api/v1/ai/train` — or `shap_cache.is_ready` stays `false` and every
explain call returns `503`.

## 2. FastAPI explain endpoints

```bash
TOKEN=""   # leave empty in dev if AI_SERVICE_TOKEN is unconfigured

# Local explanation by employee ID (DB lookup)
curl http://localhost:8000/explain/<employeeId>

# Ad-hoc explanation from raw feature values (no DB lookup)
curl -X POST http://localhost:8000/explain \
  -H "Content-Type: application/json" \
  -d '{"salary": 65000, "joiningDate": "2022-01-10", "dateOfBirth": "1990-05-15", "gender": "MALE", "employmentType": "FULL_TIME", "workLocation": "Office", "designation": "Engineer"}'

# Batch explanation — all ACTIVE employees, a department, or an explicit list
curl -X POST http://localhost:8000/explain/batch -H "Content-Type: application/json" -d '{}'
curl -X POST http://localhost:8000/explain/batch -H "Content-Type: application/json" -d '{"departmentId": "<deptId>"}'
curl -X POST http://localhost:8000/explain/batch -H "Content-Type: application/json" -d '{"employeeIds": ["<id1>", "<id2>"]}'

# Global feature importance ranking
curl "http://localhost:8000/feature-importance?n_samples=100"
```

Confirm each `/explain*` response's `data` includes: `riskScore`, `riskLevel`,
`confidence`, `baseValue`, `shapValues`, `topPositiveContributors`,
`topNegativeContributors`, `narrative`.

Error cases:
- No model trained (`shap_cache.is_ready === false`) → `503` on every endpoint above.
- Invalid/non-existent `employeeId` on `GET /explain/{id}` → `400` / `404`.
- Invalid `departmentId`/`employeeIds` on batch → `400`.
- Batch with some employees failing (e.g. corrupt record) → response still
  returns `200` with `successCount`/`failedCount`, not an aborted batch.

## 3. Node integration

```bash
TOKEN="<HR_MANAGER or ADMIN access token>"

curl -X POST http://localhost:5000/api/v1/explain/<employeeId> -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/explain/<employeeId> -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:5000/api/v1/explain/batch -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl http://localhost:5000/api/v1/explain/global/feature-importance -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/explain/global/department-drivers -H "Authorization: Bearer $TOKEN"
```

Confirm:
- The `POST` response's `data.topPositiveFactors[].displayName` /
  `.formattedValue` / `.shapValue` are populated (**not** empty arrays —
  this was the core bug this sprint fixed: the Node proxy was reading the
  wrong response shape from FastAPI and silently persisting empty
  explanations).
- `data.summary` is a non-empty, human-readable sentence.
- Calling `POST /explain/<id>` twice creates **two** documents in
  `db.explanations` (history is preserved — see §4), not one overwritten
  document.
- `GET /explain/<id>` (no prior `POST`) returns `404 EXPLANATION_NOT_FOUND`.
- Stop the ai-service process, then call any `/explain*` Node endpoint →
  Node returns `503 AI_SERVICE_UNAVAILABLE`, not a crash or hang.

## 4. Database

```js
db.explanations.find({ employeeId: ObjectId("<id>") }).sort({ generatedAt: -1 })
```

Confirm: multiple documents accumulate per employee as explanations are
regenerated (history, per the sprint's "Store explanation history"
requirement), each with `topPositiveFactors`, `topNegativeFactors`,
`shapValues` (a populated map, not `{}`), `summary`, `baseValue`, `riskScore`,
`riskLevel`, `predictionId`, `generatedAt`.

## 5. Employee Profile

1. Open an employee with no prediction/explanation yet → "AI Insights" tab
   shows "No prediction generated..." and "No SHAP explanation generated
   yet." with their respective generate buttons.
2. Click "Generate Prediction" → prediction card populates; SHAP card also
   populates (summary, risk-driver list, protective-factor list, SHAP bar
   chart).
3. Click "Refresh Explanation" → a new explanation is generated and
   replaces the displayed one (and a new history row is written per §4).
4. Stop the ai-service process, click "Refresh Explanation" → an inline
   red error banner appears in the SHAP card (not a silent no-op).

## 6. Dashboard

1. Scroll to the new "⚖️ Explainability" section (below "AI Attrition Risk
   Overview").
2. With no model trained: "Top Attrition Drivers" panel shows the
   "no global feature importance yet" empty state, not an error.
3. Train a model, reload → the horizontal bar chart renders the top
   features ranked by mean |SHAP|.
4. Click "Generate Explanations" → button shows "Generating…", then a
   confirmation message with the processed count; "Department Risk
   Drivers" populates with one row per department showing its top
   contributing feature.
5. Stop the ai-service process, reload the dashboard → the "AI Attrition
   Risk Overview" section shows a red inline error banner instead of
   silently staying blank.

## 7. Employee Directory — "Why?" modal

1. Go to Employees list, click "Why?" on any row.
2. If no explanation exists yet: modal shows "Explain This Prediction" CTA.
3. Click it → modal populates with the summary and top contributing
   factors without navigating away from the list.
4. Click "Refresh Explanation" → generates a new (forced) explanation.
5. Close and reopen the modal for the same employee → the previously
   generated explanation loads instantly (cache hit, no new FastAPI call).

## 8. Regression — Sprint 3 must be unaffected

Re-run `docs/AI-Prediction-Testing-Guide.md` §6–8 (Employee Profile
prediction card, Employee List risk badges/filters, Dashboard KPI tiles/Top
10 High Risk table) and confirm they behave exactly as before — this sprint
only added explainability surfaces and fixed integration bugs; it did not
change the prediction pipeline itself.
