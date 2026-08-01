# RetentionAI — Verified Resume Metrics

Every number below was pulled directly from code, config, saved model reports, or a live query against the running database — nothing here is estimated. Where a number genuinely isn't available, it's marked **NOT FOUND**. Two things need your attention before you use these on a resume:

> **Correction:** You asked me to confirm the role count is 6 — it's actually **8**, verified directly in `server/src/config/roles.js`.
>
> **Correction:** "AI agents" in this codebase is **1 orchestration pipeline built from 4 tool integrations**, not multiple independent agents — see the AI Agents row below for the exact structure.

---

## 1. Dataset Size

| Metric | Value Found | Source |
|---|---|---|
| Employee records used for training | **1,470** (all non-deleted employees; 0 soft-deleted) | Live query: `Employee.countDocuments({isDeleted:{$ne:true}})` → 1470; filter confirmed in `ai-service/app/preprocessing/pipeline.py:260` |
| Attrition (positive class) count | **147 TERMINATED / 1,470 total = 10.0%** | Live query: `Employee.countDocuments({status:'TERMINATED'})` → 147 |
| Features/columns used in model | **28** (23 numerical + 5 categorical, label-encoded — not one-hot expanded) | `ai-service/app/preprocessing/pipeline.py:22-51` (`FEATURE_COLS`), `:53-61` (`CATEGORICAL_COLS`, `NUMERICAL_COLS`) |
| Train/test split | **80/20 stratified split → 1,176 train / 294 test** (computed from verified total × `test_size=0.2`, not a directly-printed log line) | `ai-service/app/preprocessing/pipeline.py:586-588` |
| Dataset source | **Custom-generated synthetic data** (Faker-based Node.js generator, Indian-corporate context, seeded into MongoDB) — NOT the public IBM Kaggle HR Attrition dataset, though the code supports it as an optional override | `dataset-generator/README.md:1-5`; `ai-service/train_model.py:28-31` (`IBM_DATASET_CSV_PATH` present but empty in `.env`, no CSV file found in repo) |

## 2. Model Performance

| Metric | Value Found | Source |
|---|---|---|
| Algorithm used | **Logistic Regression** (selected after benchmarking 5 model families: LogisticRegression, RandomForest, XGBoost, LightGBM, CatBoost) | `models/active/plots/training/model_report.json:3,6-65` |
| Accuracy | **82.31%** (at tuned decision threshold 0.07) | `model_report.json:75` (`finalMetrics.accuracy`) |
| Precision | **35.44%** | `model_report.json:76` |
| Recall | **96.55%** | `model_report.json:77` |
| F1-score | **0.5185** | `model_report.json:78` |
| ROC-AUC | **0.8884** | `model_report.json:79` |
| PR-AUC | **0.3213** | `model_report.json:80` |
| Calibration method | **Isotonic regression** | `model_report.json:72` |
| Most recent training run | **2026-08-01T15:30:40** | `model_report.json:2` |
| Command to regenerate these numbers | `cd ai-service && python train_model.py` (also reachable via `POST /api/v1/ai/train` on the Express server, which triggers the same script) | `ai-service/train_model.py`; `server/src/routes/aiRoutes.js` |

## 3. System Architecture

| Metric | Value Found | Source |
|---|---|---|
| Distinct user roles | **8** — ADMIN, HR_MANAGER, HR_ANALYST, DEPARTMENT_MANAGER, EMPLOYEE, HR_DIRECTOR, CHRO, CEO (not 6 — see correction above) | `server/src/config/roles.js:1-14` |
| AI agents / orchestration | **1 orchestration layer** ("Agentic AI Orchestration Layer") built from **4 tool wrappers**: ML Tool (`ml_tool.py`, wraps prediction service), SHAP Tool (`shap_tool.py`, wraps explainability), NLP Tool (`nlp_tool.py`, wraps sentiment/burnout insights), RAG Tool (`rag_tool.py`, wraps ChromaDB policy retrieval) — feeding one LangChain reasoning chain that calls Groq Llama-3.3-70B | `ai-service/docs/ai/agentic-ai.md`; `ai-service/app/agent/tools/*.py`; `ai-service/app/agent/chains/reasoning_chain.py` |
| API endpoints — Express backend | **142** route registrations across 23 route files | Counted via `grep` over `server/src/routes/*.js` |
| API endpoints — FastAPI AI service | **46** route registrations across 7 route files | Counted via `grep` over `ai-service/app/api/*.py` |
| **Total API endpoints (both services)** | **188** | Sum of the two rows above |
| Caching | **No Redis/external cache layer found.** MongoDB connection pool tuned to `maxPoolSize: 20` | `server/src/config/database.js:10` |
| Async | FastAPI service is natively async end-to-end; Express uses `BackgroundTasks`-style async dispatch for long-running model training | `ai-service/app/main.py`; `server/src/routes/aiRoutes.js` |
| Other performance middleware | gzip/deflate response compression (`compression()`), per-endpoint rate limiting (`express-rate-limit`), Helmet security headers | `server/src/app.js:45-71` |
| Frontend performance optimization | Route-based code-splitting — **59% reduction in initial JS payload** (per project changelog, not independently re-measured this session) | `CHANGELOG.md:17` |

## 4. Frontend / UX

| Metric | Value Found | Source |
|---|---|---|
| Distinct dashboard/page views | **24** page components | Counted via `ls client/src/pages/*.jsx` |
| Recharts chart instances | **21 total**: 10 BarChart, 6 LineChart, 3 PieChart, 1 AreaChart, across 3 files (`AnalyticsCharts.jsx`, `AiAnalytics.jsx`, `ExecutiveDashboard.jsx`) | Counted via `grep` over `client/src/**/*.jsx` |
| Lighthouse / render-time benchmarks | **NOT FOUND** — no Lighthouse report or client-side performance-timing file exists in the repo | Searched `client/` and `docs/` for Lighthouse/performance artifacts — none found |
| Backend load-test benchmarks (real numbers exist, not frontend but directly relevant) | `workflow_dashboard`: 107→172 req/s (p50 335ms→819ms) across 50/100/150 concurrent connections. `employees_list` (1,470-doc collection): 18.6→8.9 req/s, p50 2.2s→7.8s (degrades under load — documented as a real, unresolved finding, not hidden) | `docs/Load-Testing-Report.md` (full table, Finding 2) |

## 5. Scale / Usage (live database record counts)

| Collection | Record Count | Source |
|---|---|---|
| Employees | **1,470** | Live query, `employees` collection |
| Predictions (current/latest per employee) | **1,471** | Live query, `predictions` collection |
| Prediction history (cumulative, insert-per-run) | **54,526** | Live query, `predictionhistories` collection |
| SHAP explanations generated | **23,647** | Live query, `explanations` collection |
| Employee Intelligence (NLP) profiles generated | **19,816** | Live query, `employeeintelligences` collection |
| AI Recommendations / decisions generated | **31,237** | Live query, `decisions` collection |
| Attendance records | **8,543** | Live query, `attendances` collection |
| Performance reviews | **7,766** | Live query, `performances` collection |
| Surveys | **2,765** | Live query, `surveys` collection |
| Employee feedback entries | **1,708** | Live query, `employeefeedbacks` collection |
| Manager notes | **1,070** | Live query, `managernotes` collection |
| Training history records | **0** — NOT SEEDED | Live query, `traininghistories` collection |
| Promotion history records | **0** — NOT SEEDED | Live query, `promotionhistories` collection |
| Departments | **5** | Live query, `departments` collection |
| Users (login accounts) | **7** | Live query, `users` collection |

---

*All live-query numbers reflect the database state at the time this report was generated and will drift as the seeded demo data changes. All file/line citations point to this session's codebase state.*
