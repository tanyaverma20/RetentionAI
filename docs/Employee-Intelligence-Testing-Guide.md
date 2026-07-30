# Employee Intelligence (NLP) — Testing Guide

Manual test plan for the Employee Intelligence sprint: the NLP pipeline
taxonomy remap, the new FastAPI endpoints, MongoDB persistence, the merged
AI-insights API, Employee Profile integration, Dashboard widgets, Directory
filters, caching, and history.

## 1. Prerequisites

Same three-process setup as prior sprints (`ai-service` on 8000, `server` on
5000, `client` on Vite dev). Seed at least a few `EmployeeFeedback`, `Survey`
(with `surveyComments`), and `ManagerNote` records with real sentences for a
handful of employees — the pipeline has nothing to analyze otherwise.

## 2. Critical regression check first

Before testing anything new, confirm the pre-existing bug this sprint fixed
is actually gone:

```bash
curl http://localhost:8000/nlp/dashboard
```

This must return `200` with real JSON (previously `500` — `await get_db()`
was awaiting a non-async function). If this still 500s, stop and recheck
`ai-service/app/nlp/repository.py`.

## 3. FastAPI endpoints

```bash
# Sentiment only (no DB lookup)
curl -X POST http://localhost:8000/sentiment -H "Content-Type: application/json" \
  -d '{"text": "I am so frustrated with the constant overtime and no recognition."}'

curl -X POST http://localhost:8000/sentiment/batch -H "Content-Type: application/json" \
  -d '{"texts": ["I love my team!", "This workload is unbearable."]}'

# Full pipeline for one employee (pulls their Feedback/Survey/ManagerNote text)
curl -X POST http://localhost:8000/employee-intelligence -H "Content-Type: application/json" \
  -d '{"employeeId": "<employee_object_id>"}'

curl http://localhost:8000/employee-intelligence/<employee_object_id>

curl http://localhost:8000/employee-intelligence/dashboard
```

Confirm:
- `/sentiment` returns `Positive`/`Neutral`/`Negative` with a 0-1 score.
- `/employee-intelligence` response includes `emotion` (one of Happy,
  Satisfied, Frustrated, Stressed, Burned Out, Demotivated),
  `burnoutRisk` (Low/Medium/High — categorical, not a raw score), `topics`
  drawn from the required taxonomy (Compensation, Manager, Promotion,
  Training, Culture, Workload, Recognition, Work-Life Balance, Learning,
  Team, or the extras Benefits/Performance/Other), `keywords`, `confidence`,
  and a natural-language `summary`.
- An employee with **no** feedback/survey/note text returns `dataPoints: 0`
  and a graceful "no text available yet" summary — not an error.
- Invalid `employeeId` format → `400`. Non-existent employee → `404`.
- Stop the ai-service, hit any Node `/employee-intelligence*` endpoint below
  → Node returns `503 AI_SERVICE_UNAVAILABLE`.

## 4. Caching (no recompute on unchanged text)

1. Call `POST /nlp/analyze` twice with the exact same `sourceDocumentId` and
   `text`. The second call should return instantly (served from the
   `textHash` cache in `nlp_insights`) rather than re-running the
   transformer models — check ai-service logs/latency to confirm the second
   call is markedly faster.
2. Change the `text` for the same `sourceDocumentId` and call again — this
   time it should recompute (cache miss on the new hash).

## 5. Node integration

```bash
TOKEN="<HR_MANAGER or ADMIN access token>"

curl -X POST http://localhost:5000/api/v1/employee-intelligence/<employeeId> -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/employee-intelligence/<employeeId> -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/employee-intelligence/dashboard/summary -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/employees/<employeeId>/ai-insights -H "Authorization: Bearer $TOKEN"
```

Confirm:
- `POST` generates and stores a new `EmployeeIntelligence` document (check
  `db.employeeintelligences.find({employeeId: ObjectId("...")})` — calling
  it twice should produce **two** documents, not one overwritten document
  (history, matching the Explanation collection's pattern from the SHAP
  sprint).
- `GET /employees/:id/ai-insights` returns `{ prediction, explanation,
  intelligence }` together in one response, with any of the three as `null`
  if that piece hasn't been generated yet (not a failed request).

## 6. Employee Profile

1. Open an employee with no feedback/survey/note text yet → "AI Insights"
   tab's Employee Intelligence card shows "No Employee Intelligence profile
   generated yet." with an "Analyze Employee Sentiment" button.
2. Seed some `EmployeeFeedback`/`Survey`/`ManagerNote` text for them, click
   the button → card populates with Sentiment, Dominant Emotion, Burnout
   Risk, Confidence, Top Topics, Keywords, and an AI summary sentence.
3. Click "Refresh Employee Intelligence" → regenerates (forced refresh).
4. Stop the ai-service, click refresh → inline red error banner appears
   (not a silent no-op).

## 7. Dashboard

1. Scroll to the "🎭 Employee Intelligence" section.
2. With zero `EmployeeIntelligence` documents in the database: shows the
   "No Employee Intelligence profiles generated yet" empty state, not a
   crash or blank charts.
3. After generating a few employees' profiles (via the Profile page or the
   API), reload → Sentiment Distribution (pie), Burnout Distribution (bar),
   Emotion Distribution (bar), Top Employee Concerns / Trending Topics
   (horizontal bar), Sentiment & Burnout Trend (line, monthly), Department
   Sentiment, and Department Burnout all populate with real numbers.

## 8. Employee Directory filters

1. Go to Employees list — confirm new "All Sentiments", "All Burnout
   Levels", and "All Emotions" filter dropdowns appear in the toolbar, and
   a "Mood" column appears in the table showing each employee's latest
   sentiment + burnout badge (or "No Data" if never analyzed).
2. Filter by e.g. Burnout = High → only matching employees show, and the
   "Page X of Y" / total count reflects the filtered set (server-side
   filter, not client-side).
3. Sort by "Sentiment", "Emotion", or "Burnout Score" — confirm order
   changes and ascending/descending toggle works.

## 9. Batch analysis across employees

```bash
TOKEN="<HR_MANAGER or ADMIN access token>"

# All ACTIVE employees
curl -X POST http://localhost:5000/api/v1/employee-intelligence/batch -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'

# One department
curl -X POST http://localhost:5000/api/v1/employee-intelligence/batch -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"departmentId": "<deptId>"}'

# Explicit employee list
curl -X POST http://localhost:5000/api/v1/employee-intelligence/batch -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"employeeIds": ["<id1>", "<id2>"]}'
```

Confirm the response includes `processed` (count of new `EmployeeIntelligence`
documents inserted), and that `db.employeeintelligences` gets one new document
per employee that had any analyzable text. On the Dashboard, clicking
"Generate Employee Intelligence" in the Employee Intelligence section header
should trigger this same batch call and then repopulate all 8 widgets.

## 10. Unsupported language handling

```bash
curl -X POST http://localhost:8000/sentiment -H "Content-Type: application/json" \
  -d '{"text": "Je suis très frustré par la charge de travail."}'
```

Expect `400` with a message naming the detected language (e.g. `'fr'`) and
stating only English is supported — not a garbage sentiment result. For
`/sentiment/batch` and `/nlp/analyze/batch`, a non-English item in an
otherwise-English batch should be silently skipped (excluded from
`results`/`insights` and `processedCount`), not abort the whole batch. For
`POST /employee-intelligence`, an employee with a mix of English and
non-English notes should still return a profile built only from their
English text (non-English entries silently excluded from `dataPoints`).

## 11. Inference timeout

Set `NLP_INFERENCE_TIMEOUT_SECONDS=0.001` in `ai-service/.env` (an
impossibly short window) and restart the ai-service, then call
`POST /sentiment` or `POST /employee-intelligence`. Expect a clean `504`
("NLP inference timed out...") instead of a hang. Restore the env var
(or remove it — defaults to 30s) afterward.

## 12. Error handling checklist

| Scenario | Expected behavior |
|---|---|
| Missing/empty text | `400` on `/sentiment`, `/nlp/analyze` (both FastAPI and any caller) |
| Unsupported (non-English) text | `400` on single-text endpoints; silently skipped in batch endpoints |
| Inference exceeds `NLP_INFERENCE_TIMEOUT_SECONDS` | `504`, request does not hang |
| Employee with no text sources | `200` with `dataPoints: 0`, graceful summary — not an error |
| Invalid employeeId format | `400` |
| Non-existent employee | `404` |
| Model/pipeline unavailable (transformers not loaded) | Node maps to a clear message, not a raw stack trace |
| FastAPI offline | Node returns `503 AI_SERVICE_UNAVAILABLE` within ~30s (timeout) |
| Batch with one bad text record (empty/unsupported-language/timeout) | Response still returns processed results for the rest — one bad record doesn't abort the whole batch |

## 10. Regression — prior sprints must be unaffected

Re-run `docs/SHAP-Explainability-Testing-Guide.md` in full. This sprint did
not modify Prediction or SHAP code paths — only the NLP module and new
Employee Intelligence surfaces were added/fixed.
