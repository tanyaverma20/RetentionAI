# RetentionAI Testing Guide & Infrastructure

This document details the automated testing architecture, execution commands, isolation strategies, environment configuration, and test suites across the RetentionAI platform.

---

## 1. Test Architecture & Overview

RetentionAI employs an isolated, deterministic, multi-tier testing strategy designed for enterprise SDET standards:

| Tier | Technology | Directory | Scope & Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js Backend Unit & Integration** | Node Native Test Runner + Supertest | `server/tests/` | Unit testing (errors, JWT, RBAC, password policy, validation, rate limiting, CORS) and REST API integration (contracts, multi-tenant IDOR, fail-safe downstream circuits, health probes). |
| **Python AI Service** | PyTest + PyTest-Cov + HTTPX | `ai-service/tests/` | ML pipeline, XGBoost/LightGBM inference, SHAP tree explainability, RAG retrieval, LangGraph decision agent, prompt sanitization, and FastAPI contract validation. |
| **React Frontend** | Vitest + React Testing Library + JSDOM | `client/src/tests/` | Login authentication lifecycle, form validation schemas, Redux error handling, and ProtectedRoute RBAC access control. |
| **Continuous Integration** | GitHub Actions | `.github/workflows/ci.yml` | Multi-job parallel automated pipeline executing syntax checks, backend suites, PyTest coverage, and frontend build verification. |

---

## 2. Test Execution Commands

### Node.js Backend (`server/`)
```bash
# Run core test suite (unit + REST API integration + multi-tenant security)
npm test

# Run unit tests only (fast, sub-second execution)
npm run test:unit

# Run Supertest API contracts and tenant-isolation regression tests
npm run test:contracts

# Run all test files including historical integration suites
npm run test:all
```

### Python FastAPI AI Service (`ai-service/`)
```bash
# Run full PyTest test suite
pytest

# Run tests with terminal coverage report
pytest --cov=app --cov-report=term-missing tests/

# Run single test module with verbose output
pytest tests/test_agent.py -v
pytest tests/test_shap.py -v
```

### React Frontend (`client/`)
```bash
# Run frontend component and route tests
npm run test

# Run Vitest in interactive watch mode
npm run test:watch
```

---

## 3. Environment Variables & Test Isolation

### Database Isolation
- **In-Memory MongoDB**: Database tests leverage `mongodb-memory-server` to spin up ephemeral, disposable MongoDB instances. Tests never connect to shared or cloud Atlas databases.
- **Fail-Safe Connection Resolver**: `server/src/config/database.js` explicitly prioritizes the passed in-memory connection URI over default cloud connection strings.
- **State Tear-Down**: `after()` lifecycle hooks clean collections and gracefully terminate in-memory server instances to prevent port leaks.

### Network & Redis Mocking
- **Upstash Redis Bypass**: In `NODE_ENV=test`, rate limiters and concurrency gates operate in-memory rather than issuing real outbound HTTP requests to Upstash REST endpoints.
- **Downstream Circuit Breaker**: Express tests verify fail-closed behavior (HTTP 502/503) when the Python AI service is unreachable, ensuring no unhandled promise rejections or leaked stack traces.
- **ML Dependency Isolation**: PyTest uses mock decorators (`unittest.mock`) to decouple unit tests from Groq cloud APIs, OpenAI endpoints, or heavy Hugging Face downloads, testing both `LITE` and `FULL` build capabilities safely.

### Required Test Environment Variables
The following environment variables are supplied by test runners with zero manual configuration required:

```env
# Backend Test Defaults
NODE_ENV=test
MONGODB_DB_NAME=retentionai_test
JWT_ACCESS_SECRET=test-access-secret-that-is-at-least-32-characters
JWT_REFRESH_SECRET=test-refresh-secret-that-is-at-least-32-characters
CORS_ORIGINS=http://localhost:5173

# AI Service Test Defaults
APP_ENV=test
AI_STACK_CAPABILITY=LITE
MODEL_DIR=./models
```

---

## 4. Test Suite Inventory

### A. Backend Unit & Validation (`server/tests/`)
- `error-handler.test.js`: Verifies `AppError` status mapping, MongoDB `11000` duplicate key handling, Mongoose `ValidationError` and `CastError` formatting, Zod field error extraction, 500 internal stack suppression, and 404 handler.
- `jwt.test.js`: Token creation, claim encoding, signature verification, and expired/tampered token rejection.
- `rbac.test.js`: Validates role-based permissions (`ADMIN`, `HR_MANAGER`, `EMPLOYEE`, `EXECUTIVE`), wildcards, and 403 Forbidden enforcement.
- `password-policy.test.js`: Enforces complexity requirements (uppercase, lowercase, digit, special character, 8+ characters).
- `validation.test.js`: Zod schema boundaries for login, registration, token refresh, and password reset.
- `rate-limit.test.js`: Express rate limiter configuration and memory-store fallback.
- `cors-origins.test.js`: Origin allowlisting and unsafe pattern rejection.
- `token-utils.test.js`: High-entropy crypto token generation and SHA-256 hashing.

### B. REST API Contracts & Multi-Tenant IDOR (`server/tests/apiContracts.supertest.test.js`)
- `GET /health`: Liveness probe status.
- `GET /health/deep`: Deep dependency probe reporting MongoDB, AI Service, and Redis health.
- `POST /api/v1/auth/login`: Credential validation, token issuance, PII exclusion, schema enforcement.
- `POST /api/v1/auth/refresh`: Refresh token rotation and replay-attack rejection.
- `GET /api/v1/employees`: Paginated employee records, cursor limits, authentication gating.
- `GET /api/v1/employees/:id`: Single employee retrieval, ObjectId validation, 404 error formatting.
- **Tenant Isolation (Cross-Org IDOR)**: Verifies Organization A admin cannot access or mutate Organization B employee profiles (fails closed with 404).
- **Tenant Injection Prevention**: Parameter tampering (`?organizationId=orgB`) is strictly prevented.
- **Downstream Circuit Breaker**: Tests graceful HTTP 503 handling when AI service is offline.

### C. AI Service Suite (`ai-service/tests/`)
- `test_api.py`: FastAPI routes, health checks, batch predictions, and input validation.
- `test_shap.py`: Tree SHAP feature attribution generation, force plots, and malformed payload resilience.
- `test_agent.py`: LangGraph decision recommendations, risk assessment, and HR workflow routing.
- `test_nlp.py`: Employee feedback sentiment analysis and emotion classification under LITE/FULL capability profiles.
- `test_rag.py` & `test_rag_groundedness.py`: Vector knowledge retrieval, threshold relevance, and empty index fallbacks.
- `test_features.py`: Feature engineering pipeline and categorical encodings.

### D. Frontend Component & Routing (`client/src/tests/`)
- `Login.test.jsx`: Form rendering, Zod schema validation errors, malformed email handling, Redux API error rendering, loading spinner states, and demo credential population.
- `ProtectedRoute.test.jsx`: Unauthenticated redirect to `/login`, auth initialization spinner, role permission authorization, and 403 Access Denied rendering.

---

## 5. Continuous Integration (CI/CD)

The GitHub Actions pipeline (`.github/workflows/ci.yml`) executes three parallel jobs on every push and pull request:
1. **Node.js Backend & API Integration Tests**: Installs via `npm ci`, checks syntax, and executes `npm test`.
2. **Python FastAPI AI Service & PyTest Suite**: Configures Python 3.11, installs requirements, and runs `pytest --cov=app --cov-report=term-missing tests/`.
3. **React Frontend Vitest & Build Verification**: Runs `npm run test` and executes production bundle build `npm run build`.
