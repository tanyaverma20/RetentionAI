# Changelog

All notable changes to RetentionAI are documented here.

## [1.0.1] — Production Readiness Audit Fixes

Findings and fixes from a full production-readiness audit (frontend, backend,
AI service, database, security, deployment). No new user-facing features.

**Fixed**
- `hrController.js`'s `bulkImportRecords` used a hand-rolled `split(',')`/`split('\n')` CSV parser that silently corrupted any row with a quoted comma or an embedded newline (e.g. a feedback/note field), misaligning every column after it instead of failing loudly. Replaced with `csv-parse/sync`, the same library already used correctly elsewhere in the codebase (`departmentService.js`, `seedDemoData.js`). Added regression tests covering both cases.
- `ai-service/app/api/nlp_routes.py` had no authentication on any of its 5 endpoints (`/nlp/analyze`, `/analyze/batch`, `/employee/{id}`, `/dashboard`, `/statistics`), unlike every sibling router, leaving raw employee sentiment/burnout data readable and writable with no bearer token. Fixed by applying the same `verify_auth_token` dependency used by every other router. Added regression tests asserting all 5 endpoints reject missing/invalid tokens with 401.
- `Explanation` collection was missing the `{employeeId: 1, generatedAt: -1}` compound index its siblings (`Decision`, `EmployeeIntelligence`) already have for the same "latest record per employee" query shape used by `explainService.js`.

**Removed**
- 4 unused UI primitive components (`Badge.jsx`, `Button.jsx`, `Card.jsx`, `SegmentedControl.jsx`) built during the design-system phase but never actually imported anywhere in the app.

## [1.0.0] — Sprint 10: Production Release, DevOps, Security & Enterprise Finalization

First production-ready release. No new user-facing features — this release
productionizes, secures, and documents everything built in Sprints 1-9.

**Added**
- Dockerfiles for all four services + `docker-compose.yml`/`docker-compose.prod.yml` with health-check-gated startup ordering.
- OpenAPI/Swagger documentation at `/api-docs` (Express) — 100+ endpoints documented.
- Deep health endpoints (`/health/deep`) on both `server` and `ai-service`: dependency status, memory/CPU, per-pipeline latency.
- Structured, rotated, request-ID-correlated logging (winston on Node, Python `logging` on FastAPI).
- Production environment validation with fail-fast startup checks (rejects placeholder secrets, weak config, in `production` mode).
- Database backup/restore scripts and a referential-integrity consistency checker.
- Route-based frontend code-splitting (59% reduction in initial JS payload).
- Load testing harness and honest benchmark report (see `docs/Load-Testing-Report.md`).
- GitHub Actions CI (lint, test, build, Docker build) and deployment guides for 6 platforms.
- Full documentation suite (architecture, installation, database, AI pipeline, admin, developer, troubleshooting guides).

**Fixed**
- CORS `methods` list was missing `PUT`, silently breaking HR record updates for cross-origin browser clients.
- Swagger UI's default CSP blocked its own inline styles/scripts (scoped CSP relaxation to `/api-docs` only).
- `hrController.js` referenced `AppError` without importing it — a malformed bulk-import request crashed into a generic 500 instead of the intended 400.
- `notifyByRole()` and the automation scheduler's organization-discovery both silently assumed `User.organizationId` was populated; it wasn't for any seeded account, so role-based digest notifications reached zero recipients.
- Node's `setInterval` silently overflows past its 32-bit millisecond ceiling (~24.8 days) — the monthly automation job's interval was replaced with a chained-timeout scheduler.
- ~20 pre-existing ESLint violations across server/client (unused imports/vars, unescaped JSX entities) cleaned up to zero.

## [0.9.0] — Sprint 9: Enterprise Workflow Automation & Communication

AI recommendations become real HR actions: intervention lifecycle (Draft →
Approval → Assigned → In Progress → Completed), configurable multi-level
approval chains, task management, notification center, threaded comments,
unified activity timeline, HR Operations Dashboard, categorized global
search, file attachments, and 6 scheduled automation jobs.

## [0.8.0] — Sprint 8: Executive Workforce Intelligence Platform

Executive Dashboard (company health score, risk heatmap, department
comparisons, trend charts), rule-based executive insights (real Pearson
correlations, not LLM-generated text), downloadable executive reports
(PDF/DOCX/CSV), intervention/ROI analytics, and forecasting via linear
regression over prediction history. Zero new AI computation — pure rollup
over Sprints 1-7's outputs.

## [0.1.0] – [0.7.5] — Sprints 1-7: Core Platform

HRMS (employees, departments, attendance, performance, training,
promotions), authentication/RBAC, ML attrition prediction, SHAP
explainability, NLP-based employee intelligence, RAG-backed knowledge base,
and the AI decision-recommendation engine.
