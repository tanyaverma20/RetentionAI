# RetentionAI Testing Audit & Quality Assessment
**Target Role:** Senior SDET / Backend Software Engineer (Mphasis Hiring Standards)  
**Date:** October 2026  
**Auditor:** Senior SDET & Backend Infrastructure Engineer  

---

## 1. Executive Summary

This testing audit was conducted against the **RetentionAI** repository to evaluate its testing maturity, test isolation, API contracts, multi-tenant security safeguards, and CI/CD automation.

RetentionAI is a multi-tier enterprise retention intelligence platform consisting of:
1. **Node.js / Express Backend** (`server/`): REST API, JWT authentication, RBAC, tenant isolation, Upstash Redis rate limiting/locking, and MongoDB persistence.
2. **Python FastAPI AI Service** (`ai-service/`): Machine learning prediction (Scikit-Learn/XGBoost/LightGBM/CatBoost), SHAP explainability, NLP sentiment/emotion analysis, LangGraph decision workflow orchestration, and RAG document grounding.
3. **React / Vite Frontend** (`client/`): Single-page application for HR managers, executives, and employees.
4. **CI/CD & DevOps** (`.github/workflows/ci.yml`, `docker-compose.yml`).

### Baseline Metrics & Inventory Verification
| Component | Documented Expectation | Actual Files Found | Baseline Pass / Fail / Skipped | Primary Issues Identified |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js Backend** (`server/tests/`) | 33 integration test files | 33 test files (`.test.js`) + 1 `.gitkeep` | **Failed / Hung** (Network timeouts, rate limiter crashes, unhandled rejections) | Remote MongoDB Atlas connection leak; rate limiter crashing on Redis errors; unhandled buffering timeouts |
| **Python AI Service** (`ai-service/tests/`) | 11 test modules | 9 test modules in `tests/` + 3 evaluation scripts in `evals/` | **86 Passed, 22 Failed, 0 Skipped** (out of 108 tests) | `shap.initjs()` IPython crash; obsolete `/agent` endpoints in `test_agent.py`; LITE vs FULL capability mismatches |
| **React Frontend** (`client/tests/`) | Not specified | 0 test files (only `.gitkeep`) | **No test framework configured** | Missing unit & integration tests for login, authentication, and error display |
| **Root Tests** (`tests/`) | e2e, fixtures, integration | All 4 directories empty (`.gitkeep` only) | **0 tests executed** | Stubbed placeholder folders |
| **CI Pipeline** (`.github/workflows/ci.yml`) | Automated PR verification | 1 workflow file | **Brittle / Incomplete** | Python test step ran manual `eval_suite.py` instead of `pytest`; no client tests; prone to timeout on live Redis/MongoDB |

---

## 2. Detailed Findings by Component

### 2.1 Node.js Backend (`server/`)

#### Defect 1: Critical Test Pollution & Remote MongoDB Atlas Leak
- **Location:** `server/src/config/database.js`
- **Root Cause:** `connectDatabase()` explicitly referenced `env.mongodbUri` which was statically evaluated at module load time against `server/.env` (pointing to an external MongoDB Atlas cluster). Even though integration tests spun up local `MongoMemoryServer` instances and mutated `process.env.MONGODB_URI`, `connectDatabase()` completely ignored the override and connected to Atlas.
- **Impact:**
  - Destructive `deleteMany({})` operations ran against cloud/remote databases during local test runs.
  - Integration tests suffered severe network latency (15–25 seconds per test) and frequent timeout failures.
  - Concurrency race conditions occurred when running tests in parallel.
- **Remediation:** Modify `connectDatabase(uri)` to accept an explicit URI parameter and fall back to `process.env.MONGODB_URI || env.mongodbUri`.

#### Defect 2: Express Rate Limiter Crash on Redis Store Failures
- **Location:** `server/src/middlewares/rateLimits.js`
- **Root Cause:** In `UpstashRedisStore.prototype.increment()`, when Redis is unreachable or throws a network error (e.g. `fetch failed`), the `catch` block returned `undefined`. However, `express-rate-limit` expects the store to return an object with `{ totalHits, resetTime }`. Accessing `results.totalHits` raised `TypeError: Cannot read properties of undefined (reading 'totalHits')`, crashing all rate-limited endpoints (`/organizations/signup`, `/auth/login`, `/auth/refresh`) with a 500 error.
- **Impact:** Any network glitch or offline test execution caused HTTP 500 crashes instead of gracefully failing open or falling back to in-memory rate limiting.
- **Remediation:** Return `{ totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) }` on Redis errors, and in `test` environment bypass external HTTP calls to Upstash.

#### Defect 3: Mongoose Command Buffering Timeout in Audit Logging
- **Location:** `server/src/services/auditService.js`
- **Root Cause:** When `authorize.js` records an RBAC denial (`recordAudit(...)`), it calls `AuditLog.create(...)`. In pure unit tests (where Mongoose is intentionally not connected), Mongoose buffers queries for 10,000ms by default before rejecting with `Operation auditlogs.insertOne() buffering timed out after 10000ms`.
- **Impact:** Fast unit tests hung for 10+ seconds per assertion.
- **Remediation:** Check `if (mongoose.connection.readyState !== 1) return;` inside `recordAudit()` so disconnected/unit-test environments fail fast without buffering delays.

#### Defect 4: Missing Environment Configuration Defaults for Test Isolation
- **Location:** `server/src/config/env.js`
- **Root Cause:** Zod schema validation failed at import time if required variables (`MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`) were missing from the process environment.
- **Impact:** Running individual unit tests with `node --test tests/rbac.test.js` without `--env-file=.env` crashed immediately with `Error: Invalid environment configuration`.
- **Remediation:** Provide deterministic, secure dummy fallbacks when `NODE_ENV === 'test'`.

---

### 2.2 Python AI Service (`ai-service/`)

#### Baseline Run Results
Executed `pytest` in `ai-service`:
- **Total Tests:** 108
- **Passed:** 86
- **Failed:** 22
- **Duration:** 135.90s

#### Defect 5: SHAP Force Plot Crash Due to `shap.initjs()`
- **Location:** `ai-service/app/explainability/plot_generator.py`
- **Root Cause:** `generate_force_plot()` called `shap.initjs()`. `initjs()` is exclusively intended for interactive IPython/Jupyter notebook environments. In a standard FastAPI backend, `shap.initjs()` raises `AssertionError: IPython must be installed to use initjs()!`.
- **Impact:** `test_explainability.py::TestPlotGenerator::test_force_plot_creates_png` failed consistently.
- **Remediation:** Guard or remove `shap.initjs()` call since matplotlib static plotting (`matplotlib=True`) does not require JavaScript injection.

#### Defect 6: Obsolete API Contracts in `test_agent.py`
- **Location:** `ai-service/tests/test_agent.py`
- **Root Cause:** Tests targeted non-existent endpoints: `POST /agent/recommend`, `POST /agent/recommend/batch`, `GET /agent/history`, `GET /agent/statistics`. The actual registered endpoints are `POST /agent/employee-decision` (LangGraph) and `POST /decision/generate`, `POST /decision/batch`, `GET /decision/history`, `GET /decision/dashboard`. In addition, no `Authorization: Bearer <token>` header was provided.
- **Impact:** 4 test failures with 401 Unauthorized and 404 Not Found.
- **Remediation:** Align `test_agent.py` with the actual implemented routes and schema contracts, including authentication headers.

#### Defect 7: LITE vs FULL ML Feature Set Expectation Mismatch
- **Location:** `ai-service/tests/test_nlp.py`, `ai-service/tests/test_rag.py`, `ai-service/tests/test_rag_groundedness.py`
- **Root Cause:** The architecture supports a lightweight container mode (`LITE`) where heavy dependencies (`torch`, `transformers`, `sentence-transformers`, `chromadb`) are omitted to run within a 512 MB memory boundary. When absent, `app/features.py` swaps these routes for 503 Service Unavailable stubs (`FEATURE_NOT_AVAILABLE_IN_BUILD`). However, the NLP and RAG tests asserted status code 200 without checking if NLP/RAG is available or mocking the underlying pipelines.
- **Impact:** 17 test failures with `assert 503 == 200`.
- **Remediation:** Test both behaviors:
  1. Verify the 503 status code and error payload when in LITE mode.
  2. Skip or mock live model inference when heavy libraries are not installed, and ensure mocked routes return valid 200 responses.

#### Defect 8: Route Shadowing on `/health`
- **Location:** `ai-service/app/main.py` vs `ai-service/app/api/routes.py`
- **Root Cause:** Both files define `GET /health`. Because `app.get("/health")` was defined on `main.py` before `app.include_router(prediction_router)`, requests to `/health` were intercepted by the liveness probe, returning `{"status": "OK", "uptimeSeconds": ...}` instead of `HealthStatusResponse` (which includes `modelLoaded`, `mongodbConnected`).
- **Impact:** `test_ml.py::TestAPIRoutes::test_health_endpoint_returns_200` failed asserting `"modelLoaded" in body`.
- **Remediation:** Align `/health` route definition so prediction health metadata is accessible.

---

### 2.3 React Frontend (`client/`)

- **Audit Findings:** No test runner or testing library installed. `client/package.json` had no `test` script.
- **Risk:** Regressions in core user authentication, form validation, error message rendering, or role-based routing are undetectable before deployment.
- **Remediation:**
  - Introduce **Vitest** + **React Testing Library** + **jsdom**.
  - Add targeted unit/integration tests for:
    1. Login form field validation (empty email/password, invalid email formats).
    2. Authentication state handling (loading spinner, submit button disabled).
    3. API error responses rendering (401 invalid credentials, 500 server errors).
    4. Protected route redirection when unauthenticated.

---

### 2.4 CI/CD Pipeline (`.github/workflows/ci.yml`)

- **Audit Findings:**
  1. The backend test job ran `npm test` against `mongodb://127.0.0.1:27017/retentionai_test`, but no MongoDB service container was configured in GitHub Actions, forcing dependency on `mongodb-memory-server` which was broken by the `env.mongodbUri` leak.
  2. The Python test job ran `python evals/eval_suite.py` instead of running `pytest`.
  3. No frontend test job existed.
- **Remediation:** Modernize `.github/workflows/ci.yml` with separate, matrixed, isolated test jobs for Backend, AI Service, and Frontend with proper caching and test reporting.

---

## 3. Prioritized Remediation Plan

1. **Phase 1: Fix Core Architectural & Isolation Defects (Backend & AI Service)**
   - Patch `database.js` to honor dynamic/test database URIs.
   - Patch `rateLimits.js` to fail open safely on Redis store errors.
   - Patch `auditService.js` to prevent buffering timeouts when disconnected.
   - Patch `env.js` with test defaults.
   - Patch `plot_generator.py` to remove `shap.initjs()`.
   - Patch `app/main.py` / `routes.py` health endpoint shadowing.
2. **Phase 2: Strengthen Node.js Backend Tests**
   - Implement dedicated unit tests for services, validators, and error handlers.
   - Strengthen REST API integration tests using Supertest without open network ports.
   - Add security and tenant-isolation regression test suite (IDOR, role escalation, token manipulation).
3. **Phase 3: Fortify Python AI Service Tests**
   - Align `test_agent.py` with real LangGraph decision engine contracts.
   - Parameterize NLP and RAG tests to validate both LITE (503 feature unavailable) and mocked FULL pipelines without downloading model weights.
4. **Phase 4: Implement Frontend Test Suite**
   - Configure Vitest + RTL in `client/`.
   - Implement component tests for Login, Auth Error Display, and Protected Routing.
5. **Phase 5: Update CI/CD & Documentation**
   - Update `.github/workflows/ci.yml`.
   - Provide comprehensive testing documentation in `docs/TESTING.md` and update `README.md`.
6. **Phase 6: Final Verification & Reporting**
   - Execute all suites, record verified pass/fail counts, and extract resume-ready SDET capabilities.
