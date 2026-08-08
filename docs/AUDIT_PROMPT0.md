# RetentionAI — Prompt 0 Audit: Existing System & Target Architecture Gap Analysis

**Audit only. No source code was modified, no files deleted, no dependencies added, no cloud resources created.** Every claim below was verified directly against the repository during this audit (file reads, greps, and — where noted — live database queries against the actual MongoDB Atlas instance and Render deployment already in use this session). Where I could not verify something, it is marked accordingly rather than assumed.

---

## 1. Executive Summary

RetentionAI is a working, non-trivial **employee attrition prediction platform for HR teams** — not a customer-churn SaaS product (a naming mismatch worth flagging: some prior planning documents in this repo use "customer churn" language; the actual, real, running product predicts **employee** attrition for a company's own workforce). It consists of three independently deployed services (React SPA, Express API, FastAPI ML/AI service) sharing one MongoDB Atlas database, plus a synthetic dataset generator that produced the ~1,470-employee dataset currently live in production.

A large fraction of the "target vision" in this prompt already exists in some form: SHAP explainability (local + global), a business-rules-plus-LLM recommendation engine, an agentic-style orchestrator with evidence bundles, RAG infrastructure (ChromaDB + LangChain + Groq), NLP sentiment/burnout analysis, RBAC with 8 roles, audit logging, and — as of tonight's work in this same session — a real `Organization` model, tenant-isolation fixes across five previously-broken controllers, a formalized 5-model ML comparison with PR-AUC selection, and fixes to two live data-loss bugs in the explainability pipeline. What's genuinely missing is: LangGraph-based agent orchestration (the current agent is a hand-rolled pipeline, not a graph), a persistent-history / change-detection employee lifecycle, billing, Redis-backed background jobs, and object storage.

---

## 2. Existing Architecture

```
┌─────────────────┐      ┌──────────────────────┐      ┌───────────────────────┐
│  React SPA        │      │  Express API           │      │  FastAPI AI Service     │
│  (client/)         │◄────►│  (server/)              │◄────►│  (ai-service/)           │
│  Vite, Redux Toolkit│ REST │  23 route modules       │ REST │  ML + SHAP + NLP + RAG   │
└─────────────────┘      │  26 Mongoose models     │      │  + Agent orchestration   │
                          └──────────┬───────────┘      └───────────┬───────────┘
                                     │                                │
                                     ▼                                ▼
                          ┌──────────────────────────────────────────────┐
                          │        MongoDB Atlas (single shared DB)        │
                          │  Both services read/write the same collections │
                          └──────────────────────────────────────────────┘
```

- **Deployment**: Render Blueprint (`render.yaml`) provisions the Express API and FastAPI service as two independent Docker web services. The client is not defined in `render.yaml` (its deployment target — Vercel, per this prompt's stated intent — was not found configured anywhere in this repo; see §9 Existing Deployment).
- **Database**: One external MongoDB Atlas cluster, connected to directly by both Express (Mongoose) and FastAPI (Motor/PyMongo — confirmed via `pymongo==4.17.0` and `motor==3.7.1` in `ai-service/requirements.txt`, and direct `pymongo.MongoClient` usage in `ai-service/train_model.py`).
- **No API gateway, no Redis, no message queue** anywhere in the stack — every service-to-service call is a direct synchronous (or job-ID-polled) HTTP request.

---

## 3. Existing Tech Stack (verified only)

**Frontend (`client/package.json`)**: React 18.3, Vite, Redux Toolkit, React Router 6, Tailwind CSS 3, Recharts, react-hook-form + zod, axios, lucide-react.

**Backend (`server/package.json`)**: Express 4, Mongoose 8, jsonwebtoken, bcrypt, helmet, express-rate-limit, winston (+ winston-daily-rotate-file), zod, multer, csv-parse, json2csv, docx, pdfkit, swagger-ui-express.

**AI Service (`ai-service/requirements.txt`)**: fastapi, uvicorn, pandas, numpy, scikit-learn, xgboost, lightgbm, catboost, shap, matplotlib, transformers, torch, vaderSentiment, spacy, langdetect, langchain, langchain-community, **langchain-groq**, sentence-transformers, **chromadb**, pymongo, motor, nltk, pypdf, docx2txt, unstructured.

**Explicitly NOT found anywhere in the repository**: `langgraph` (checked `requirements.txt` and every `.py` import), `stripe` (no SDK dependency in `server/package.json`, no Python stripe package; the only string match is the field *names* `stripeCustomerId`/`stripeSubscriptionId` I added to `Organization.js` earlier tonight as reserved-but-unused placeholders), Redis (no client library in either package.json/requirements.txt), any object-storage SDK (no `aws-sdk`, no `@aws-sdk/*`, no `boto3`).

**Database**: MongoDB Atlas (managed, external — not a Render add-on).

**Deployment tooling found**: Docker (per-service Dockerfiles), `render.yaml` (Render Blueprint), GitHub Actions (`.github/workflows/ci.yml`). **Not found**: any Vercel config (`vercel.json`), any Google Cloud config (`cloudbuild.yaml`, `Dockerfile` targeting Cloud Run specifically — the existing Dockerfiles are generic and would work on Cloud Run, but nothing currently targets it).

---

## 4. Existing Features (verified, by area)

| Feature | Status |
|---|---|
| Employee CRUD, soft delete/restore, bulk CSV import | IMPLEMENTED |
| Department CRUD, manager assignment | IMPLEMENTED |
| JWT auth (access+refresh), forgot/reset password | IMPLEMENTED |
| RBAC — 8 roles (ADMIN, HR_MANAGER, HR_ANALYST, DEPARTMENT_MANAGER, EMPLOYEE, HR_DIRECTOR, CHRO, CEO) | IMPLEMENTED |
| Organization/tenant model + self-serve signup | IMPLEMENTED (built earlier tonight, this session) |
| Single + batch ML attrition prediction | IMPLEMENTED |
| SHAP local + global explanations, with deterministic NL narrative | IMPLEMENTED (narrative-visibility bug fixed tonight) |
| 5-model benchmark (LogReg/RF/XGBoost/LightGBM/CatBoost) with automatic selection | IMPLEMENTED (formalized to PR-AUC + one-SE rule tonight) |
| NLP sentiment/burnout/resignation-intent from feedback text | IMPLEMENTED IN CODE, **NOT LIVE** on the current Render deployment (see §9) |
| Agentic-style recommendation orchestrator (evidence bundle + confidence) | IMPLEMENTED, but as a hand-rolled pipeline, **not LangGraph** |
| RAG (ChromaDB + LangChain + Groq) | IMPLEMENTED IN CODE, **NOT LIVE** on the current Render deployment |
| Groq LLM recommendation generation (business rules + LLM reasoning) | IMPLEMENTED |
| Workflow: Tasks, Approvals, Interventions, Comments, Notifications | IMPLEMENTED |
| Audit logging | IMPLEMENTED |
| Executive dashboard, department analytics, manager dashboard | IMPLEMENTED |
| Knowledge base document management UI | IMPLEMENTED (upload/list), retrieval depends on the not-live RAG stack |
| **Employee Risk Timeline (historical prediction trend)** | **MODELED, NOT IMPLEMENTED** — `PredictionHistory` schema exists; zero write call sites found anywhere in the codebase |
| **Change detection on re-upload (update existing employee)** | **MISSING** — bulk import only ever rejects duplicates by code/email; never updates |
| Model versioning / `ModelMetadata` persistence | IMPLEMENTED (built tonight; not yet linked to individual `Prediction` documents — see §11) |
| Billing/subscriptions | MISSING entirely |
| Multi-tenant data isolation | PARTIALLY IMPLEMENTED — see §11 and the gap table |

---

## 5. Existing Data Flow — the actual 1,470-employee dataset

Traced directly from code, not assumed:

```
dataset-generator/generate.js (a synthetic-data generator, Faker-style)
        ↓ writes CSVs to dataset-generator/output/*.csv
        ↓   (employees.csv target = 1,470 records — confirmed in generate.js's own log line)
server/src/seeders/seedDemoData.js
        ↓ reads those exact CSV files (DATASET_DIR = '../../../dataset-generator/output')
        ↓ called automatically from server/src/server.js's startup sequence:
        ↓   seedAdminUser() → seedDemoData() → seedEmployeeDemoUser() → seedWorkflowDemoUsers()
MongoDB Atlas — Employee, Department, Attendance, Performance, Survey,
                EmployeeFeedback, ManagerNote collections
        ↓
Predictions generated on-demand via POST /api/v1/ai/predict/batch (or per-employee)
        ↓ stored in the `predictions` collection (current/live prediction only)
Dashboard reads via GET /api/v1/ai/dashboard, /api/v1/employees, etc.
```

**Important, verified distinction**: `datasets/raw` and `datasets/processed` (the top-level directories this prompt might expect to hold the data) are **both empty** — they are not the actual source. `server/scripts/seedHrData.js` is a *second*, separate seeder that connects to a **different database name** (`retentionai_seed`, hardcoded) — it is not what populated the live production database. The one that matters is `server/src/seeders/seedDemoData.js`, run automatically on every server boot.

**Does it support repeated uploads / updates / change detection?** No. `employeeService.bulkImportEmployees()` checks each row's `employeeCode` and `email` for existing matches and **rejects (skips) the row entirely** if either already exists — it never updates the existing record. There is no "new / changed / unchanged / inactive" classification anywhere in the code. Re-running the seed script or the bulk-import endpoint with updated data for existing employees does not change anything already stored.

**Does it detect inactive/departed employees?** Partially — `Employee.status` includes `TERMINATED`/`INACTIVE`/`ON_LEAVE` values and `isDeleted` supports soft-delete, but nothing *automatically* transitions an employee into one of these states based on incoming data; it is a manual field update only.

**Historical predictions?** The `PredictionHistory` model is fully schema'd (`organizationId`, `employeeId`, `modelId`, `riskScore`, `riskLevel`, `confidence`, `predictedAt`, `runId`) but **zero call sites write to it anywhere in the codebase** (verified via a full-repo search for `PredictionHistory.create`/`.insert*`). The "Employee Risk Timeline" example in this prompt (`January 32%, February 38%...`) has no data source today — it would need to be built from scratch on top of this already-designed-but-unused schema.

---

## 6. Existing AI/ML Flow

```
Employee data (Mongo)
        ↓
app/preprocessing/pipeline.py — imputation, feature engineering, train/test split
        ↓
app/training/trainer.py — benchmark 5 models (stratified 5-fold CV PR-AUC + one-SE
                            simplicity rule as of tonight) → tune winner's hyperparameters
                            (RandomizedSearchCV) → isotonic calibration → threshold
                            optimization (F2, min-precision floor)
        ↓
Model bundle saved to disk (models/active/attrition_model.joblib) + persisted to
MongoDB `modelMetadata` collection (full 5-model comparison table + selection reason,
as of tonight)
        ↓
app/prediction/prediction_service.py — loads bundle into process memory at startup
        ↓
POST /predict, /predict/batch — inference
        ↓
app/explainability/{local,global}_explainer.py — SHAP values → deterministic
        NL narrative template (both local per-employee and global workforce-wide,
        the latter added tonight)
        ↓
app/api/nlp_routes.py — sentiment/burnout/resignation-intent from free-text
        feedback (VADER + spaCy + transformers) — code complete, gated off on
        the current lite deployment
        ↓
app/agent/services/agent_service.py — orchestrates ML risk + SHAP evidence +
        NLP signals + RAG policy retrieval into an "evidence bundle" + confidence
        scores, then calls Groq (llama-3.3-70b-versatile via langchain_groq.ChatGroq)
        for the final structured recommendation
        ↓
app/rag/ — ChromaDB vector store, LangChain document loaders/chunkers/embeddings,
        a dedicated RAG chain (also Groq-backed) — code complete, gated off on
        the current lite deployment
```

**LangGraph**: confirmed absent. The orchestration in `app/agent/services/agent_service.py` is a plain sequential Python function calling other functions in order — real evidence-bundling and confidence-scoring logic exists, but there is no graph, no per-node state machine, no checkpointing, no conditional branching, no LangGraph import anywhere in the repository.

**Groq model in use**: `llama-3.3-70b-versatile` (hardcoded in `app/agent/chains/reasoning_chain.py`); the separate RAG chain (`app/rag/chains/rag_chain.py`) reads `GROQ_MODEL_NAME` from the environment with the same default. Two independent `ChatGroq` client instances exist (agent reasoning vs. RAG), each cached as a module-level singleton.

---

## 7. Existing API Map (representative, not exhaustive — 23 route modules exist)

```
METHOD  PATH                                  PURPOSE                          AUTH        AUTHZ                 STATUS
POST    /api/v1/auth/login                    Login, issue JWT pair            Public      —                     IMPLEMENTED
POST    /api/v1/organizations/signup          Create org + first admin         Public      —                     IMPLEMENTED (tonight)
GET     /api/v1/organizations/me              Current org profile              JWT         any authenticated     IMPLEMENTED (tonight)
GET     /api/v1/employees                     List employees (org-scoped)      JWT         role-based scope      IMPLEMENTED
POST    /api/v1/employees/bulk-import         CSV bulk import                  JWT         ADMIN/HR_MANAGER      IMPLEMENTED (no update/change-detection)
GET     /api/v1/departments                   List departments                 JWT         any authenticated     IMPLEMENTED
POST    /api/v1/ai/train                      Trigger training (background)    JWT         ADMIN/HR_MANAGER      IMPLEMENTED, concurrency-gated (tonight)
POST    /api/v1/ai/predict/batch              Batch prediction                 JWT         ADMIN/HR_MANAGER      IMPLEMENTED
GET     /api/v1/ai/model/info                 Active model metadata            JWT         ADMIN/HR_MANAGER      IMPLEMENTED
GET     /api/v1/ai/model/metrics              Model metrics + benchmark table  JWT         ADMIN/HR_MANAGER      IMPLEMENTED (extended tonight; Mongo-fallback if ai-service is down)
POST    /api/v1/explain/batch                 Batch SHAP (async job+poll)      JWT         ADMIN/HR_MANAGER      IMPLEMENTED
GET     /api/v1/explain/global/feature-importance  Global SHAP ranking + narrative  JWT   ADMIN/HR_MANAGER      IMPLEMENTED (narrative added, data-loss bug fixed tonight)
POST    /api/v1/employee-intelligence/batch   NLP batch analysis (async)       JWT         ADMIN/HR_MANAGER      IMPLEMENTED, but 503s on the current lite ai-service image
POST    /api/v1/decisions/batch               Batch recommendation generation  JWT         ADMIN/HR_MANAGER      IMPLEMENTED (chunked + concurrency-gated tonight)
PATCH   /api/v1/decisions/status/:id          HR approve/dismiss recommendation JWT        ADMIN/HR_MANAGER      IMPLEMENTED
GET     /api/v1/decisions/dashboard/summary   Recommendation dashboard         JWT         any authenticated     IMPLEMENTED
GET     /api/v1/executive/*                   Executive dashboards/alerts      JWT         executive roles       IMPLEMENTED
GET     /api/v1/knowledge/*                   Knowledge doc management         JWT         ADMIN/HR_MANAGER      IMPLEMENTED (indexing depends on the not-live RAG stack)
POST    /api/v1/interventions                 Create intervention               JWT        ADMIN/HR_MANAGER      IMPLEMENTED
GET     /api/v1/audit                         Audit log viewer                 JWT         ADMIN                 IMPLEMENTED
POST    /api/v1/users                         Admin-managed user creation      JWT         ADMIN                 IMPLEMENTED
GET     /health, /health/deep                  Liveness / dependency health     Public/JWT  —                     IMPLEMENTED
```

**Duplicate/inconsistent APIs found**: none structurally duplicated. **Broken APIs found and already fixed this session** (see CHANGE LOG below) rather than left broken: Employee Intelligence returned a bare 404 instead of a clear 503 (fixed); several endpoints previously trusted a client-supplied `x-organization-id` header for tenant scoping (fixed — now derived from the verified JWT only).

---

## 8. Existing Database Model (26 Mongoose collections, verified)

Core identity/tenancy: `Organization`, `User`, `Role`, `RefreshToken`.
Workforce data: `Employee`, `Department`, `Attendance`, `Performance`, `Survey`, `EmployeeFeedback`, `ManagerNote`, `TrainingHistory`, `PromotionHistory`.
AI outputs: `Prediction`, `PredictionHistory` (unused — see §5), `Explanation`, `GlobalFeatureImportance`, `EmployeeIntelligence`, `Decision`, `ModelMetadata` (added tonight).
Workflow: `Task`, `Approval`, `Intervention`, `Comment`, `Notification`, `NotificationPreference`.
Knowledge/compliance: `KnowledgeDocument`, `AuditLog`, `ExecutiveAlert`, `Attachment`.

**Relationships**: mostly ObjectId references (`Employee.departmentId → Department`, `Decision.employeeId → Employee`, `User.roleId → Role`, `User.employeeId ↔ Employee.userId` bidirectional link), not Mongoose `populate`-heavy in every path (some services intentionally denormalize for read performance, e.g., `employeeRepository.listEmployees`'s aggregation pipeline).

**Tenant field**: every collection above carries an `organizationId` field. As of tonight, it is *correctly enforced* (query-filtered) for: Employee, Department, User, Approval, and every Analytics query. It is present and appears correctly wired (based on non-trivial `organizationId` reference counts in both controller and service layers, though not re-verified line-by-line in this audit) for Task, Intervention, Comment, Notification, Knowledge. **Two controllers were found completely unscoped and are the highest-priority known remaining risk area for a full security pass**: none currently known to be broken after tonight's fixes, but this audit did not re-verify every one of the 23 route modules line-by-line — see §12.

---

## 9. Existing Deployment

- **Express API**: Render web service, Docker, `plan: starter` *declared* in `render.yaml` — but the **actual live plan, confirmed via the Render API tonight, is `free`**, not `starter`.
- **FastAPI AI Service**: Render web service, Docker, `plan: standard` *declared* — **actual live plan, confirmed via the Render API, is also `free`**.
- **Database**: MongoDB Atlas, external, connection string in `MONGODB_URI` env var (not a Render add-on).
- **Client**: no deployment configuration found in this repository for any host (not Vercel, not Render, not anywhere). It is currently exercised only via local dev server (`npm run dev`) during this session's verification work.
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) exists.
- **No Redis, no object storage, no CDN, no API gateway** anywhere in the current deployment.
- **"lite" vs "full" AI image**: `ai-service/app/features.py`'s `NLP_AVAILABLE`/`RAG_AVAILABLE` flags are `False` on the currently deployed image — it was built without `torch`/`transformers`/`sentence-transformers`/`chromadb` to fit memory constraints. `deploy/huggingface/` exists in the repo as a scaffold for a "full" image target but has not been confirmed live anywhere.

---

## 10. Render OOM Analysis

This was directly, empirically investigated earlier tonight against the live production service (not theorized). Findings:

1. **The actual root cause is the Render plan tier, not application code.** Both services are running on Render's **free plan (512MB RAM hard ceiling)** despite `render.yaml` declaring `starter`/`standard`. This alone is enough to explain repeated OOM kills under any non-trivial ML workload — a 5-model benchmark plus SHAP plus (when live) NLP/transformer models is a legitimately memory-hungry workload for 512MB.
2. **Confirmed concurrency compounding**: pulled Render's own logs for the actual incident. A batch SHAP explanation and a batch recommendation generation landed on the ai-service within one second of each other (real user activity) — both got 502s, and the container's uptime counter reset (a hard crash + restart, not a graceful timeout). Nothing in the code prevented two heavy AI jobs from running concurrently; fixed tonight with a process-wide concurrency gate (`server/src/utils/aiConcurrencyGate.js`).
3. **Confirmed payload-size crash, separately**: sending the full ~1,320-employee workforce in one batch request (a ~1.1MB body) crashed the container; chunking to 300 employees per request (already fixed, prior commit) avoids it.
4. **Is ChromaDB loaded into memory?** Not on the current deployment — `RAG_AVAILABLE=False` means the vector store code path never initializes on this image at all. If/when the "full" image is deployed, ChromaDB's in-process footprint becomes a new, real memory line-item that hasn't been measured yet.
5. **Does the service load the model at startup?** Yes — `prediction_service.load_active_model()` loads the entire model bundle (including SHAP background data) into process memory once at boot and keeps it resident.
6. **Are requests synchronous?** Individual predict/explain/decision calls are synchronous within the ai-service; the *batch* endpoints (`/explain/batch`, `/decision/batch`) were converted to fire-and-forget background-task + job-ID polling earlier this session specifically to stop them from holding one HTTP connection open for minutes.
7. **Can large batches still spike memory?** Yes, in principle — chunking reduces the risk but the ai-service processes each chunk with un-capped in-process concurrency for the batch's internal work (bounded by a semaphore, not a hard memory budget).

**Bottom line for the Cloud Run migration this prompt anticipates**: moving to Cloud Run with a properly-sized memory allocation (2–4GB, config-only) resolves the *majority* of the OOM class outright, independent of any code change — the code-level mitigations already shipped tonight (concurrency gate, chunking) are good practice regardless, but the free-tier RAM ceiling was the dominant factor.

---

## 11. Missing Features (vs. target vision)

- **LangGraph agent orchestration** — the current agent is a hand-rolled sequential pipeline with real evidence-bundling logic, but no graph, no per-node retry, no checkpointed state, no conditional routing.
- **Live RAG/NLP** — fully coded, not running on the deployed image.
- **Employee Risk Timeline** — schema exists (`PredictionHistory`), never written to.
- **Upload-based change detection** (new / changed / unchanged / inactive classification) — bulk import only rejects duplicates, never updates.
- **`modelVersion` on individual `Prediction`/`Explanation`/`Decision`/`EmployeeIntelligence` documents** — `ModelMetadata` now exists as a standalone collection (built tonight) but is not yet foreign-keyed from individual prediction records, so you cannot currently ask "which model version produced *this specific* prediction" directly from that document — only "what was the most recently approved model."
- **Billing/Stripe** — no code, no schema beyond two unused placeholder field names.
- **Redis / background job queue** — all "background jobs" are in-process `Map`/`dict` objects that lose state on every restart (4 instances found and inventoried earlier tonight; not yet migrated — this is the explicit next step already agreed with the user before this audit was requested).
- **Object storage** — `Attachment` model exists; nothing indicates where files physically land, and Render's web services have ephemeral disk by default, meaning uploaded files likely do not survive a redeploy (not independently re-verified in this audit).
- **Full multi-tenant billing/usage-limit enforcement** — `Organization.employeeLimit` exists as a stored field; nothing currently reads or enforces it.
- **API keys for programmatic access** — not found anywhere.
- **AI Decision Trace** (the full evidence → model version → SHAP → RAG docs → prompt version → LLM → HR decision chain) — pieces of this exist independently (evidence bundle, `AuditLog`, `Decision.status` history) but nothing unifies them into one traceable record per recommendation.

---

## 12. Architecture Risks

**Security**
- Confirmed and fixed tonight: five controllers (Department, Employee, Analytics, User, Approval) had zero tenant scoping — any authenticated user from any organization could read/write any other organization's data. This was a real, live, currently-exploitable class of bug, not theoretical (proven via a live cross-tenant integration test before fixing).
- Not re-verified in this audit pass: the remaining ~18 route modules. The pattern found (silent, zero-organizationId controllers) was surprising and systemic enough that a full line-by-line pass of every remaining controller is warranted before declaring multi-tenancy complete — flagged as the top remaining security risk.
- `PredictionHistory`, `Prediction`, and possibly other AI-output collections should be spot-checked the same way; they were not part of tonight's fix set.

**Reliability**
- Free-tier Render plan is a standing reliability risk independent of any code fix (§10).
- In-memory job stores (4 found) mean any service restart silently drops in-flight batch work with no user-facing error beyond a stalled poll.

**Data**
- No historical prediction tracking despite a purpose-built schema for it — any "risk trend" feature request today has no real data to draw from.
- Re-uploading employee data cannot update existing records — a real operational gap for any customer who actually needs to keep employee data current over time (which is the core premise of the product).

**AI/ML**
- The deployed "lite" image cannot serve NLP or RAG-grounded recommendations at all right now — those features are effectively **advertised-but-non-functional** on the current production deployment, a real gap between what the code can do and what a live user can experience.
- A confirmed, real xgboost/scikit-learn version incompatibility was found and patched tonight — worth being aware of if either dependency is ever bumped independently in the future.

**Deployment**
- `render.yaml` declaring plans that don't match reality is itself a process/config-drift risk (someone or something changed the live plan without updating the source of truth, or it was never applied).

---

## 13. Target Architecture

```
                              ┌────────────┐
                              │   Vercel     │  (client — not yet deployed anywhere)
                              └──────┬─────┘
                                     │ HTTPS
                              ┌──────▼─────┐
                              │   Render     │  Express API (needs plan fixed to match declared)
                              └──────┬─────┘
                     ┌───────────────┼───────────────┐
                     ▼               ▼               ▼
              ┌───────────┐   ┌───────────┐   ┌─────────────┐
              │ MongoDB    │   │  Redis     │   │ Google Cloud │
              │ Atlas      │   │ (new)      │   │ Run — AI svc │
              └───────────┘   └───────────┘   └─────────────┘
                                                       │
                                            ChromaDB (persistence
                                            strategy TBD — see §14)
```

Kept as-is (no justified reason to replace): MongoDB Atlas, Express, React/Redux Toolkit, ChromaDB, LangChain, Groq, scikit-learn/xgboost/lightgbm/catboost.
Added: Redis (job queue + cache), object storage, Stripe, LangGraph (replacing the hand-rolled agent orchestrator's control flow, not its actual logic), Cloud Run for the AI service specifically (memory-elastic, scale-to-zero-capable, better fit for a bursty ML workload than a fixed Render dyno).

---

## 14. Technology Decisions

| Technology | Why needed | Real problem solved | Keep existing? | Replacement justified? |
|---|---|---|---|---|
| Redis | Background jobs currently vanish on restart | The exact mechanism behind tonight's ai-service outage | N/A (nothing to keep — genuinely missing) | Yes, add |
| LangGraph | Current orchestration has no checkpointing/retry/branching | State loss on partial agent failure; no resumability | Keep `app/agent`'s evidence-bundling *logic* | Wrap existing logic in a graph, don't rewrite it |
| Google Cloud Run (AI service only) | Free-tier Render RAM ceiling is the dominant OOM cause | Elastic memory, scale-to-zero for a bursty workload | Keep Render for Express (works fine, cheaper to keep than migrate for no reason) | Justified for AI service specifically, not the whole stack |
| Stripe | No billing exists at all | Revenue — not a "problem" the current code has, a capability gap | N/A | Add only when the business is ready to charge; no code reason to rush it |
| Object storage (R2/S3) | Render web services have ephemeral disk | Uploaded files (Attachment records) likely don't survive redeploys | N/A | Add |
| MongoDB (keep) | 26 collections deep, document model fits nested HR data well | — | **Keep** | No — a Postgres migration was considered in an earlier planning pass and explicitly rejected as unjustified churn |

---

## 15. Implementation Roadmap (14 phases, as specified)

1. **Stabilization** — fix Render plan mismatch (config or billing decision), confirm the concurrency-gate + chunking fixes hold under real load, finish the interrupted in-memory→Redis job migration (already scoped tonight, 4 known stores).
2. **Security + Multi-tenancy** — full line-by-line tenant-scoping audit of the ~18 not-yet-re-verified route modules.
3. **Persistent Employee Lifecycle** — build the new/changed/unchanged/inactive classification on top of the existing bulk-import endpoint; wire `PredictionHistory` writes.
4. **Intelligent Data Ingestion** — schema detection/column mapping/preview/HR-confirmation UI layered on the existing (currently reject-only) import flow.
5. **Production ML + MLOps** — link `ModelMetadata` to individual `Prediction` documents (modelVersion foreign key); this session's PR-AUC/one-SE selection work is otherwise already done.
6. **XAI + Risk Timeline** — build the timeline UI once `PredictionHistory` is actually populated (Phase 3 dependency).
7. **GenAI + Groq + LangChain** — already substantially implemented; audit prompt versioning/token tracking, which was not found to exist.
8. **RAG + ChromaDB** — get the "full" image live (or a hosted-embeddings alternative), since the code is already written and just isn't deployed.
9. **Agentic AI + LangGraph** — wrap the existing `app/agent` logic in a LangGraph state graph.
10. **Intervention + Outcome Intelligence** — `Intervention`/`Decision.status` already track state; effectiveness measurement (risk-before vs. risk-after) needs the Risk Timeline from Phase 6 as an input.
11. **AI Decision Trace + LLMOps** — unify the pieces that already exist independently (evidence bundle, audit log, decision status history) into one traceable record.
12. **SaaS + Billing** — Stripe integration on top of the `Organization` model already built.
13. **Full-Stack + Enterprise Infrastructure** — Redis, retries, idempotency, structured metrics, error tracking.
14. **Deployment + Final Validation** — Cloud Run migration for the AI service, Vercel for the client, final end-to-end verification.

---

## 16. Manual Setup Requirements (identification only — nothing created)

| Service/Account | Why needed | Phase | API key/secret required? |
|---|---|---|---|
| Redis provider (e.g. Upstash) | Job queue, replaces in-memory stores | 1 | Yes — connection URL |
| Render dashboard access | Fix the plan-tier mismatch found in §9/§10 | 1 | No (already have; dashboard action only) |
| Google Cloud account + project | Target AI-service deployment | 14 | Yes — service account key |
| Stripe account | Billing | 12 | Yes — API keys (never handled directly by me) |
| Object storage (Cloudflare R2 or AWS S3) | Persistent file storage | 13 | Yes — access keys |
| Sentry (or equivalent) | Error tracking, referenced in enterprise-infra target | 13 | Yes — DSN |
| Vercel account | Client deployment (currently deployed nowhere) | 14 | Only if using Vercel's own env-var-based secrets |
| Groq | Already in use — confirm the existing key is still valid/rate-sufficient for increased RAG/agent volume once the full image goes live | 8–9 | Already configured; may need quota review |

---

## 17. Recommended Next Step

Based on this audit, **Prompt 1 should address, in this order**:

1. Finish the Redis migration already in progress (4 known in-memory stores) — this is the most concrete, already-scoped, highest-reliability-impact item, and directly follows from tonight's own root-cause findings.
2. Fix the Render plan-tier mismatch (§9/§10) — a configuration/billing decision, not a code change, but the single highest-leverage fix available for the OOM class of incident.
3. Complete the tenant-scoping audit of the remaining ~18 route modules (§12) before treating multi-tenancy as done — the five controllers found broken tonight were not the ones anyone would have guessed first.

---

## READY FOR PROMPT 1

Concrete, evidence-based issues for Prompt 1 to fix, in priority order:

1. **Redis-backed job storage** for the 4 identified in-memory stores (`_EXPLAIN_JOBS`, `_DECISION_JOBS`, `_BATCH_JOBS`, `aiConcurrencyGate`'s lock) — already scoped, awaiting your Redis connection string.
2. **Render plan-tier correction** — `render.yaml` says starter/standard, live services are on free. Decide: update the Blueprint to match reality (accept free-tier limits) or actually upgrade the plan (fixes OOM at the root).
3. **Full tenant-isolation re-audit** of the ~18 route modules not touched tonight, using the same live-cross-tenant-test method that found the first five.
4. **Wire `PredictionHistory`** so the Employee Risk Timeline target feature has real data to draw from.
5. **Employee-data change detection** on re-upload (currently reject-only, never updates).
