# AI Attrition Prediction — Testing Guide

Manual test plan for the ML training pipeline, FastAPI service, Node integration,
and UI surfaces added in this sprint.

## 1. Prerequisites

```bash
# ai-service
cd ai-service
pip install -r requirements.txt   # if not already installed
cp .env.example .env              # fill in MONGODB_URI etc.
uvicorn app.main:app --reload --port 8000

# server (separate terminal)
cd server
npm install
npm run dev

# client (separate terminal)
cd client
npm install
npm run dev
```

Confirm all three processes start without errors. If the Node server fails to boot,
check `server/.env` has `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`CORS_ORIGINS` set (the process crashes on invalid env — this is intentional
fail-fast behavior, not a bug).

## 2. Training pipeline

### 2a. Synthetic/Mongo data (default)

```bash
curl -X POST http://localhost:8000/train
```

Watch the ai-service logs — it should log "Loaded N employee records from MongoDB"
(if enough real employees exist) or fall back to "generating 1,000 synthetic
employee records", then train Logistic Regression, Random Forest, and XGBoost,
select the best model by F1, and write `models/active/attrition_model.joblib`.

### 2b. IBM HR Attrition dataset (optional)

1. Download the public "IBM HR Analytics Employee Attrition & Performance"
   dataset yourself (e.g. from Kaggle) — this repo does not bundle it.
2. Place the CSV at `datasets/raw/WA_Fn-UseC_-HR-Employee-Attrition.csv`.
3. Set `IBM_DATASET_CSV_PATH=../datasets/raw/WA_Fn-UseC_-HR-Employee-Attrition.csv`
   in `ai-service/.env`.
4. Restart ai-service and re-run `POST /train`. Logs should show "Loading IBM HR
   Attrition dataset from: ..." and the record count (1470 for the standard file).

Verify metrics:

```bash
curl http://localhost:8000/model/metrics
curl http://localhost:8000/model/info
```

Expect `accuracy`, `precision`, `recall`, `f1`, `rocAuc` all present and between 0-1.

## 3. FastAPI prediction endpoints

```bash
# Single prediction (replace with a real employee _id from your DB)
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"employeeId": "<employee_object_id>"}'

# Batch prediction (all ACTIVE employees if no filter given)
curl -X POST http://localhost:8000/predict/batch -H "Content-Type: application/json" -d '{}'
```

Error cases to verify:
- Invalid `employeeId` format → `400`
- Non-existent employee → `404`
- No model trained yet (delete `models/active/attrition_model.joblib` and restart) → `503` on `/predict`, `/model/info`, `/model/metrics`
- Stop the ai-service process, then hit the Node endpoints below → Node should return `503 AI_SERVICE_UNAVAILABLE`, not crash or hang (there's a 10s timeout).

## 4. Node integration

Authenticate as an HR_MANAGER or ADMIN user first (`POST /api/v1/auth/login`), then:

```bash
TOKEN="<access token>"

curl -X POST http://localhost:5000/api/v1/ai/train -H "Authorization: Bearer $TOKEN"
curl -X POST http://localhost:5000/api/v1/ai/predict/<employeeId> -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/ai/predict/<employeeId> -H "Authorization: Bearer $TOKEN"   # GET — read-only, no new inference
curl -X POST http://localhost:5000/api/v1/ai/predict/batch -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'
curl http://localhost:5000/api/v1/ai/model/info -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/ai/model/metrics -H "Authorization: Bearer $TOKEN"
curl http://localhost:5000/api/v1/ai/dashboard -H "Authorization: Bearer $TOKEN"
```

Confirm the `GET /predict/:id` call for an employee with no prediction yet returns
`404 PREDICTION_NOT_FOUND` (not a 500), and that after running the `POST` once it
returns `200` with the stored document on subsequent `GET` calls without
re-triggering inference.

## 5. Database

Inspect MongoDB directly (e.g. via `mongosh` or Compass):

```js
db.predictions.findOne()        // one doc per employee: riskScore, riskLevel, confidence, modelId, predictedAt
db.predictionHistory.find()     // append-only log, one row per prediction run
```

Confirm `confidence` is populated on `predictions` docs (previously only written to
`predictionHistory`).

## 6. Employee Profile UI

1. Navigate to any employee's profile → "AI Insights" tab.
2. If no prediction exists: should show "No prediction generated for this employee
   yet." with a "Generate Prediction" button — reload the page and confirm this
   state persists (it should NOT silently auto-generate one on every page view).
3. Click "Generate Prediction" → card should populate with probability, risk
   badge, confidence %, model version, and prediction date.
4. Reload the page → the same prediction should load instantly (read-only GET),
   without spinning a new inference call.
5. Confirm the hero header risk badge (top of the page) renders correctly and
   does not throw a console error.

## 7. Employee List UI

1. Go to Employees list. Without changing the sort order, confirm the risk badge
   column shows real data (LOW/MEDIUM/HIGH or probability %), not "No Data" —
   this previously only worked when explicitly sorting by risk.
2. Apply the risk filter dropdown (e.g. filter to HIGH) and confirm only matching
   rows show.
3. Sort by "AI Risk Score" ascending/descending and confirm order changes.
4. Click "Run AI Prediction" (batch action) and confirm a loading state, then
   updated badges across the list.

## 8. Dashboard

1. Confirm High/Medium/Low risk count tiles render with real numbers.
2. Confirm the "Top 10 High Risk Employees" table populates.
3. Click "Train Model" and confirm it kicks off training without blocking the UI.

## 9. CSV import workflow

1. Bulk-import a CSV of new employees.
2. After a successful import, confirm the "Generate AI Predictions" button
   appears and, when clicked, triggers batch prediction for the newly imported
   employees.

## 10. Error handling checklist

| Scenario | Expected behavior |
|---|---|
| Model not trained | `503` with a clear message, not a crash |
| Employee ID not found | `404` |
| Invalid employee ID format | `400` |
| FastAPI service offline/unreachable | Node returns `503 AI_SERVICE_UNAVAILABLE` within ~10s (timeout), UI shows an error state, does not hang indefinitely |
| Batch prediction with some employees failing | Response includes `successCount`/`failedCount`, does not abort the whole batch |
