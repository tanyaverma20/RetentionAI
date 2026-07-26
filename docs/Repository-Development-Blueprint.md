# Repository Architecture & Development Blueprint: RetentionAI

**Purpose:** Master implementation guide for RetentionAI. It translates the approved SRS, SDD, Database Design Document, and Backend API Design Document into a practical repository layout and delivery workflow. It does not define application code, APIs, or database schemas.

## 1. Repository Overview

RetentionAI is maintained as a single repository with independently deployable frontend, backend, and Python AI-service applications. This keeps the MVP understandable for one developer while respecting the distinct runtime ecosystems: React/Node.js for product workflows and Python for ML, SHAP, NLP, RAG, and agent work.

- `client/` owns the browser experience and must not contain business rules or secrets.
- `server/` owns authentication, authorization, validation, product workflows, persistence coordination, and the public API.
- `ai-service/` owns model artifacts, inference, explainability, NLP, retrieval, and controlled agent execution; it is private to the backend.
- `docs/` preserves decisions, requirements, and operating guides.
- `datasets/`, `models/`, `uploads/`, `scripts/`, and `tests/` isolate non-source artifacts and operational work.

This separation prevents frontend, backend, and AI concerns from becoming tangled, allows deployment of the React, Express, and Python runtimes independently, and lets each module evolve without introducing microservices or a complex monorepo toolchain.

## 2. Complete Folder Structure

```text
RetentionAI/
├── client/                              # React application
│   ├── public/                          # Static public assets
│   ├── src/
│   │   ├── assets/                      # Images, icons, static UI assets
│   │   ├── components/                  # Reusable presentational components
│   │   ├── constants/                   # UI constants and shared enumerations
│   │   ├── features/                    # Feature-specific UI, state, and actions
│   │   ├── hooks/                       # Reusable React hooks
│   │   ├── layouts/                     # Public/authenticated/admin page shells
│   │   ├── pages/                       # Route-level page compositions
│   │   ├── routes/                      # Route definitions and route guards
│   │   ├── services/                    # Axios client and backend API clients
│   │   ├── store/                       # Redux store, slices, selectors
│   │   ├── styles/                      # Global Tailwind/style entry points
│   │   ├── utils/                       # Pure UI formatting/validation helpers
│   │   ├── App.jsx                      # Application composition root
│   │   └── main.jsx                     # Browser bootstrap
│   ├── tests/                           # Frontend unit/component tests
│   ├── package.json                     # Frontend dependencies and scripts
│   └── vite.config.js                   # Frontend build/dev configuration
├── server/                              # Express modular-monolith backend
│   ├── src/
│   │   ├── config/                      # Environment/configuration bootstrap
│   │   ├── controllers/                 # Request/response adapters
│   │   ├── errors/                      # Typed application errors and mapping
│   │   ├── middlewares/                 # Auth, RBAC, validation, logging, errors
│   │   ├── models/                      # Mongoose persistence definitions
│   │   ├── repositories/                # Scoped database-access operations
│   │   ├── routes/                      # Versioned route assembly
│   │   ├── services/                    # Business workflows and external orchestration
│   │   ├── utils/                       # Shared backend helpers
│   │   ├── validators/                  # Zod request/file validation contracts
│   │   ├── app.js                       # Express application composition
│   │   └── server.js                    # Process startup/shutdown
│   ├── tests/                           # Backend unit/integration tests
│   ├── uploads/                         # Local-development transient uploads only
│   ├── package.json                     # Backend dependencies and scripts
│   └── .env.example                     # Backend variable template
├── ai-service/                          # Private Python AI runtime
│   ├── app/
│   │   ├── agents/                      # Controlled agent, tool registry/state
│   │   ├── api/                         # Private service request/health interface
│   │   ├── embeddings/                  # Embedding-provider integration
│   │   ├── explainability/              # SHAP computation/presentation adapters
│   │   ├── nlp/                         # Text cleaning, VADER, DistilBERT analysis
│   │   ├── prediction/                  # Inference and result shaping
│   │   ├── preprocessing/               # Consistent feature transformations
│   │   ├── prompts/                     # Versioned RAG/agent prompt templates
│   │   ├── rag/                         # Ingestion/chunking/RAG orchestration
│   │   ├── retrieval/                   # ChromaDB query/context selection
│   │   ├── training/                    # Train/evaluate/approve model workflows
│   │   ├── utils/                       # Settings, logging, common AI helpers
│   │   └── main.py                      # AI service composition entry point
│   ├── tests/                           # ML/NLP/RAG/agent tests
│   ├── requirements.txt                 # Python dependencies
│   └── .env.example                     # AI-service variable template
├── datasets/                            # Approved anonymized source/demo datasets
│   ├── raw/                             # Immutable input datasets; never production PII
│   ├── processed/                       # Reproducible prepared datasets
│   └── README.md                        # Provenance, permissions, data dictionary
├── models/                              # Versioned ML artifacts/metadata; no secrets
│   ├── active/                          # Explicit approved active artifact reference
│   ├── archive/                         # Retired reproducible artifacts
│   └── README.md                        # Version, metrics, approval guidance
├── uploads/                             # Local-only document/report staging; gitignored
│   ├── documents/
│   └── reports/
├── scripts/                             # Repeatable maintenance/data/model utilities
│   ├── data/                            # Import/quality preparation tasks
│   ├── model/                           # Training/evaluation invocation helpers
│   └── ops/                             # Safe local operational helpers
├── tests/                               # Cross-service and end-to-end test assets
│   ├── fixtures/                        # Sanitized test data
│   ├── integration/                     # API-to-AI/database workflows
│   ├── e2e/                             # User journey tests
│   └── manual/                          # Manual/UAT test cases
├── docs/                                # SRS, SDD, DDD, BADD, guides and ADRs
│   ├── decisions/                       # Architecture decision records
│   ├── guides/                          # Installation/deployment/user/developer guides
│   └── diagrams/                        # Source diagram assets
├── .github/                             # PR/issue templates and CI workflows
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── .gitignore                           # Excludes secrets, artifacts, uploads, caches
├── .editorconfig                        # Cross-editor whitespace conventions
├── README.md                            # Repository entry point
└── LICENSE                              # Project licensing decision
```

## 3. Frontend Folder Breakdown

| Folder | What belongs here | What must not belong here |
|---|---|---|
| `pages/` | Route-level screens that compose features/components. | API implementation, global state definitions, duplicate reusable widgets. |
| `components/` | Generic, reusable UI elements: tables, badges, filters, dialogs, charts wrappers, loading/error states. | Page-specific business orchestration. |
| `layouts/` | Public/authenticated/admin shells, navigation, header, sidebars. | Feature domain logic. |
| `routes/` | Route map, route guards, role-aware navigation rules. | Backend authorization logic. |
| `store/` | Redux store configuration, slices, selectors, async state conventions. | Unbounded server-data duplication or secrets. |
| `features/` | Feature-local UI/state/actions for auth, employees, dashboard, predictions, interventions, knowledge base, chat, reports, settings. | Cross-feature utility duplication. |
| `services/` | Axios instance, interceptors, API client modules grouped by backend resource. | Direct UI rendering or business policy decisions. |
| `hooks/` | Reusable hooks for permissions, debouncing, pagination, API states. | One-off page handlers. |
| `utils/` | Pure formatting, date/risk-label, and client-safe helper functions. | Network calls or mutable global state. |
| `constants/` | Shared UI-safe enums, labels, routes, chart settings. | Server-only permission source of truth. |
| `assets/` | Logos, icons, images, supported static assets. | Uploaded employee/HR files. |

Frontend feature modules should keep related page fragments, feature-specific components, selectors, and tests close together. A page must use shared components before creating a new local duplicate. Forms use React Hook Form and Zod client-side for usability; Express validation remains authoritative.

## 4. Backend Folder Breakdown

| Folder | Responsibility |
|---|---|
| `config/` | Read/validate environment variables, configure database, CORS, security, and external service clients. |
| `controllers/` | Convert validated HTTP requests to service calls and return the documented response envelope. Keep thin. |
| `services/` | Own business workflows: import, prediction orchestration, intervention lifecycle, report generation, document lifecycle, notification logic. |
| `routes/` | Mount versioned public resource routes and assign middleware in a visible order. |
| `middlewares/` | Request ID, auth, RBAC/scope, rate limiting, upload handling, validation, audit context, centralized errors. |
| `validators/` | Zod contracts for request/query/path/file metadata and shared validation rules. |
| `models/` | Mongoose persistence definitions derived from the approved Database Design Document. |
| `repositories/` | Focused data access/query functions, pagination/projection, and transaction boundary helpers. |
| `errors/` | Canonical error types/codes and safe mapping to the BADD error response. |
| `utils/` | Stateless helpers: dates, pagination, response formatting, logging redaction, report formatting. |
| `uploads/` | Non-production transient upload staging; production uses configured managed storage. |

Controllers never directly call unrelated repositories. Services own transactions and AI-service orchestration. Authorization/scope validation occurs before data access, not only in the UI. Repository queries must accept a scope object so developers cannot accidentally build unrestricted HR queries.

## 5. AI Service Folder Breakdown

| Folder | Responsibility |
|---|---|
| `api/` | Private service boundary, request validation, health/readiness response, structured error translation. |
| `preprocessing/` | Feature cleanup, encoding, scaling, and feature contract compatibility shared by training/inference. |
| `training/` | Dataset validation, train/test split, candidate evaluation, tuning, model approval artifact generation. |
| `prediction/` | Active model loading, input feature checks, inference, risk categorization, versioned result shaping. |
| `explainability/` | SHAP local/global analysis and HR-readable factor summaries. |
| `nlp/` | Text normalization, VADER sentiment, DistilBERT concern classification, confidence and review flags. |
| `rag/` | Document parsing, cleaning, recursive chunking, ingestion-job orchestration. |
| `embeddings/` | Sentence Transformer loading and embedding generation. |
| `retrieval/` | ChromaDB access, metadata/scope filters, relevance ranking, source/citation assembly. |
| `prompts/` | Versioned, reviewed prompt templates and output instructions; no secrets. |
| `agents/` | Controlled LangChain agent, tool registry, state, evidence sufficiency, guardrails. |
| `utils/` | Settings, safe logs, correlation IDs, model/vector helpers, shared result types. |

The AI service must make no direct business-database writes. Express sends authorized minimum data and persists validated results. Prompts and model artifacts are versioned; raw production datasets and secrets are never stored inside source folders.

## 6. Configuration Files

| File | Purpose |
|---|---|
| Root `.gitignore` | Exclude `node_modules`, Python environments/caches, secrets, uploads, generated reports, local datasets, model binaries where policy requires, and logs. |
| Root `.editorconfig` | Standard indentation, line endings, final newline, and whitespace across JavaScript/Markdown/Python. |
| Root `README.md` | Product overview, prerequisites, local start order, documentation links, contribution policy, and safe demo data note. |
| `client/package.json` | Frontend dependency versions and standard scripts. |
| `client/vite.config.js` | Vite build/dev proxy/alias configuration. |
| `client/tailwind.config.js` | Tailwind content scanning, theme tokens, and extensions. |
| `client/eslint.config.js` | JavaScript/React linting rules. |
| `client/.prettierrc` | Frontend formatting convention. |
| `server/package.json` | Express runtime/test/lint scripts and backend dependencies. |
| `server/.env.example` | Safe documented template for backend configuration. |
| `server/eslint.config.js` / `.prettierrc` | Backend quality/formatting standards. |
| `ai-service/requirements.txt` | Pinned/compatible Python runtime dependency set. |
| `ai-service/.env.example` | Safe documented template for AI configuration. |
| `ai-service/pyproject.toml` or equivalent | Python formatting, linting, testing, and packaging conventions. |
| `.github/workflows/*.yml` | CI validation/build/deployment workflow definitions. |
| `docker-compose.yml` (future/local optional) | Repeatable multi-runtime local environment; not required to begin MVP development. |

Every `.env.example` documents variable names and non-secret placeholders only. No real key, URI, token, employee data, or model credential may be committed.

## 7. Coding Standards

- **Naming:** JavaScript variables/functions use `camelCase`; React components, classes, and files exporting a component use `PascalCase`; constants use `UPPER_SNAKE_CASE`; Python modules/functions use `snake_case`; Python classes use `PascalCase`; folders use lowercase kebab-case only when a multiword folder is unavoidable.
- **Files:** One primary responsibility per file. Name by capability, not vague terms such as `helpers2` or `common-new`.
- **Functions/classes:** Keep small, deterministic where possible, and explicit about inputs/outputs. Avoid hidden global state and oversized multipurpose functions.
- **React:** Components are presentational by default; route pages compose them. Keep API work in services/hooks/feature actions. Handle loading, empty, error, and permission-denied states.
- **Express:** Controllers are thin; services contain business decisions; repositories contain persistence queries; middleware handles cross-cutting concerns. Never trust client role/scope input.
- **Python:** Keep training, inference, and retrieval isolated. Training-only dependencies/logic must not be required on every inference path unless necessary.
- **Errors:** Throw/return typed, actionable domain errors; translate centrally to BADD envelopes. Never return stack traces or secrets.
- **Comments:** Explain decisions, constraints, safety rules, or non-obvious reasoning—not what obvious syntax does. Keep docs current; no stale commented-out code.
- **Quality:** Format and lint before review. Prefer existing utilities/components/contracts over creating near-duplicates.

## 8. Git Workflow

`main` is protected and always deployable. `develop` is the integration branch for the current MVP release. Developers create short-lived branches from `develop`, open pull requests back to `develop`, and merge `develop` into `main` only after milestone acceptance.

Each PR must be focused, linked to a requirement/task, include tests appropriate to the change, describe user-visible behaviour and risks, and avoid unrelated formatting churn. Use squash merge for ordinary feature branches so `develop` remains readable; preserve release/critical-fix context where a merge commit is useful. Hotfixes branch from `main`, receive focused review/testing, merge back to both `main` and `develop`.

## 9. Branch Naming

```text
feature/authentication
feature/employee-management
feature/dashboard-risk-analytics
feature/ml-model
feature/shap-explanations
feature/rag-knowledge-base
feature/agent-advisor
bugfix/login-token-refresh
bugfix/prediction-status
hotfix/token-validation
docs/database-design
chore/upgrade-dependencies
```

Use lowercase kebab-case after the prefix. One branch should represent one coherent outcome; do not combine unrelated feature, refactor, and dependency work.

## 10. Commit Message Convention

Use Conventional Commit-style imperative messages:

```text
feat(auth): add password reset workflow
fix(prediction): preserve failed batch status
refactor(employee): centralize scoped directory query
docs(sdd): clarify AI-service boundary
style(client): apply shared table spacing
test(rag): add insufficient-evidence coverage
build(ai): align compatible NLP dependencies
chore(repo): update gitignore for model artifacts
```

Format: `<type>(optional-scope): concise imperative summary`. Keep the first line under 72 characters. The body, if needed, explains purpose, risk, migration, or test evidence. Never use vague commits such as `updates`, `fix`, or `final changes`.

## 11. Development Order

| Milestone | Outcome | Dependencies |
|---|---|---|
| 1. Foundation and authentication | Repository setup, configuration templates, auth, RBAC, error envelope, audit baseline. | SRS/BADD/DDD decisions. |
| 2. Employee and organization management | Users, roles, departments, employees, attendance/performance and validated CSV import. | Milestone 1. |
| 3. Dashboard and interventions | Role-scoped directory, risk-ready dashboards, intervention workflow, notifications, reports baseline. | Milestone 2 and seeded data. |
| 4. ML service | Dataset contract, preprocessing, trained baseline, model metadata, private inference integration. | Stable employee feature inputs. |
| 5. SHAP and prediction history | Explanation outputs, risk profile, batch job status/history, model observability. | Milestone 4. |
| 6. NLP and knowledge base/RAG | Feedback/survey NLP, document upload/ingestion, embeddings, cited policy chat. | Core auth/document lifecycle. |
| 7. Controlled agent advisor | Allow-listed tools, scoped evidence, guarded recommendation outputs, feedback capture. | Prediction, SHAP, RAG. |
| 8. Integration hardening | Cross-service contracts, failure states, privacy checks, end-to-end user journeys. | Milestones 1–7. |
| 9. Testing and acceptance | Automated test suite, UAT scripts, performance/accessibility checks, demo-data reset. | Integrated application. |
| 10. Deployment and handoff | Vercel/Render/Atlas deployment, monitoring basics, documentation, presentation/demo. | Tested release candidate. |

## 12. Testing Strategy

| Area | Required coverage |
|---|---|
| Frontend | Component rendering, forms/validation, route guards, loading/error/empty states, role-aware display, chart input formatting. |
| Backend | Unit tests for services/validators, integration tests for auth/RBAC/scope, import validation, error envelopes, audit events, and AI-service failure mapping. |
| ML | Reproducible preprocessing, feature compatibility, prediction range/category, model loading, evaluation report, SHAP output shape, no data leakage checks. |
| NLP/RAG/agent | Sentiment/concern examples, parser/chunking, source citations, insufficient-evidence fallback, tool scope, guardrail/refusal cases. |
| Integration | React→Express→MongoDB, Express→Python AI, document ingestion, batch prediction, intervention notification, report lifecycle. |
| Manual | Responsive UI, accessibility/keyboard flow, CSV errors, upload errors, role matrix, third-party outage states. |
| Acceptance | Execute SRS user stories and BADD contracts with a sanitized demo dataset; capture pass/fail evidence. |

Test fixtures must be synthetic or anonymized. Tests must not invoke paid/production Groq services by default; use deterministic stubs/fixtures for automated suites and separate approved smoke tests for live integrations.

## 13. Environment Variables

| Runtime | Variable | Purpose |
|---|---|---|
| Client | `VITE_API_BASE_URL` | Public versioned backend base URL. |
| Client | `VITE_APP_NAME` | Safe UI display name. |
| Client | `VITE_ENVIRONMENT` | Development/staging/production behaviour label. |
| Server | `NODE_ENV`, `PORT` | Runtime environment and listening port. |
| Server | `MONGODB_URI`, `MONGODB_DB_NAME` | Atlas connection configuration. |
| Server | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets. |
| Server | `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | Token lifetime policy. |
| Server | `CORS_ORIGINS` | Comma-separated trusted frontend origins. |
| Server | `AI_SERVICE_BASE_URL`, `AI_SERVICE_TOKEN`, `AI_SERVICE_TIMEOUT_MS` | Private AI-service communication. |
| Server | `UPLOAD_STORAGE_PROVIDER`, `UPLOAD_MAX_BYTES`, `UPLOAD_ALLOWED_MIME_TYPES` | Upload policy/storage selection. |
| Server | `LOG_LEVEL`, `RATE_LIMIT_*` | Operational observability and limits. |
| AI service | `AI_SERVICE_PORT`, `AI_SERVICE_TOKEN` | Private service runtime/authentication. |
| AI service | `MODEL_ARTIFACT_PATH`, `MODEL_METADATA_PATH`, `ACTIVE_MODEL_VERSION` | Approved model configuration. |
| AI service | `CHROMA_PERSIST_DIRECTORY` or `CHROMA_URL` | Vector-store connection/persistence. |
| AI service | `GROQ_API_KEY`, `GROQ_MODEL_NAME` | LLM provider/model selection. |
| AI service | `EMBEDDING_MODEL_NAME`, `NLP_MODEL_NAME` | Embedding and NLP model selection. |
| AI service | `MAX_RETRIEVED_CHUNKS`, `AI_REQUEST_TIMEOUT_MS`, `LOG_LEVEL` | RAG/agent limits and diagnostics. |

Variables are validated at startup. Production secrets belong only in Vercel/Render/Atlas secret stores; frontend variables must never contain private secrets.

## 14. Logging Strategy

- **Application logs:** server startup/shutdown, request IDs, endpoint latency/status, safe dependency outcomes, and configuration validation failures.
- **AI logs:** model/version loaded, inference latency, SHAP/NLP/RAG/agent operation state, retrieval counts, provider latency, and safe error classes.
- **Prediction logs:** correlation ID, model version, result state, data completeness outcome, duration—not raw employee feature values unless formally approved and protected.
- **Audit logs:** durable database records for sensitive business/user actions, separate from operational logs.
- **Error logs:** structured error code, stack trace only in protected server logs, request ID, safe context, retryability. Never log passwords, tokens, Groq keys, database URIs, unredacted PII, or raw confidential feedback.

Use a consistent structured format with timestamp, level, service, environment, request/correlation ID, event name, and redacted context. Retain operational logs according to platform limits; retain audit logs according to HR governance requirements.

## 15. Documentation Standards

| Document | Required content |
|---|---|
| `README.md` | Project purpose, architecture summary, prerequisites, safe local setup order, scripts, contribution links, and document index. |
| Installation Guide | Dependency/runtime setup, environment templates, database/AI prerequisites, seed/demo data guidance. |
| Architecture Guide | Links to SRS, SDD, DDD, BADD, architecture diagrams, and decision records. |
| API Guide | Published BADD plus authentication, envelope, rate-limit, and example usage guidance. |
| Deployment Guide | Vercel/Render/Atlas configuration, secrets, health checks, rollout/rollback, and recovery steps. |
| User Guide | Role-specific workflows, interpretation of risk/AI limitations, reports, interventions, and privacy notices. |
| Developer Guide | Repository rules, local run order, testing, standards, branching, and contribution workflow. |
| Model Card / AI Guide | Dataset provenance, evaluation, feature caveats, SHAP interpretation, RAG/agent guardrails, bias and human-review limitations. |
| ADRs | Short decision records for choices that materially affect architecture, security, data, or AI behaviour. |

Documentation must be updated in the same pull request when behaviour, configuration, architecture, or user workflow changes.

## 16. Development Rules for AI Coding Assistants

1. Read the SRS, SDD, Database Design Document, BADD, and this blueprint before broad changes.
2. Never rewrite, delete, reformat, or move unrelated files.
3. Do not change the established folder architecture without an approved architecture decision.
4. Follow the existing naming, error, validation, response, logging, and test conventions.
5. Keep React, Express, and Python responsibilities independent; browsers must not call the AI service directly.
6. Reuse established components, utilities, validators, service clients, and repository patterns before adding new ones.
7. Do not introduce a library, framework, database, or infrastructure product without a documented reason and approval.
8. Validate input at every trust boundary; never trust client roles, identifiers, files, or AI output.
9. Preserve JWT/RBAC/department scope and minimize PII in every change.
10. Treat AI output as advisory: preserve citations/guardrails, never implement automated employment actions, and add failure fallbacks.
11. Explain every new/changed file before generating code and state the tests to be run.
12. Do not leave placeholder implementations, fake success responses, silent catches, or unexplained TODO comments.
13. Add or update focused tests for behavioural changes and avoid touching unrelated test fixtures.
14. Never commit secrets, real employee data, generated model artifacts, uploads, or provider credentials.
15. Keep work scoped to the requested feature and report risks, assumptions, and unverified areas clearly.

## 17. Implementation Checklist

### Foundation

- [ ] Repository/configuration templates and ignore rules are in place.
- [ ] SRS, SDD, DDD, BADD, and blueprint are linked from the README.
- [ ] Frontend, backend, and AI service start independently with validated environment configuration.
- [ ] Shared error, logging, request-ID, and health-check conventions are established.

### Security and Core Data

- [ ] JWT, password hashing, refresh/logout/reset flow, RBAC, and department scope are verified.
- [ ] User, role, department, employee, attendance, performance, survey, feedback, and import workflows follow approved designs.
- [ ] Audit events and redaction rules cover sensitive operations.
- [ ] CSV validation and import status/error summaries are tested.

### Product Workflows

- [ ] Employee directory/profile, filters, pagination, and role visibility are complete.
- [ ] Dashboard aggregates, risk display, charts, and reports are role-scoped.
- [ ] Intervention creation, ownership, status lifecycle, notes, notifications, and reporting are complete.
- [ ] Profile/settings and administrator management pages are complete.

### AI Workflows

- [ ] Dataset provenance and feature contract are documented.
- [ ] Preprocessing, training evaluation, model artifact/version metadata, and inference are reproducible.
- [ ] Prediction history, batch status, SHAP explanations, and failure handling are complete.
- [ ] NLP processing is limited to approved data and returns confidence/review state.
- [ ] Document upload, parsing, chunking, embedding, retrieval, citations, and weak-evidence fallback work.
- [ ] Agent tool registry, scope propagation, guardrails, and recommendation feedback are tested.

### Quality and Release

- [ ] Unit, integration, ML, RAG/agent, and end-to-end test evidence is recorded.
- [ ] Manual accessibility, responsive layout, role matrix, error state, and security smoke tests pass.
- [ ] Vercel, Render, and MongoDB Atlas deployments use managed secrets and health checks.
- [ ] Backup/recovery and document/vector rebuild steps are documented and rehearsed.
- [ ] README, installation, deployment, user, developer, AI/model, and presentation/demo guides are current.

## 18. Final Development Roadmap

| Week | Focus | Deliverable |
|---|---|---|
| 1 | Foundation, repository setup, design review, demo dataset, auth/RBAC baseline. | Running shells, environment templates, login, protected navigation, core documentation. |
| 2 | Users, roles, departments, employees, attendance/performance, CSV import. | Secure core HR data workflow with validation/audit. |
| 3 | Directory, profiles, dashboards, filters, charts, interventions, notifications, basic reports. | Usable HR product workflow on demo data. |
| 4 | ML preprocessing/training/evaluation, Python service, single/batch prediction integration. | Versioned risk predictions and job status. |
| 5 | SHAP explanations, prediction history, survey/feedback collection, NLP insights. | Explainable risk profile and text-signal workflow. |
| 6 | Knowledge-base document lifecycle, embeddings, ChromaDB retrieval, cited RAG chat. | Grounded policy assistant with fallback/error states. |
| 7 | Controlled agent advisor, integration hardening, privacy/role testing, report polish. | Evidence-based retention recommendations with guardrails. |
| 8 | Full test pass, deployment, backup/recovery check, documentation, presentation and demo rehearsal. | Release candidate deployed to Vercel/Render/Atlas. |

For a six-week delivery, combine Weeks 5–6 and limit survey/NLP sophistication to one approved feedback source; combine Weeks 7–8 by prioritizing guarded recommendation flow, core tests, and deployment over optional visual polish.

**Delivery rule:** RetentionAI is complete only when its core risk, explanation, policy-grounding, and intervention workflows work with role-scoped data, clear failure states, and human-review safeguards—not merely when screens or model outputs exist.
