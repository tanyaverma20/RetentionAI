# RetentionAI Blueprint

This is the canonical specification for RetentionAI. Requirements are added here sprint by sprint, as provided in chat. No other document (SRS, Repository-Development-Blueprint, READMEs, TODOs) is authoritative for scope or audits.

## Sprints

<!-- Sprint sections are appended below as they are provided. -->

### Sprint: SHAP Explainability

**Role:** Senior AI Engineer and Full Stack Developer.

**Project:** RetentionAI (existing project)

**Stack:** React (JavaScript), Tailwind CSS, Node.js, Express, MongoDB, FastAPI (Python).

**Rules:**
- This prompt is the ONLY specification.
- Ignore Repository-Development-Blueprint.md, SRS.md, and any other planning documents.
- Extend existing code only.
- Do not rewrite working modules.
- Reuse Sprint 3 prediction pipeline.
- Do NOT implement NLP, RAG, Agentic AI, Notifications, or Interventions.

**Sprint Goal:** Make every ML prediction explainable using SHAP so HR understands why an employee is classified as Low, Medium, or High risk.

**Tasks:**

1. SHAP Service
   - Integrate SHAP with the trained model.
   - Generate explanations for single and batch predictions.
   - Cache explanations when possible.

2. FastAPI — Create endpoints:
   - `POST /explain`
   - `POST /explain/batch`
   - `GET /explain/:employeeId`
   - Response: prediction, probability, confidence, risk, topPositiveFactors, topNegativeFactors, shapValues, summary

3. Database — Create Explanation collection.
   - Fields: employeeId, predictionId, shapValues, topFactors, summary, createdAt
   - Store explanation history.

4. Node Integration
   - Proxy SHAP APIs through Express.
   - Merge prediction + explanation into one response.

5. Employee Profile — Replace AI placeholder with:
   - Prediction: Risk, Probability, Confidence
   - Explainability: Top Risk Factors, Top Positive Factors, SHAP Importance Chart, Natural-language summary
   - Example: "High overtime, low job satisfaction, and lack of recent promotion contribute most to this prediction."

6. Dashboard — Add:
   - Top Attrition Drivers
   - Department Risk Drivers
   - Most Influential Features
   - Feature Importance Ranking

7. Employee Directory — Add:
   - "Why?" action on each employee.
   - Modal displaying top contributing SHAP factors.

8. Visualization
   - Use lightweight charts (Chart.js/Recharts already used in project).
   - Show: horizontal feature importance chart; positive vs negative contribution.

9. Error Handling — Handle:
   - Missing prediction
   - Model unavailable
   - SHAP generation failure
   - Invalid employee
   - FastAPI offline

**Deliverables:** SHAP service, FastAPI APIs, Express integration, MongoDB explanation storage, Employee Profile explainability, Dashboard explainability widgets, Employee explanation modal, Testing guide.

**Success Criteria:** Every prediction in the application can be explained with visual feature importance and a human-readable explanation. Sprint 3 functionality must remain unchanged.

**Audit outcome (2026-07-29):** Initial audit found the feature already scaffolded but non-functional end-to-end (crash-causing `req.user` bug in `explainController.js`/`aiController.js`, a response-unwrap/field-mapping bug in `explainService.js` that persisted empty explanations, upsert-based storage that discarded history instead of keeping it, a missing FastAPI `POST /explain/batch`, and a dead duplicate route in `employeeController.js`), plus genuinely missing Dashboard widgets and a directory "Why?" action. All of the above were fixed/implemented in this pass; see `docs/SHAP-Explainability-Testing-Guide.md` for verification steps. Task 4 ("merge prediction + explanation into one response") is satisfied at the client layer (Employee Profile/`Why?` modal hold both in state and render them together) rather than as a single merged API payload, to avoid touching the working Sprint 3 prediction endpoints.

**Follow-up full-stack audit (2026-07-29):** A separate whole-codebase engineering audit (frontend/backend/AI-service/security/performance/db) found, among other things, that the AI service's NLP/RAG/Agent modules all silently fail to persist to MongoDB because of an `await` on a non-async `get_db()` function, and that the SHAP explainer's hardcoded 10-feature list does not match the preprocessing pipeline's actual 22-column output (mislabeled explanations). These are noted here since the next sprint (Employee Intelligence / NLP) builds directly on the NLP module.

### Sprint: Employee Intelligence (NLP)

**Role:** Lead AI Engineer evolving RetentionAI into an enterprise AI Workforce Intelligence Platform.

**Rules:**
- This prompt is the ONLY specification.
- Ignore Repository-Development-Blueprint.md, SRS.md, README roadmaps, or any planning document.
- Do not implement features outside this sprint.
- Do not modify Prediction. Do not modify SHAP. Do not implement RAG, Agentic AI, Notifications, or Workflow.
- Do not build a standalone sentiment analyzer — it must become part of the existing product (Employee Profile + Dashboard + Directory), not a new page.
- Extend existing architecture (React → Express → FastAPI NLP Service → MongoDB). Do not duplicate business logic.

**Objective:** Build an Employee Intelligence module using NLP that analyzes employee-generated text (Employee Feedback, Anonymous Feedback, Survey Comments, Manager Notes, HR Notes, Exit Interview Notes if present) and converts it into actionable workforce insights, so the platform can answer "How does the employee feel?" in addition to "who" and "why". Design must allow future text sources without code duplication, and additional NLP models to be plugged in later.

**NLP Pipeline capabilities:** Sentiment (Positive/Neutral/Negative), Emotion (Happy/Satisfied/Frustrated/Stressed/Burned Out/Demotivated), Burnout (Low/Medium/High), Topic Extraction (e.g. Compensation, Manager, Promotion, Training, Culture, Workload, Recognition, Work-Life Balance, Learning, Team), Keyword Extraction.

**FastAPI endpoints:**
- `POST /sentiment`
- `POST /sentiment/batch`
- `POST /employee-intelligence`
- `GET /employee-intelligence/:employeeId`
- `GET /employee-intelligence/dashboard`

**Database:** `EmployeeIntelligence` collection — fields: employeeId, sentiment, emotion, burnoutRisk, topics, keywords, confidence, summary, createdAt. Maintain historical records (not overwritten).

**Backend:** Service layer merging employee profile + Prediction + SHAP + Employee Intelligence — one API returns all AI insights for an employee.

**Employee Profile:** New "Employee Intelligence" section — Overall Sentiment, Dominant Emotion, Burnout Risk, Top Topics, Frequently Mentioned Keywords, AI Summary (example: "The employee has expressed increasing frustration regarding workload and career growth. Burnout risk is moderate.").

**Dashboard widgets:** Sentiment Distribution, Burnout Distribution, Top Employee Concerns, Department Sentiment, Department Burnout, Emotion Distribution, Trending Topics.

**Employee Directory:** Add filters for Sentiment, Burnout Risk, Emotion; allow sorting.

**Visualization:** Use existing chart library (Recharts) — Sentiment Pie, Emotion Distribution, Burnout Bar, Topic Frequency, Trend over Time.

**Performance:** Cache NLP results; do not recompute unchanged text; support batch analysis.

**Error handling:** Missing text, unsupported language, model unavailable, inference timeout, invalid employee.

**Deliverables:** NLP Service, FastAPI endpoints, MongoDB persistence, Employee Intelligence APIs, Dashboard widgets, Employee Profile integration, Employee Directory filters, Batch processing, Testing guide.

**Success Criteria:** Platform answers who/why/how-they-feel without introducing new standalone pages; Employee Intelligence feels like a natural extension of the existing Employee Profile and Dashboard; foundation prepared for Sprint 6 (RAG) and Sprint 7 (Agentic AI).

**Audit outcome (2026-07-29):** Audit found the NLP compute core (sentiment/emotion/topic/keyword models) already implemented and real, but non-functional as a product feature: `await get_db()` on a non-async function meant `/nlp/dashboard`/`/nlp/employee/:id` always 500'd and background-task writes silently never persisted; there was zero Express/React integration (no route, controller, or UI referenced NLP at all, beyond a disabled "Future Sprint" placeholder on the Employee Profile); the emotion/burnout/topic taxonomies didn't match this spec; and none of the 5 required FastAPI endpoints existed. All of the above were fixed/built in this pass: the `get_db()` bug, taxonomy remap (emotion → Happy/Satisfied/Frustrated/Stressed/Burned Out/Demotivated with a computed dominant emotion; burnout → categorical Low/Medium/High; topics → the required list), a template-based AI summary generator, text-hash caching, the 5 FastAPI endpoints (`employee_intelligence_routes.py`), a new `EmployeeIntelligence` Mongo collection + Express service/controller/routes (mirroring the Explanation/SHAP pattern — insert-per-generation for history, compute in FastAPI, cache in Express), a read-only merged `/employees/:id/ai-insights` endpoint (Prediction + Explanation + Employee Intelligence, no changes to either Prediction or SHAP code), Employee Profile integration, 7 Dashboard widgets, and Directory sentiment/burnout/emotion filters + sorting + a "Mood" column. See `docs/Employee-Intelligence-Testing-Guide.md` for verification steps.

**Re-audit / integration-completion pass (2026-07-29):** A second pass re-verified the above against a stricter "integration sprint, reuse-only" framing and closed three remaining gaps without touching any existing model/inference code: (1) `spacy` was imported throughout the NLP module but missing from `requirements.txt` entirely — a fresh install would fail; added it (pinned to the installed 3.8.14) alongside a new `langdetect` dependency. (2) No employee-generated text was gated for language — VADER/go_emotions/DistilBART are English-only, so non-English text silently produced meaningless output; added a `detect_language` check (single-text endpoints reject with 400, batch/aggregation endpoints skip the offending item). (3) No timeout existed around the synchronous, CPU-bound `analyze_hr_text` call inside async route handlers; moved it onto a thread executor with a configurable `NLP_INFERENCE_TIMEOUT_SECONDS` (default 30s) budget, returning 504 instead of hanging. Also added the one genuinely missing capability: `POST /employee-intelligence/batch` (FastAPI) + `POST /api/v1/employee-intelligence/batch` (Express) + a "Generate Employee Intelligence" Dashboard trigger, mirroring the existing `/explain/batch` pattern exactly, so the Dashboard widgets can be populated for the whole workforce in one action instead of profile-by-profile. No sentiment/emotion/topic model, prompt, or weight was replaced in either pass — every fix was either a persistence/wiring/robustness fix or a mapping-layer change (taxonomy dictionaries, not the underlying classifiers).

**Pre-Sprint-6 SHAP feature-schema fix (2026-07-29):** Before starting Sprint 6, fixed the SHAP feature-schema mismatch flagged by the full-stack audit: `shap_explainer.py` hardcoded a 10-item `FEATURE_KEYS`/`FEATURE_DISPLAY_NAMES` list (including two features — `salary_per_tenure`, `age_at_joining` — that never existed in the real pipeline), while `pipeline.py`'s `fit_transform_pipeline`/`transform_inference` actually build 22 columns (`NUMERICAL_COLS` + `CATEGORICAL_COLS`) in a different order. `ShapExplainerCache.initialise()` now derives `feature_names`/`categorical_keys` directly from the trained model bundle's own `feature_metadata` (`numerical_cols + categorical_cols` — the exact order `hstack([X_num, X_cat])` actually builds), with display names generated via a `humanize_feature_name()` fallback (curated overrides for known keys, automatic Title Case for anything new) instead of a hardcoded list — so a future pipeline column change can never silently drift out of sync again. `local_explainer.py`'s raw-value reconstruction was generalized the same way: only `age`/`tenure_months` need special date-math (mirroring pipeline.py's own derivation), everything else is read generically by key with the same fallback the model actually saw (`0` for missing numerical, `'UNKNOWN'` for missing categorical), so all ~22 real features now show a correct formatted value instead of the ~14 new ones silently showing "N/A". `global_explainer.py` and `plot_generator.py` needed no changes — they already read `shap_cache.feature_names`/`display_names` dynamically. `tests/test_explainability.py`'s hardcoded `== 10` assertions were updated to assert against `len(NUMERICAL_COLS) + len(CATEGORICAL_COLS)` (the real, authoritative count) instead, plus new regression tests asserting the fake features are gone and no feature resolves to a placeholder "N/A". No prediction logic or NLP code was touched. Verified: all `TestShapExplainer`/`TestLocalExplainer`/`TestGlobalExplainer`/`TestPlotGenerator` tests pass (33/33); Node's `explainService.js` required zero changes since it already read `data.allFeatures` generically rather than assuming a fixed feature count. A separate, known bug in `plot_generator.py` (local plots always show `background_data[0]`'s raw values instead of the actual employee's) was identified in the earlier audit but is out of scope for this fix — not requested here.

**Full end-to-end verification (2026-07-29):** Re-ran the complete suite after two incidental discoveries unrelated to the code fix itself: (1) the on-disk `models/active/attrition_model.joblib` was a **stale artifact** trained under an old, pre-expansion version of the pipeline (`feature_metadata` had only 10 columns, `scaler.n_features_in_ == 5`, including the two fake `salary_per_tenure`/`age_at_joining` fields) — this would have thrown a raw `sklearn` shape-mismatch error on any real prediction/explain request regardless of the SHAP fix, entirely independent of it; retrained via `train_model()` (falls back to synthetic data since no local MongoDB is running) to produce a fresh, consistent 22-feature artifact. (2) `TestExplainAPIRoutes`'s `api_client` fixture was written assuming auth is unconfigured; a real `AI_SERVICE_TOKEN` is set in `ai-service/.env`, so its requests got 401s — fixed by sending that token as a Bearer header. Neither of these touches prediction/NLP logic or the SHAP fix itself — both are artifact/test-infrastructure corrections. **Result: all 41 tests in `test_explainability.py` pass**, including the full `TestExplainAPIRoutes` class exercising `/feature-importance`, `/explain/{id}`, `/explain` (ad-hoc), and `/plots/global` through the real FastAPI app with a freshly trained model — confirming prediction → SHAP explanation works correctly end-to-end. Employee Intelligence was not re-exercised via HTTP in this pass (unaffected by any of these changes — verified analytically via `explainService.js`'s feature-count-agnostic mapping and the merged `/employees/:id/ai-insights` endpoint's pure read-only composition, both already reviewed).

### Sprint: Knowledge Intelligence (RAG)

**Role:** Lead AI Engineer for RetentionAI (one enterprise AI Workforce Intelligence Platform).

**Rules:**
- This prompt is the ONLY specification.
- Ignore Repository-Development-Blueprint.md, SRS.md, README roadmaps, and previous planning documents.
- Not a chatbot sprint — the knowledge system must power employee insights, HR decisions, future AI recommendations, and policy lookup, not a generic chat UI.
- Do NOT build a generic chatbot UI, implement Agentic AI, generate HR recommendations, or modify Prediction/SHAP/NLP.
- Extend the current architecture; reuse the existing LLM integration (do not replace providers) and existing authentication.

**Objective:** Build an enterprise Knowledge Intelligence layer using RAG answering "What organizational knowledge is relevant for this employee?" — the fourth pillar after who/why/how-they-feel.

**Knowledge sources:** HR Policies, Employee Handbook, Leave Policy, Promotion Policy, Compensation Policy, Performance Guidelines, Training Documents, Compliance Documents, Internal SOPs, Uploaded HR PDFs. Design so additional sources can be added without architectural changes.

**Architecture:** React → Express → FastAPI RAG Service → Embedding Model → ChromaDB → LLM. Vector DB logic must never be exposed to the frontend.

**Document pipeline:** Upload, Parsing, Cleaning, Chunking, Embedding, Vector storage, Metadata indexing. Metadata: filename, document type, uploadedBy, uploadDate, version, tags.

**Retrieval:** Semantic search returning relevant passages, similarity score, citations, document metadata. Configurable Top-K.

**LLM:** Reuse existing integration. Grounded answers only, every answer must include citations, never answer from model knowledge when no supporting documents are available.

**FastAPI endpoints:** `POST /documents/upload`, `POST /documents/reindex`, `POST /knowledge/query`, `GET /knowledge/search`, `GET /knowledge/document/:id`, `GET /knowledge/statistics`.

**Backend:** Express integration; frontend talks only to Express; reuse existing auth.

**Employee Profile:** "Knowledge Insights" section — e.g. Relevant Promotion Policy, Training Recommendations, Leave Policy References, Applicable Performance Rules — with cited documents displayed.

**Dashboard:** Knowledge Base Statistics — Documents Indexed, Most Queried Policies, Recent Uploads, Query Success Rate.

**Knowledge Management (admin):** Upload documents, view indexed documents, re-index, delete documents, view document metadata. Reuse existing admin UI style.

**Search:** Keyword search, semantic search, document filters, category filters.

**Performance:** Reuse embeddings, avoid duplicate embeddings, incremental indexing only, cache common queries.

**Error handling:** Invalid documents, unsupported file types, embedding failures, vector database unavailable, LLM timeout, missing citations.

**Security:** Validate uploads. Restrict document management to HR/Admin roles. Prevent prompt injection via retrieved-document sanitization where appropriate.

**Deliverables:** Document ingestion pipeline, vector database integration, Knowledge APIs, Express integration, admin knowledge management, Employee Profile knowledge section, Dashboard knowledge metrics, semantic search, testing guide.

**Success Criteria:** Platform answers who/why/how-they-feel/what-knowledge-applies, all grounded in indexed documents with visible citations. Establishes the knowledge layer Sprint 7 (AI Decision Engine) will consume.

**Audit outcome (2026-07-30):** Audit found the RAG core (parsing, chunking, embedding, ChromaDB, ChatGroq LLM) already implemented and real, but — same shape as the NLP sprint — zero Express/React integration, plus several genuine bugs: `await get_db()` (same class of bug as NLP, broke query logging/statistics), **no authentication at all** on any `/rag/*` route, an **unauthenticated arbitrary-directory-read** vulnerability (`/rag/index` accepted any server filesystem path from the request body), a `filterDocument` field that was accepted but never actually applied to retrieval, a hardcoded `k=4` with no configurable Top-K, only a single blanket confidence score per answer (no real per-passage similarity score), no LLM timeout (synchronous call blocking the event loop), no prompt-injection mitigation, and no metadata schema beyond filename/page. A likely-latent bug was also found and avoided: the old chain (`create_retrieval_chain` + `create_stuff_documents_chain`) invoked with `{"input": question}` while the prompt template required a `question` variable — a variable-name mismatch that would have raised a `KeyError` if ever exercised; replaced with direct, manually-retrieved-context + `llm.invoke()` for full control over scoring/sanitization/timeout and to eliminate that risk entirely.

All of the above were fixed/built in this pass: `await get_db()`, auth added to every RAG/knowledge route (mirroring `explain_routes.py`'s pattern), the directory-read vulnerability closed (`/rag/index`/`/rag/reindex` now only ever touch the fixed server-side `knowledge_base/` folder; all per-document indexing goes through `/documents/upload`/`/documents/reindex` with an Express-controlled `filePath`), a text-cleaning step, prompt-injection sanitization (`app/rag/security/sanitizer.py` — phrase-stripping plus explicit `<<<DOCUMENT>>>` delimiters and a reinforced system prompt), an LLM timeout (`RAG_LLM_TIMEOUT_SECONDS`, off-thread execution), a hard code-level grounding guard (the LLM is never called when zero relevant chunks are retrieved — not just a prompt instruction), configurable Top-K, real per-passage similarity scores (clipped to [0,1] for display), a working `documentType`/`tags` filter, deterministic chunk IDs (`documentId-index-contentHash`) making indexing genuinely idempotent/incremental (re-indexing unchanged text is a no-op overwrite, not a duplicate), the 6 new FastAPI endpoints (legacy `/rag/*` kept as authenticated aliases), a new `KnowledgeDocument` Mongo model + full Express service/controller/routes (mirroring the Explanation/EmployeeIntelligence FastAPI-computes/Express-persists split), a document-upload multer config (20MB, PDF/DOCX/TXT/MD allowlist), the admin Knowledge Management page (upload/list/filter/search/reindex/delete, RBAC-gated to HR_MANAGER/ADMIN for writes), an Employee Profile "Knowledge Insights" card (four templated, on-demand policy lookups — promotion/performance/leave/training — framed as grounded references, not personalized recommendations, per the "no HR recommendations yet" constraint), and a Dashboard "Knowledge Base" section (Documents Indexed, Indexed Chunks, Queries, Query Success Rate, Most Queried Policies, Recent Uploads). No Prediction/SHAP/NLP code was touched.

Verified: direct Python script exercising the full pipeline (index → idempotent re-index confirmed no duplication → semantic search → keyword search → grounded query with correct citations and scores → hard-guard correctly refused an off-topic question with zero LLM calls and zero cost → delete confirmed chunk removal) — all passed. A second HTTP-level test through the real FastAPI app (`TestClient`) confirmed: no-token request → `401`; `/documents/upload` → `200` with 1 chunk indexed; `/knowledge/query` → `200` with a correct grounded answer, real citation (`documentName`/`chunkId`/`similarityScore: 0.43`), and latency; `/knowledge/search` (semantic) → `200` with a real per-result score; `/knowledge/document/:id` → `200` with 1 chunk; `/knowledge/statistics` → `200` (gracefully degraded to zeros for the Mongo-backed fields since no local MongoDB was running in this dev environment — the `await get_db()` fix's try/except correctly prevented this from breaking the request); `DELETE /documents/:id` → `200`; and a follow-up `/knowledge/document/:id` → `404` confirming the chunks were actually gone. Exit code 0. See `docs/Knowledge-Intelligence-Testing-Guide.md` for full manual verification steps.

### Sprint: AI Decision Intelligence Engine

**Role:** Principal AI Architect transforming RetentionAI into an enterprise AI Workforce Decision Intelligence Platform.

**Rules:**
- This prompt is the ONLY specification.
- Ignore Repository-Development-Blueprint.md, SRS.md, README roadmaps, and previous planning documents.
- Do NOT create a generic chatbot. Do NOT build an autonomous agent.
- Do NOT rebuild ML, SHAP, NLP, or RAG — reuse all existing modules/APIs. Keep architecture modular. Maintain backward compatibility.

**Objective:** Centralized Decision Intelligence Engine combining Employee Data + Prediction + SHAP + Employee Intelligence + Knowledge Intelligence + Business Rules into one explainable recommendation — answering "What should HR do next?" after who/why/how-they-feel/which-policies-apply.

**Architecture:** React → Express → Decision Engine Service → ML → SHAP → NLP → RAG → LLM → MongoDB. Do not bypass existing services; reuse all existing APIs.

**Decision pipeline (per employee):** Load Employee Profile → Load Prediction → Load SHAP → Load Employee Intelligence → Retrieve Relevant Knowledge → Evaluate Business Rules → Generate Recommendation → Generate Reasoning → Store Decision.

**Recommendation categories:** Retention Plan, Promotion Review, Compensation Review, Training Recommendation, Mentorship Assignment, Manager Intervention, Career Development, Recognition Program, Workload Adjustment, Well-being Support, Role Change Suggestion, No Action Required. Design so new types can be added without modifying existing logic.

**Recommendation structure (every recommendation must include):** Recommendation Type, Priority, Confidence, Reasoning, Supporting Evidence, Affected Factors, Related Policies, Expected Outcome, Review Date, Generated At.

**Evidence:** Every recommendation must cite evidence from Prediction, SHAP, Employee Intelligence, Knowledge Base, and Business Rules. Never generate unsupported recommendations.

**Business rules:** Configurable, modular, extensible rule evaluation (e.g. High Attrition Risk AND High Burnout AND Promotion overdue → Promotion Review; High Attrition AND Negative Sentiment AND Compensation complaints → Compensation Review).

**FastAPI endpoints:** `POST /decision/generate`, `POST /decision/batch`, `GET /decision/:employeeId`, `GET /decision/dashboard`, `GET /decision/history`.

**Backend:** Express integration; merge Decision Engine into the existing AI Insights endpoint so the Employee Profile requires only one AI request.

**Database:** `Decision` collection — employeeId, recommendationType, priority, confidence, reasoning, evidence, relatedPolicies, expectedOutcome, reviewDate, status, generatedAt. Maintain decision history.

**Employee Profile:** "AI Recommendations" section — Recommendation, Priority, Confidence, Evidence, Supporting Factors, Related Policies, Expected Benefits, Review Timeline. HR can Accept / Dismiss / Mark Under Review.

**Dashboard:** Recommendation Distribution, Critical Employees, High Priority Actions, Department Recommendations, Recommendation Trends, Decision History, HR Action Queue.

**Manager Dashboard:** Team Risk, Pending Actions, Recommended Interventions, Top Concerns, Priority Employees.

**Analytics:** Recommendation Acceptance Rate, Decision Accuracy, Recommendation Outcomes, Intervention Success Rate, Retention Improvement.

**Performance:** Cache generated recommendations; don't regenerate unless employee data changes; support batch generation.

**Security:** Restrict recommendation approval to HR/Admin. Log every recommendation generation. Audit every status change.

**Error handling:** Missing AI modules, missing policies, inference failure, partial evidence, timeout, model unavailable.

**Deliverables:** Decision Engine, Rule Evaluation Engine, Recommendation Generator, Express Integration, MongoDB Decision History, Employee Profile AI Recommendations, Dashboard Recommendation Analytics, Manager Dashboard, Batch Recommendation Generation, Testing Guide.

**Success Criteria:** Platform answers who/why/how-they-feel/which-policies-apply/what-HR-should-do-next. Every recommendation explainable, evidence-backed, policy-aware, generated from the combined intelligence of the entire platform. Flagship capability preparing for executive reporting and workflow automation.

**Audit outcome (2026-07-30):** Audit found no Decision Engine, Rule Engine, `Decision` model, or any `/decision/*` route anywhere in the codebase — this is a net-new capability. It also found a pre-existing `ai-service/app/agent/` module (a fixed, deterministic ML→SHAP→NLP→RAG→LLM orchestration, not a tool-selecting autonomous agent, and therefore safe to reuse under the "no autonomous agent" rule) that was reusable but broken: the same `await get_db()` bug from prior sprints (silently dropping agent-run persistence), a stale topic string (`"Learning & Development"`) that could never match the Employee Intelligence module's actual `"Learning"`/`"Training"` topic taxonomy, zero authentication on any `/agent/*` route, and an `rag_tool.py` that duplicated direct ChromaDB access instead of calling the existing `rag_service.search_knowledge()`.

All of the above were fixed, then a new Decision layer was composed on top without touching any ML/SHAP/NLP/RAG logic: the four agent-module bugs above were fixed in place; a deterministic `app/decision/rules/rule_engine.py` was built implementing the fixed 12-category taxonomy as an ordered set of most-specific-first rules over prediction/SHAP/Employee-Intelligence/tenure signals (a stray trailing comma that silently turned one rule's condition into an always-truthy 1-tuple was caught and fixed via direct rule-by-rule testing before shipping); `app/decision/services/decision_service.py` composes the existing agent orchestrator's output with the rule engine's verdict into the required recommendation structure (type, priority, confidence, reasoning, full 5-source evidence, affected factors, related policies, expected outcome, review date) and logs every generation to FastAPI's own append-only `decisions` collection; the 5 required FastAPI endpoints were added (dashboard/history registered before the `:employeeId` param route, all authenticated); a Node `Decision` Mongoose model, service, controller, and RBAC-gated routes (`/api/v1/decisions/*`, HR/Admin-only for generate/batch/status-change) were built with insert-per-generation history and a full `statusHistory` audit trail on every status change; the Decision Engine was merged into the existing `getEmployeeAiInsights` endpoint so the Employee Profile now fetches prediction + explanation + intelligence + decision in one request; and the client was extended with an Employee Profile "AI Recommendations" card (Accept/Dismiss/Mark Under Review, HR/Admin-gated), a Dashboard "AI Recommendations" analytics section (Recommendation Distribution, Recommendation Trends, Critical Employees, High Priority Actions, Department Recommendations, Decision History, HR Action Queue), and a new Manager Dashboard page (Team Risk, Pending Actions, Recommended Interventions, Top Concerns, Priority Employees), linked from the sidebar. "Promotion overdue" (referenced by the rule spec but not backed by any PromotionHistory data source in the codebase) is derived from a documented heuristic (`tenureMonths >= 24 and promotionFrustration >= 0.2`) grounded in real signals rather than fabricated. See `docs/Decision-Intelligence-Testing-Guide.md` for full manual verification steps.

**End-to-end HTTP verification (2026-07-30):** Since no local MongoDB was running, booted `mongodb-memory-server` (already a `server/` devDependency) bound to the default `127.0.0.1:27017`, seeded realistic employee documents, and drove the real FastAPI app via `TestClient` (real trained model, real Groq LLM, no mocks). All 8 checks passed: auth enforcement (401 with no/wrong token, 200 with the correct bearer token), `POST /decision/generate` returning a correctly shaped response with evidence populated across all 5 required sources, `GET /decision/{employeeId}`, `GET /decision/dashboard`, `GET /decision/history`, `POST /decision/batch`, and — using a second, deliberately extreme burnout/negative-sentiment/no-promotion employee profile — confirmation that the deterministic rule engine actually selects a non-default rule (`high_burnout_workload` → `WORKLOAD_ADJUSTMENT`/`HIGH`) rather than always falling through to `NO_ACTION_REQUIRED`. One real bug surfaced and was fixed: `recommendation_prompt.py` instructs the LLM to write `"policyReference": "...else null"`, which the LLM sometimes took literally, emitting the JSON **string** `"null"` instead of a real `null` — `reasoning_chain.py` now normalizes `"null"`/`"none"`/empty-string policy references to `None` after parsing the LLM's JSON. Separately (noted, not fixed — out of scope for this sprint): the currently-active trained model, retrained on synthetic data during the Sprint 5 SHAP fix because no real dataset/MongoDB was available at the time, appears under-calibrated for decision-engine purposes — a deliberately extreme at-risk profile (age 27, $38k salary, 65 overtime hrs/week, 1/5 satisfaction, 60% attendance, no promotions) still scored only `riskScore=0.224` (`LOW`). Since several business rules gate on `mlRiskLevel == HIGH/MEDIUM`, this could silently suppress `PROMOTION_REVIEW`/`COMPENSATION_REVIEW`/`MANAGER_INTERVENTION` in a real deployment even when other signals are extreme; this is a training-data/model-artifact concern for a future sprint (e.g. training on the real IBM HR dataset), not a defect in the Decision Engine's own logic, which correctly reads whatever risk level the model reports.

**API-contract fix (2026-07-30):** A follow-up audit (report-only, no build) re-verified all 15 Sprint 7 deliverables end-to-end and found one real defect: `POST /decision/batch` always stamped every generated decision's `generatedBy` as `"system"`, discarding the real authenticated HR/Admin user each employee entry actually carried — `generate_batch_decisions()` in `ai-service/app/decision/services/decision_service.py` used its own function-level `user_id` default in every iteration instead of reading `emp.get("userId")` per employee, even though Node already sent the real acting user's ID on every batch entry (`server/src/services/decisionService.js`, unchanged). Single-employee generation (`POST /decision/generate`) was never affected. Fixed by having `generate_batch_decisions()` prefer each employee's own `userId`, falling back to the batch-level default only when an entry omits it (preserves backward compatibility for any caller that doesn't send one) — no change to `decision_routes.py`'s request/response schemas, `rule_engine.py`, `agent_orchestrator.py`, or any recommendation-generation logic. Added `ai-service/tests/test_decision_engine.py` (4 tests, all passing, mocking the orchestrator so they run without live MongoDB/model/Groq) covering: single-generation records the authenticated user; batch generation records each employee's own authenticated user (the regression guard for this exact bug); an employee entry omitting `userId` still falls back correctly (backward compatibility); and a failure for one employee in a batch doesn't affect another's correct `generatedBy` tagging. Re-running the audit after this fix: all 15 checklist items — Decision Engine, Business Rules, ML/SHAP/NLP/RAG integration, LLM reasoning, Employee Profile, Dashboard, Manager Dashboard, Decision history, Recommendation lifecycle, RBAC, API contracts, and MongoDB persistence — are ✅ Complete.

### Sprint: ML Production Readiness (Prediction Engine Overhaul)

**Role:** Principal Machine Learning Engineer preparing RetentionAI's prediction engine for production deployment.

**Rules:**
- This prompt is the ONLY specification.
- Ignore Repository-Development-Blueprint.md, SRS.md, README roadmaps, and previous planning documents.
- Do NOT implement new product features.
- Do NOT modify Dashboard, Decision Engine, RAG, NLP, or SHAP unless required for compatibility with the improved ML model.
- Do NOT redesign the architecture, break existing APIs, or modify Decision Engine/RAG/NLP logic. Only improve the ML subsystem.

**Situation:** The end-to-end audit (Sprint 7) found the model under-calibrated — an extreme high-risk employee profile still received a LOW attrition prediction.

**Objectives:** Improve prediction accuracy, probability calibration, recall for attrition cases, SHAP explanation quality, generalization, and production readiness, while maintaining complete backward compatibility.

**10-phase spec:** (1) evidence-based ML audit — dataset/feature quality, leakage, imbalance, thresholds; (2) dataset validation, preferring the real IBM HR Attrition CSV if available; (3) feature engineering (tenure, promotion gap, salary growth, training completion, leave frequency, sentiment/burnout/engagement, reusing Sprint 5 outputs); (4) benchmark Logistic Regression/Random Forest/XGBoost/LightGBM/CatBoost on identical splits; (5) systematic hyperparameter tuning; (6) probability calibration; (7) threshold optimization (never assume 0.5, prioritize recall with reasonable precision); (8) SHAP compatibility (dynamic feature names, no hardcoding); (9) persona validation (extreme high-risk and low-risk profiles); (10) production validation (no regressions across training/prediction/batch/SHAP/Decision Engine/Employee Profile/Dashboard/API contracts).

**Deliverables:** Improved model, retrained pipeline, updated artifacts, dynamic SHAP compatibility, benchmark/calibration/threshold/feature-importance reports, confusion matrix, ROC curve, PR curve, model evaluation documentation.

**Phase 1 audit (2026-07-30, evidence-based — see `docs/ML-Model-Evaluation-Report.md` §1 for full detail):** Two independent, measured root causes for "extreme high-risk profile → LOW prediction," not assumed: (1) `generate_synthetic_data()`'s label (the only data ever used to train the live model — no real dataset present, no local MongoDB running) was a function of only 4 signals; every "soft" HR signal had a measured correlation with the label of **|r| < 0.05** (pure noise) — confirmed via direct correlation measurement on a fresh sample, not guesswork. (2) 13 of the 17 numerical features (job_satisfaction, performance_rating, overtime_hours, promotion history, training hours, survey scores, etc.) had **no data source anywhere but the `employees` collection** — dedicated `Attendance`/`Performance`/`PromotionHistory`/`TrainingHistory`/`Survey`/`EmployeeFeedback` collections exist and are populated by the app's HR modules but were never joined into `load_data_from_db()` or inference, meaning real predictions always used defaults for most of the feature vector regardless of model quality. Also confirmed: ~81/19 class imbalance, current model (XGBoost) recall of only 0.26, zero probability calibration, zero threshold optimization (metrics computed at an implicit 0.5 cutoff; production risk buckets used a fixed, never-evaluated 0.34/0.64 split), a minor scaler/encoder leakage (fit on the full dataset before the train/test split), and LightGBM/CatBoost missing from dependencies. The real IBM HR Attrition CSV is not present in this repository or common local folders and could not be fetched (no URL provided, no download capability) — user chose to rebuild the synthetic generator as the primary dataset while also wiring up `IBM_DATASET_CSV_PATH` support for later (**"Do both"**), and **"Full build"** for Phases 3-10.

**Full build (2026-07-30):** All 10 phases implemented — see `docs/ML-Model-Evaluation-Report.md` for complete numbers, tables, and per-phase detail. Summary: `generate_synthetic_data()` rewritten (1,000→5,000 records, logistic latent-utility label genuinely dependent on every engineered feature, ~19.6% base rate matching the real IBM benchmark); `load_data_from_db()` rewritten to join Employee with all 6 real HR sub-collections plus Sprint 5's `nlp_insights`; 3 fabricated-only features removed (`distance_from_home`, `environment_satisfaction`, `years_in_current_role`), 8 new real-data-backed features added (`promotion_gap_ratio`, `salary_growth_pct`, `training_completion_rate`, `leave_frequency`, `engagement_score`, `sentiment_score`, `burnout_score`, `promotion_frustration_nlp`/`manager_conflict_nlp`); scaler/encoder leakage fixed (fit after split); a new `app/preprocessing/enrichment.py` performs the same real-data join per-employee at inference time (used by prediction, SHAP explanation, and the Decision Engine orchestrator); `lightgbm`/`catboost`/`matplotlib` added as dependencies; `app/training/trainer.py` rewritten to benchmark all 5 algorithms on an identical split, tune the winner via `RandomizedSearchCV`, calibrate via isotonic `CalibratedClassifierCV`, and optimize the decision threshold via F2-maximization on cross-validated out-of-fold predictions (min-precision floor 0.3); a new `app/training/reports.py` generates the confusion matrix/ROC/PR/calibration-curve/feature-importance plots plus a JSON report under `models/active/plots/training/`. **Result: LightGBM selected (F1=0.610, ROC-AUC=0.877 in the benchmark), tuned, calibrated, threshold=0.16 — final recall 0.883 (up from 0.26), F1 0.593 (up from 0.36), ROC-AUC 0.880 (up from 0.76).**

Three real SHAP compatibility bugs were found and fixed while validating Phase 8 (not just structurally — by actually invoking the explainer against the retrained model): `shap_explainer.py` tried to wrap `bundle["model"]` directly, but that's now always a `CalibratedClassifierCV` which `TreeExplainer`/`LinearExplainer` cannot introspect — fixed to explain the tuned, uncalibrated `importance_estimator` bundle key instead (calibration is monotonic, so feature attribution is unaffected); `local_explainer.py` had its own independent hardcoded 0.34/0.64 risk-bucketing that would have disagreed with `/predict`'s new threshold-based bucketing — unified to read the same bundle threshold; and `/explain/{id}`, `/explain/batch`, and `/plots/local/{id}` explained the raw Employee document without the same real-data enrichment `predict_single()` applies, meaning SHAP would have explained a different (mostly-default) feature vector than the one actually used for the real prediction — fixed by calling the same shared `enrich_employee_doc()`.

**Persona validation (2026-07-30):** Verified directly against the retrained, calibrated model. Persona 1 (high performer, 4.5 years since last promotion, sentiment 0.08, burnout 0.85, compensation frustration 0.8) — the exact profile type this sprint's audit found scoring LOW under the old model — now scores **riskScore=0.971 → HIGH**, with the SHAP explanation correctly attributing it to Avg. Survey Score, Burnout Score, Promotion Frustration, and Sentiment Score. Persona 2 (recently promoted, sentiment 0.92, burnout 0.05, excellent performance) scores **riskScore≈0.000 → LOW**.

**Production validation (2026-07-30):** `tests/test_ml.py` (28 tests, rewritten for the new `fit_transform_pipeline`/`train_and_select_best_model` signatures) and `tests/test_explainability.py` (41 tests, updated for the calibrated-model SHAP fix and the new dynamic threshold) — both 100% passing against the live FastAPI app. Full app import (50 routes) succeeds. The Decision Engine's `orchestrate_recommendation()` re-run directly against the new model bundle end-to-end (real model, real Groq LLM) with zero changes to rule evaluation or recommendation logic. API contracts unchanged — `riskScore`/`riskLevel`/`confidence`/`employeeId` field names and types are identical; confirmed no Node or React code hardcodes algorithm names or specific metrics keys, so zero changes were needed on either side. Not verified in this environment: a live click-through of the Employee Profile/Dashboard UI (no running MongoDB with real employee/HR-module data available in this session) — recommended before sign-off. See `docs/ML-Model-Evaluation-Report.md` for the full report.
