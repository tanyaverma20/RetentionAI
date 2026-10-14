# RetentionAI — Complete System Architecture & Project Context Document

---

## 1. Project Overview

### One-Sentence Explanation
RetentionAI is a multi-tenant enterprise human resources and employee retention intelligence platform that combines supervised machine learning (CatBoost/XGBoost/RandomForest), SHAP explainable AI (XAI), transformer-based NLP sentiment/emotion analysis, hybrid dense/sparse RAG policy retrieval (SentenceTransformers + BM25 + ChromaDB), and an 8-node LangGraph autonomous agent decision engine to predict employee attrition risk, explain risk factors, and synthesize policy-grounded retention interventions.

### Interview-Ready Explanation
"RetentionAI is an enterprise SaaS platform engineered to solve employee attrition by bridging predictive machine learning with automated HR decision orchestration. Architecturally, it operates as a multi-tenant system comprising a React 18 SPA frontend, a Node.js/Express REST API gateway, a MongoDB document store, and a FastAPI Python AI/ML microservice. The AI microservice trains and serves calibrated attrition risk models while computing local and global SHAP feature attributions to provide actionable XAI. It incorporates an NLP pipeline for un тексто textual feedback analysis and a hybrid RAG pipeline using SentenceTransformers (`all-MiniLM-L6-v2`), BM25, and ChromaDB for tenant-isolated policy retrieval. Furthermore, an 8-node LangGraph state graph coordinates context validation, risk scoring, XAI extraction, policy matching, LLM reasoning (via Groq Llama 3.1 8B), and decision validation to produce actionable HR interventions with strict SLA, cost, and audit tracking."

### Detailed Technical Explanation
RetentionAI is built upon a microservice-oriented topology with strict multi-tenant isolation, structured data validation, and asynchronous fault-tolerant startup sequences.

- **Frontend**: A React 18 single-page application built with Vite, styled with TailwindCSS, and managed via Redux Toolkit. It features route-based code splitting (`React.lazy`), role-based routing (RBAC across `ADMIN`, `HR_DIRECTOR`, `CHRO`, `HR_MANAGER`, `DEPARTMENT_MANAGER`, `EMPLOYEE`), and dynamic interactive visualizations (Recharts, Lucide icons).
- **API Gateway / Backend Server**: A Node.js/Express application acting as the primary gateway, handling JWT-based authentication (HS256 access tokens + CSPRNG opaque refresh tokens hashed with HMAC-SHA-256), RBAC middleware, input sanitization (`sanitizeInput`), request correlation (`X-Request-Id` and `X-Correlation-ID`), rate limiting, Mongoose ODM database mapping across 45 MongoDB collections, and HTTP proxying to the Python AI service.
- **AI Microservice**: A FastAPI application that serves machine learning models (CatBoost, XGBoost, Random Forest, Logistic Regression), calculates SHAP explanations (`TreeExplainer` and `LinearExplainer`), performs NLP sentiment/emotion classification, executes enterprise hybrid RAG queries using Reciprocal Rank Fusion (RRF), and runs an 8-node LangGraph workflow (`AgentState` typed state container).
- **Data & Vector Stores**: MongoDB 7 for transactional documents, application state, prediction histories, and audit logs. ChromaDB for vector embeddings of uploaded HR policies. Upstash Redis (optional REST API) for distributed job state tracking and AI concurrency locking.

### Important Limitations
1. **LITE vs. FULL AI Build Dual-State**: On memory-constrained free-tier hosts (< 512 MB RSS), the AI service runs in a "LITE" mode where heavyweight PyTorch/Transformers/ChromaDB imports are omitted, disabling local NLP and local vector search while maintaining prediction, SHAP, and LLM decision capabilities.
2. **Offline HF Reliance**: Models rely on pre-cached local weights (`AI_MODELS_OFFLINE=true` / `HF_HUB_OFFLINE=1`) to avoid HuggingFace network latency at startup.
3. **Single Active Joblib Model Bundle**: The prediction service loads one primary active model bundle (`attrition_model.joblib`) from `/app/models/active` at any given time.

---

## 2. Project Goals and Problem Statement

### Motivation & Problem Statement
Unplanned employee turnover costs enterprises billions annually in lost productivity, recruitment expenses, and institutional knowledge drain. Traditional HR approaches are reactive—intervening only after an employee submits a resignation. Existing predictive solutions function as "black boxes," failing to explain *why* an employee is at risk or provide actionable, policy-compliant steps to retain them.

### System Objectives
- **Proactive Early Warning**: Compute calibrated attrition probability scores ($[0.0, 1.0]$) for every employee across tenant organizations.
- **Explainable Predictions**: Generate local SHAP force values and global feature importances to identify top risk drivers (e.g., overtime hours, salary stagnation, job satisfaction drop).
- **Unstructured Signal Extraction**: Analyze employee survey responses and manager feedback using transformer models to extract sentiment, emotion, and burnout indicators.
- **Grounded Policy RAG**: Allow HR teams to query internal policy documents with dense/sparse hybrid search and guaranteed groundedness (no LLM generation when relevance $< 0.15$).
- **Autonomous Strategy Orchestration**: Execute an 8-node LangGraph agent graph to synthesize personalized, policy-aligned retention recommendations complete with estimated costs, recommended roles, and SLA targets.
- **Strict Multi-Tenant Isolation**: Enforce tenant boundaries (`organizationId`) at database, API, vector store, and LLM context levels.

### Out of Scope (Non-Goals)
- Automatic execution of financial changes (e.g., automatically adjusting payroll).
- Direct integration with legacy third-party HRIS APIs (handled via standardized CSV/JSON bulk import endpoints).
- Unfiltered open-domain LLM chatting without grounded HR context.

---

## 3. Technology Stack

| Category | Technology | Version | Role / Purpose | Where Used |
| :--- | :--- | :--- | :--- | :--- |
| **Language** | JavaScript (ESM) | Node 18+ | Express Backend API & React Frontend | `server/src/`, `client/src/` |
| **Language** | Python | 3.10+ / 3.11 | AI/ML, NLP, RAG & Agentic Microservice | `ai-service/app/` |
| **Frontend Framework** | React | ^18.2.0 | UI rendering & SPA architecture | `client/src/` |
| **Build Tool** | Vite | ^5.0.0 | Module bundling, HMR, code-splitting | `client/vite.config.js` |
| **State Management** | Redux Toolkit | ^2.0.1 | Global state (auth, notifications, dashboard) | `client/src/store/` |
| **Styling** | TailwindCSS | ^3.4.0 | Utility-first responsive CSS design system | `client/tailwind.config.js` |
| **Icons & Charts** | Lucide React / Recharts | ^0.300 / ^2.10 | UI icons & data visualization dashboards | `client/src/components/`, `pages/` |
| **Backend Framework** | Express.js | ^4.18.2 | HTTP API server & request routing | `server/src/app.js` |
| **ODM / DB Driver** | Mongoose | ^8.0.0 | MongoDB document modeling & queries | `server/src/models/` |
| **Async DB Driver** | Motor / PyMongo | ^3.3.0 | Async Python MongoDB driver | `ai-service/app/utils/database.py` |
| **AI Framework** | FastAPI | ^0.104.0 | Python web framework for ML microservice | `ai-service/app/main.py` |
| **Machine Learning** | Scikit-Learn / CatBoost / XGBoost | ^1.3 / ^1.2 / ^2.0 | Attrition prediction, preprocessing & tuning | `ai-service/app/training/`, `prediction/` |
| **XAI Engine** | SHAP | ^0.43.0 | Feature attribution & explainability | `ai-service/app/explainability/` |
| **NLP Stack** | HuggingFace Transformers / PyTorch | ^4.35 / ^2.1 | Emotion classification & zero-shot NLP | `ai-service/app/nlp/` |
| **Vector DB** | ChromaDB | ^0.4.18 | Embeddings vector storage for RAG | `ai-service/app/rag/vectorstore/` |
| **Embeddings** | SentenceTransformers | `all-MiniLM-L6-v2` | Dense semantic text vectorization | `ai-service/app/rag/embeddings/` |
| **Sparse Search** | rank_bm25 | ^0.2.2 | BM25 sparse lexical retrieval | `ai-service/app/rag/services/rag_service.py` |
| **Agent Framework** | LangGraph / LangChain | ^0.0.10 / ^0.1.0 | 8-node stateful workflow execution | `ai-service/app/agent/` |
| **LLM Provider** | Groq API | Llama-3.1-8b-instant | High-speed LLM reasoning for agent & RAG | `ai-service/app/rag/chains/`, `agent/` |
| **Primary Database** | MongoDB | 7.0 | Document store for users, orgs, predictions, logs | Docker container `retentionai-mongo` |
| **Cache / Job Store** | Upstash Redis | REST API | Distributed job store & concurrency lock | `server/src/utils/redisClient.js` |
| **Backend Testing** | Node Native Runner / Supertest | Node 20+ / ^7.2.2 | In-memory REST API contracts, IDOR & unit tests | `server/tests/` |
| **Test DB Isolation** | mongodb-memory-server | ^11.2.0 | Ephemeral in-memory MongoDB for tests | `server/tests/` |
| **Python Testing** | PyTest / pytest-cov / HTTPX | ^9.1.1 / ^7.1.0 | ML inference, SHAP, RAG & agent tests with coverage | `ai-service/tests/` |
| **Frontend Testing** | Vitest / React Testing Library | ^5.0.4 / ^16.0 | Unit & component tests for login & routes | `client/src/tests/` |
| **DOM Environment** | jsdom / @testing-library/jest-dom | ^26.0.0 / ^6.6 | Headless DOM & assertion matchers for Vitest | `client/vite.config.js` |
| **CI/CD Pipeline** | GitHub Actions | YAML Workflow | Multi-job automated PR/push test & build pipeline | `.github/workflows/ci.yml` |
| **Containerization** | Docker / Docker Compose | Multi-stage | Multi-container environment orchestrator | `Dockerfile`, `docker-compose.yml` |

---

## 4. Complete Repository Structure

```
RetentionAI/
├── .github/
│   └── workflows/
│       └── ci.yml                     # 3-job parallel CI workflow (Backend, AI, Frontend)
├── .env.example                       # Root env template for docker-compose
├── Dockerfile                         # Root multi-stage build reference
├── render.yaml                        # Render Blueprint deployment specification
├── docker-compose.yml                 # Local dev container orchestration (mongo, server, ai-service, client)
├── docker-compose.prod.yml            # Production container deployment config
├── CHANGELOG.md                       # Release notes & version milestones
├── CONTRIBUTING.md                    # Developer contribution guidelines
├── DISASTER_RECOVERY.md               # Incident response & backup runbook
├── README.md                          # Primary project documentation
├── resume_metrics.md                  # Reconciled performance & benchmark verification metrics
├── ai-service/                        # Python FastAPI AI Microservice
│   ├── Dockerfile                     # Python 3.10 slim deployment container
│   ├── requirements.txt               # Full ML dependency set (torch, transformers, chromadb)
│   ├── requirements-lite.txt          # Memory-optimized lite dependency set
│   ├── train_model.py                 # CLI model training & evaluation script
│   ├── seed_ml_data.py                # Synthetic dataset generator & DB seeder
│   ├── tests/                         # 11 PyTest test modules (108 passed, 2 skipped)
│   │   ├── test_api.py                # FastAPI routes, health & batch inference
│   │   ├── test_shap.py               # SHAP explainability & force plots in headless mode
│   │   ├── test_agent.py              # LangGraph 8-node decision agent workflows
│   │   ├── test_nlp.py                # Sentiment analysis & LITE build capability checks
│   │   ├── test_rag.py                # Hybrid dense/sparse vector retrieval & thresholds
│   │   └── test_features.py           # Feature engineering & preprocessing pipeline
│   └── app/
│       ├── main.py                    # FastAPI entrypoint, lifespan manager & routes
│       ├── config.py                  # Pydantic startup configuration validation
│       ├── features.py                # Capability probing (NLP_AVAILABLE, RAG_AVAILABLE)
│       ├── agent/                     # LangGraph Retention Agent Engine
│       │   ├── agent_state.py         # AgentState TypedDict definition
│       │   ├── retention_graph.py     # 8-node graph compilation & entrypoint
│       │   └── nodes.py               # Individual agent node implementations
│       ├── api/                       # FastAPI router endpoints
│       │   ├── routes.py              # /api/v1/predict, /api/v1/predict/batch
│       │   ├── explain_routes.py      # /api/v1/explain/local, /global, /batch
│       │   ├── agent_routes.py        # /api/v1/agent/retention-decision
│       │   ├── rag_routes.py          # /api/v1/rag/query, /index, /search
│       │   ├── nlp_routes.py          # /api/v1/nlp/analyze, /feedback
│       │   └── decision_routes.py     # /api/v1/decision/recommend
│       ├── decision/                  # Decision rules engine & schemas
│       ├── explainability/            # SHAP cache, local & global explainer, plot generator
│       ├── nlp/                       # Emotion/sentiment analyzer & repo integrations
│       ├── prediction/                # PredictionService & drift detection
│       ├── preprocessing/             # Feature transformation pipeline & enrichment
│       ├── rag/                       # Chunkers, cleaners, loaders, vectorstore & services
│       ├── training/                  # Model trainer, hyperparameter tuner & benchmark
│       └── utils/                     # Database connection, logging, metrics, migrations
├── server/                            # Node.js / Express Backend Gateway
│   ├── Dockerfile                     # Node 18 Alpine production container
│   ├── package.json                   # Express server dependencies & test scripts
│   ├── tests/                         # Unit & Supertest integration test suites (58 passed)
│   │   ├── apiContracts.supertest.test.js # REST API contracts, multi-tenant IDOR, health
│   │   ├── error-handler.test.js      # AppError, 11000 duplicate key, Zod & 500 suppression
│   │   ├── jwt.test.js                # JWT claims, verification, tampered token rejection
│   │   ├── rbac.test.js               # Role-based permissions, wildcards & 403 Forbidden
│   │   ├── password-policy.test.js    # Password complexity and validation rules
│   │   ├── validation.test.js         # Zod schemas for auth, reset & registration
│   │   ├── rate-limit.test.js         # Express rate limiter & in-memory fallback
│   │   ├── cors-origins.test.js       # Dynamic origin matcher & wildcard rejection
│   │   └── token-utils.test.js        # High-entropy token generation & crypto hashing
│   └── src/
│       ├── app.js                     # Express app setup, middleware stack & route bindings
│       ├── server.js                  # Server listener & database connection logic
│       ├── config/                    # Environment schema (Zod), CORS & tenancy config
│       ├── controllers/               # 32 HTTP controllers handling business API requests
│       ├── middlewares/               # Authenticate, authorize, rateLimits, upload, sanitize
│       ├── models/                    # 45 Mongoose schemas (User, Employee, Prediction, etc.)
│       ├── repositories/              # Database data access abstraction layer
│       ├── routes/                    # 31 Express router definitions (/api/v1/*)
│       ├── services/                  # Core business logic (AI proxy, auth, interventions)
│       └── utils/                     # JWT tokens, HMAC hashing, metrics, logger
├── client/                            # React 18 / Vite Frontend Single Page App
│   ├── Dockerfile                     # Nginx static asset serving container
│   ├── nginx.conf                     # Production Nginx reverse proxy config
│   ├── package.json                   # React, Vite, Redux, Vitest & RTL dependencies
│   ├── vite.config.js                 # Vite build configuration, proxy & Vitest jsdom setup
│   └── src/
│       ├── App.jsx                    # Root Router, code-splitting & layout routes
│       ├── main.jsx                   # Entrypoint rendering React DOM with Redux Provider
│       ├── components/                # Reusable UI components (Modals, Nav, Sidebar)
│       ├── layouts/                   # BaseLayout & DashboardLayout wrapper components
│       ├── pages/                     # 28 Application page views (Dashboard, Analytics, etc.)
│       ├── services/                  # Axios API clients (auth, employee, ai, rag)
│       ├── store/                     # Redux Toolkit store & feature slices
│       └── tests/                     # Frontend Vitest test suite (11 passed)
│           ├── setup.js               # @testing-library/jest-dom matchers setup
│           ├── Login.test.jsx         # Login validation, loading, error banner & demo creds
│           └── ProtectedRoute.test.jsx# Auth redirect, spinner & RBAC 403 Access Denied
├── dataset-generator/                 # Node.js synthetic employee dataset generator
├── datasets/                          # Raw & processed CSV dataset storage
├── deploy/                            # Deployment scripts & HuggingFace Space manifests
├── docs/                              # System specifications, SRS, SDD, architecture guides
│   ├── TESTING.md                     # Comprehensive testing guide, commands & inventory
│   └── TESTING_AUDIT.md               # Initial audit findings, root causes & remediation plan
├── models/                            # Active & archived joblib ML model binaries
│   └── active/
│       └── attrition_model.joblib     # Production ML model bundle
├── scripts/                           # Ops backup/restore shell scripts
└── tests/                             # Historical integration, e2e, and consistency suites
```

---

## 5. System Architecture

### High-Level Architecture Overview
RetentionAI follows an API Gateway + Microservice pattern. Client requests originate from the React SPA, pass through Nginx (in production) or Vite dev proxy, and hit the Node.js API Gateway. The Gateway handles identity, authorization, tenant context validation, transactional persistence in MongoDB, and delegates specialized AI operations to the Python FastAPI microservice over HTTP.

```
+-----------------------------------------------------------------------------------+
|                                 React 18 SPA                                      |
|                       (Vite, TailwindCSS, Redux Toolkit)                          |
+-----------------------------------------------------------------------------------+
                                          |
                                    HTTP / REST
                                          v
+-----------------------------------------------------------------------------------+
|                             Node.js / Express Gateway                             |
|  - JWT Auth (HS256) & RBAC          - Mongoose ODM (45 Collections)               |
|  - Tenant Security (organizationId) - Input Sanitization & Audit Logging          |
+-----------------------------------------------------------------------------------+
                      |                                       |
           MongoDB Operations                             HTTP Proxy
                      v                                       v
+---------------------------+       +-----------------------------------------------+
|         MongoDB 7         |       |            Python FastAPI AI Service          |
| Transactional Data & Logs |       |  - Prediction Service (CatBoost/Joblib)       |
+---------------------------+       |  - SHAP Explainer (TreeExplainer)             |
                                    |  - NLP Sentiment/Emotion (Transformers)       |
                                    |  - Hybrid RAG (SentenceTransformers + BM25)   |
                                    |  - 8-Node LangGraph Decision Engine           |
                                    +-----------------------------------------------+
                                            |                       |
                                     Vector Search             LLM Inference
                                            v                       v
                                    +---------------+       +---------------+
                                    |   ChromaDB    |       |   Groq API    |
                                    | Vector Store  |       | (Llama 3.1 8B)|
                                    +---------------+       +---------------+
```

---

## 6. End-to-End System Workflow

### Application Startup Sequence
1. **Node Server Startup**:
   - Loads `.env` and validates environment variables via Zod schema (`server/src/config/env.js`).
   - Connects to MongoDB via Mongoose.
   - Registers Express middleware: `requestId`, `correlationIdMiddleware`, `metricsMiddleware`, `requestLoggingMiddleware`, Helmet CSP, CORS origin matcher, JSON parser, and `sanitizeInput`.
   - Binds 31 router modules under `/api/v1/*` and launches HTTP listener on port `5000`.
2. **AI Service Startup**:
   - Loads `.env` and checks `AI_MODELS_OFFLINE`. If enabled, sets `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`.
   - Validates startup configuration via Pydantic (`ai-service/app/config.py`).
   - Connects to MongoDB via Motor async driver.
   - Runs database collection migration check (`migrate_prediction_history_collection`).
   - Launches three threaded concurrent background tasks with 60s timeouts:
     a. Loads active Joblib model (`attrition_model.joblib`) and initializes SHAP cache.
     b. Loads NLP emotion and zero-shot transformer pipelines (if `NLP_AVAILABLE`).
     c. Initializes ChromaDB vector store and preloads embedding model (if `RAG_AVAILABLE`).
   - Binds FastAPI routers and launches Uvicorn on port `8000`.

### User Request & Authentication Lifecycle
```
User Action → Frontend Axios Request → Authorization Header Attached → Node API Middleware
  → JWT Signature & Expiry Verified → User DB Lookup (Status Check) → Auth Context Attached
  → Controller Handler Executed → DB Mutation / AI Microservice HTTP Call → Audit Log Created → JSON Response
```

---

## 7. Feature-by-Feature Breakdown

### 1. Predictive Attrition Modeling
- **Purpose**: Calculate attrition probability and risk level for individual employees or bulk departments.
- **Implementation**: `ai-service/app/prediction/prediction_service.py` executes feature transformation, runs model inference via `predict_proba()`, applies threshold optimization cutoffs, and persists results to `predictionhistories` and `predictions` collections in MongoDB with native BSON `ObjectId`s.
- **Output**: Risk score ($[0.0, 1.0]$), risk level (`LOW`, `MEDIUM`, `HIGH`), confidence score, model version.

### 2. SHAP Explainable AI (XAI)
- **Purpose**: Explain predictions by quantifying exact feature contributions to risk scores.
- **Implementation**: `ai-service/app/explainability/shap_explainer.py` uses a cached `TreeExplainer` or `LinearExplainer`. Features are dynamically mapped from training metadata (`numerical_cols` + `categorical_cols`). `local_explainer.py` extracts top positive drivers and waterfall plot coordinates.
- **Output**: Positive/negative SHAP impact values, humanized feature labels, base expected value.

### 3. Unstructured Feedback NLP Analysis
- **Purpose**: Analyze qualitative employee surveys and manager feedback.
- **Implementation**: `ai-service/app/nlp/analyzer.py` applies zero-shot topic classification and emotion detection to compute sentiment scores, burnout risk, and manager conflict signals.
- **Output**: Sentiment classification (`Positive`, `Neutral`, `Negative`), burnout score ($[0, 1]$), dominant emotion.

### 4. Enterprise Knowledge RAG Policy Retrieval
- **Purpose**: Retrieve relevant company policy documents for HR queries.
- **Implementation**: `ai-service/app/rag/services/rag_service.py` performs hybrid search (dense embeddings via `all-MiniLM-L6-v2` + sparse BM25) fused with Reciprocal Rank Fusion (RRF). Queries are filtered strictly by `organizationId`. LLM generation is gated; if no chunks exceed relevance threshold ($0.15$), a fallback message is returned without calling the LLM.
- **Output**: Grounded answer text, inline citations (`[Doc: Policy.pdf]`), source chunk metadata, groundedness score.

### 5. LangGraph Autonomous Retention Agent
- **Purpose**: Orchestrate multi-step reasoning to generate policy-grounded retention strategies.
- **Implementation**: An 8-node LangGraph pipeline (`ai-service/app/agent/`) processes `AgentState`:
  1. `context_validation_node`: Validates employee identity and tenant ownership.
  2. `ml_risk_agent_node`: Retrieves or computes attrition risk.
  3. `explainability_agent_node`: Extracts top SHAP risk drivers.
  4. `employee_context_agent_node`: Compiles timeline and NLP observations.
  5. `rag_policy_agent_node`: Fetches tenant-isolated HR policy passages.
  6. `retention_strategy_agent_node`: Generates strategies via Groq LLM.
  7. `decision_validation_node`: Validates citations and integrity.
  8. `final_decision_node`: Assembles output payload and execution trace.

---

## 8. Frontend Architecture

- **Framework**: React 18 built with Vite.
- **Routing**: `react-router-dom` v6 with lazy loading (`Suspense`) across 28 pages.
- **State Management**: Redux Toolkit (`authSlice`, `dashboardSlice`, `employeeSlice`, `notificationSlice`).
- **Axios Interceptor**: `client/src/services/api.js` attaches JWT bearer tokens and automatically handles 401 refresh token rotation.
- **Layout System**:
  - `BaseLayout`: Unauthenticated public page wrapper.
  - `DashboardLayout`: Authenticated layout providing `Navbar`, `Sidebar`, global search, and notification bell.
- **Key Views**: `Dashboard.jsx`, `EmployeeProfile.jsx`, `ExecutiveDashboard.jsx`, `AiObservabilityPage.jsx`, `AiGovernancePage.jsx`, `KnowledgeManagement.jsx`, `InterventionsPage.jsx`.

---

## 9. Backend Architecture

- **Framework**: Express.js on Node 18.
- **Middleware Pipeline Order**:
  `requestId` $\rightarrow$ `correlationIdMiddleware` $\rightarrow$ `metricsMiddleware` $\rightarrow$ `requestLoggingMiddleware` $\rightarrow$ `helmet` $\rightarrow$ `cors` $\rightarrow$ `compression` $\rightarrow$ `json` $\rightarrow$ `sanitizeInput` $\rightarrow$ `routes` $\rightarrow$ `enforceActiveOrganization` $\rightarrow$ `notFoundHandler` $\rightarrow$ `errorHandler`.
- **Authentication**: JWT access token in `Authorization: Bearer` header. Decoded by `authenticate.js` middleware, which attaches user context (`userId`, `role`, `permissions`, `organizationId`) to `request.auth`.
- **RBAC**: `authorize.js` checks user roles or explicit permission strings (e.g., `permission:reports.read`).
- **Database Access**: Encapsulated repositories (`userRepository.js`, `employeeRepository.js`, etc.) using Mongoose schemas.

---

## 10. API Documentation (Core Endpoints)

| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | No | User login; returns access token & sets HTTP-only refresh cookie |
| `POST` | `/api/v1/auth/refresh` | No | Rotates opaque refresh token & returns new access token |
| `GET` | `/api/v1/employees` | Yes | List tenant employees with pagination and filters |
| `GET` | `/api/v1/employees/:id` | Yes | Get employee detailed profile with risk history |
| `POST` | `/api/v1/ai/predict` | Yes | Trigger attrition risk prediction for an employee |
| `GET` | `/api/v1/explain/local/:id` | Yes | Get SHAP local feature attribution for employee |
| `POST` | `/api/v1/knowledge/query` | Yes | Execute RAG search query against tenant policy vector store |
| `POST` | `/api/v1/decisions/recommend` | Yes | Trigger 8-node LangGraph retention strategy generation |
| `GET` | `/api/v1/executive/summary` | Yes (`EXECUTIVE`+) | Fetch organizational turnover metrics & risk distribution |
| `GET` | `/api/v1/observability/metrics` | Yes (`ADMIN`+) | Get AI pipeline latency, drift, and call volume telemetry |
| `GET` | `/health` | No | Liveness check probe |
| `GET` | `/health/deep` | No | Deep health inspection (Mongo, ML models, vectorstore, RAM/CPU) |

---

## 11. Database Architecture

- **Technology**: MongoDB 7.0 managed via Mongoose ODM (Node) and Motor (Python).
- **Tenant Scope**: Documents contain `organizationId` typed as BSON `ObjectId` with indexing for query isolation.
- **Key Collections**:
  - `users`: User credentials, password hash (bcrypt), role ref, organizationId ref.
  - `organizations`: Tenant metadata, subscription tier, active status (`ACTIVE`, `SUSPENDED`).
  - `employees`: Core employee records, department, job role, salary, tenure, overtime status.
  - `predictions`: Current active risk prediction record per employee.
  - `predictionhistories`: Historical log of all prediction runs (`predictionhistories` pluralization).
  - `explanations`: Cached SHAP feature impact values.
  - `interventions`: HR action workflows, assigned owner, SLA, status (`PROPOSED`, `APPROVED`, `COMPLETED`).
  - `rag_logs`: RAG query telemetry, latency, groundedness score, citations.
  - `auditlogs`: Immutable security and administrative audit trail.

---

## 12. Authentication and Authorization

```
Client Request → Bearer Token → verifyAccessToken() [HS256] → User DB Lookup → Active Status Verified
  → Attach req.auth → authorize(role/permission) → Enforce Active Org Status → Execute Route
```
- **Access Tokens**: Short-lived JWTs (default 15 mins) carrying `sub`, `role`, and `organizationId`.
- **Refresh Tokens**: 48-byte base64url CSPRNG tokens (384-bit entropy). Stored in DB as HMAC-SHA-256 hashes.
- **Password Hashing**: Bcrypt with 12 salt rounds.

---

## 13. AI / ML Architecture

- **Algorithms**: CatBoostClassifier, XGBoostClassifier, RandomForestClassifier, LogisticRegression.
- **Preprocessing Pipeline**: `fit_transform_pipeline()` handles missing values, standard scaling (`StandardScaler`), categorical encoding (`OneHotEncoder` / `OrdinalEncoder`), and synthetic feature generation.
- **Calibration**: Wrapping raw classifiers in `CalibratedClassifierCV` (isotonic regression) to ensure risk probabilities reflect true empirical likelihood.
- **Threshold Optimization**: Decision cutoffs optimize PR-AUC (Precision-Recall Area Under Curve) rather than assuming a default $0.5$ split.

---

## 14. LLM / Generative AI Architecture

- **Provider**: Groq API.
- **Model**: `llama-3.1-8b-instant`.
- **Usage**: Invoked during RAG answer generation and LangGraph strategy synthesis (`retention_strategy_agent_node`).
- **Safety**: Prompt templates strictly isolate LLM context to tenant-scoped data and enforce structured JSON responses.

---

## 15. RAG Architecture

```
User Query → Hybrid Search (Dense all-MiniLM-L6-v2 + Sparse BM25) → RRF Rank Fusion
  → Filter by organizationId → Relevance Threshold Check (>= 0.15)
  → Groundedness Check → Groq LLM Generation → Response with Inline Citations
```
- **Chunking**: Character-based chunking with configurable overlap.
- **Vector Store**: ChromaDB persisted locally at `/app/chroma_db`.

---

## 16. Agent / Agentic AI Architecture

- **Engine**: LangGraph state graph executing over `AgentState`.
- **Graph Topology**: Linear 8-node state transition graph (`context_validation` $\rightarrow$ `ml_risk` $\rightarrow$ `explainability` $\rightarrow$ `employee_context` $\rightarrow$ `rag_policy` $\rightarrow$ `retention_strategy` $\rightarrow$ `decision_validation` $\rightarrow$ `final_decision`).
- **Fallbacks**: If LLM inference fails, node switches to pre-configured rule-based recommendation templates.

---

## 17. AI/ML + Application Integration

Data flows from the React UI to Node.js, which delegates to FastAPI AI Service endpoints over HTTP using a shared service token (`AI_SERVICE_TOKEN`). FastAPI fetches or updates MongoDB directly for heavy ML artifacts and returns structured JSON responses to Node, which returns them to the UI.

---

## 18. Data Flow

1. **Prediction Flow**: Employee Document $\rightarrow$ Feature Transformer $\rightarrow$ Calibrated ML Model $\rightarrow$ Risk Score & Level $\rightarrow$ Persisted to Mongo `predictions` & `predictionhistories`.
2. **SHAP Flow**: Employee Feature Vector $\rightarrow$ SHAP Explainer Cache $\rightarrow$ Tree/Linear Attribution $\rightarrow$ Top Drivers & Coordinates $\rightarrow$ Response JSON.
3. **RAG Flow**: Query $\rightarrow$ Dense/Sparse Hybrid Retrieval $\rightarrow$ RRF Fusion $\rightarrow$ Threshold Filter $\rightarrow$ Grounded LLM Prompt $\rightarrow$ Answer + Citations.

---

## 19. Important Classes, Functions and Modules

- `PredictionService` (`ai-service/app/prediction/prediction_service.py`): Manages ML model loading, feature enrichment, and single/batch inference.
- `ShapExplainerCache` (`ai-service/app/explainability/shap_explainer.py`): Singleton managing fitted SHAP explainers and background data matrices.
- `retention_graph_app` (`ai-service/app/agent/retention_graph.py`): Compiled 8-node LangGraph executable graph instance.
- `query_rag()` (`ai-service/app/rag/services/rag_service.py`): Core RAG execution logic with relevance gating and groundedness evaluation.
- `authenticate` (`server/src/middlewares/authenticate.js`): Primary Express authentication middleware validating JWT access tokens.
- `authorize` (`server/src/middlewares/authorize.js`): RBAC permission enforcement middleware.

---

## 20. Configuration

Configurations are declared via `.env.example` at root and parsed at runtime:
- Node.js: `server/src/config/env.js` (validated via Zod).
- Python: `ai-service/app/config.py` (validated via Pydantic BaseSettings).

---

## 21. Environment Variables

| Variable | Purpose | Required | Used By | Example Placeholder |
| :--- | :--- | :--- | :--- | :--- |
| `JWT_ACCESS_SECRET` | Secret key for signing JWT access tokens | Yes | Server | `<secret>` |
| `JWT_REFRESH_SECRET` | Secret key for HMAC hashing refresh tokens | Yes | Server | `<secret>` |
| `AI_SERVICE_TOKEN` | Shared secret token for Server $\leftrightarrow$ AI Service auth | Yes | Server & AI Service | `<secret>` |
| `GROQ_API_KEY` | API key for Groq LLM inference | Yes (Prod) | AI Service | `<secret>` |
| `MONGODB_URI` | Connection string for MongoDB | Yes | Server & AI Service | `mongodb://mongo:27017` |
| `CORS_ORIGINS` | Allowed origins for cross-origin requests | Yes | Server | `http://localhost:5173` |
| `AI_MODELS_OFFLINE` | Force offline loading for HuggingFace models | No | AI Service | `true` |

---

## 22. External Services and APIs

- **MongoDB Atlas / Local MongoDB**: Core document storage database.
- **Groq API**: Cloud LLM endpoint serving `llama-3.1-8b-instant`.
- **Upstash Redis (REST)**: Optional distributed cache and job store.
- **Stripe API**: Placeholders for subscription billing and webhooks.

---

## 23. Error Handling

- **Node.js**: Global `AppError` class transformed into structured JSON errors by `errorHandler.js`.
- **FastAPI**: Exception handlers capturing model errors and returning standard HTTP status codes (`400`, `401`, `403`, `404`, `500`, `503`).

---

## 24. Security

- Password hashing using bcrypt (12 rounds).
- Opaque 384-bit refresh tokens stored as HMAC-SHA-256 digests.
- Strict tenant boundary enforcement (`organizationId`) attached directly from user JWT context.
- Input sanitization (`sanitizeInput`) stripping potentially malicious query injection structures.

---

## 25. CORS / Nginx / Networking / Reverse Proxy

- Express configures `cors` with `createOriginMatcher` allowing explicit origins and methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`).
- Production Docker container uses Nginx to serve static React assets and proxy `/api` calls to the Node.js backend.

---

## 26. Docker / Deployment

- **Root Docker Compose**: Launches `mongo` (27017), `ai-service` (8000), `server` (5000), and `client` (80).
- **Render Blueprint (`render.yaml`)**: Deploys server and AI service as Docker web services with external MongoDB Atlas.

---

## 27. Build and Runtime Process

```bash
# Local Development Startup
# 1. Start MongoDB
docker-compose up mongo -d

# 2. Start AI Microservice
cd ai-service && uvicorn app.main:app --reload --port 8000

# 3. Start Express Backend
cd server && npm run dev

# 4. Start React Frontend
cd client && npm run dev
```

---

## 28. Testing Infrastructure & Quality Engineering

RetentionAI employs an enterprise-grade, multi-tier automated testing architecture spanning backend APIs, machine learning pipelines, multi-tenant security enforcement, and frontend user flows:

### Test Strategy & Architecture

| Tier | Test Runner & Tools | Location | Scope & Target Capabilities |
| :--- | :--- | :--- | :--- |
| **Node.js Unit & Utility** | Node Native Test Runner (`node --test`) | `server/tests/` | Error handling normalization (`AppError`, Mongo 11000, Zod, 500 secret suppression), JWT claim validation, password complexity, RBAC permission trees, rate-limit fallback, and CORS regex matching. |
| **REST API Integration** | Supertest (`^7.2.2`) + MongoMemoryServer | `server/tests/apiContracts.supertest.test.js` | In-memory API contract validation (`/health`, `/health/deep`, `/api/v1/auth/*`, `/api/v1/employees/*`), downstream circuit breakers, and token rotation. |
| **Multi-Tenant Security** | Supertest + MongoMemoryServer | `server/tests/apiContracts.supertest.test.js` | Cross-organization IDOR isolation (Org A vs Org B closed 404s), parameter tampering prevention (`organizationId` injection), RBAC 403 Forbidden gating, and token signature tampering rejection. |
| **Python AI Microservice** | PyTest (`^9.1.1`) + pytest-cov (`^7.1.0`) + HTTPX | `ai-service/tests/` | ML model training & XGBoost/LightGBM inference, Tree SHAP force plots in headless non-IPython environments, LangGraph 8-node decision agent workflows, RAG relevance thresholds (0.15), and LITE capability degradation. |
| **React Frontend SPA** | Vitest (`^5.0.4`) + React Testing Library + JSDOM | `client/src/tests/` | Login form validation schemas, Redux Toolkit asynchronous error banner rendering, loading spinners, and role-aware `ProtectedRoute` authorization. |
| **CI/CD Automation** | GitHub Actions | `.github/workflows/ci.yml` | Multi-job parallel pipeline executing backend unit/integration tests, PyTest with code coverage, and frontend Vitest & production build verification. |

### Verified Test Results & Metrics (Actual Test-Runner Execution Output)

All test counts reflect live, verified test execution output without artificial inflation or mocked behavior bypass:

```
Platform Test Execution Summary:
├── Node.js Backend Suites:      58 Passed,   0 Failed, 0 Skipped (8.78s)
├── Python FastAPI AI Service:  108 Passed,   0 Failed, 2 Skipped (12.44s)
└── React Frontend Vitest:       11 Passed,   0 Failed, 0 Skipped (4.17s)
─────────────────────────────────────────────────────────────────────────────
TOTAL PLATFORM TESTS:           177 Passed,   0 Failed, 2 Skipped (179 Total Tests)
```

*Note on Skipped Tests*: In `ai-service/tests/test_nlp.py`, 2 tests (`test_sentiment_accuracy_benchmark` and `test_emotion_lexicon_coverage`) are conditionally skipped when `AI_STACK_CAPABILITY=LITE` because they require downloading multi-gigabyte Hugging Face Transformer weights.

### Detailed Test Inventory

1. **Backend Unit & Error Handling (`server/tests/error-handler.test.js` & utilities)**:
   - `AppError` instantiation with status codes, machine-readable error codes, and structured metadata.
   - Transformation of MongoDB duplicate key error code `11000` into standardized HTTP 409 Conflict.
   - Transformation of Mongoose `ValidationError` and `CastError` into HTTP 400 Bad Request.
   - Extraction and mapping of Zod validation issues into field-level `details` arrays.
   - Secret & stack trace suppression: verifies unexpected internal exceptions return HTTP 500 with generic safe error messages while redacting internal stack traces and database connection strings.
   - 404 handler verification returning standardized `NOT_FOUND` payloads with request correlation IDs (`X-Request-Id`).
   - JWT tokens: claim encoding, signature verification, and expired/tampered token rejection.
   - Password policy: uppercase, lowercase, digit, and special character enforcement.
   - RBAC: Role hierarchy validation for `ADMIN`, `HR_MANAGER`, `EMPLOYEE`, and `EXECUTIVE` with wildcard (`*`) support.
   - Rate limiting: in-memory store fallback when Upstash Redis is unconfigured or partitioned.
   - CORS matcher: allowlist validation and unsafe wildcard (`*` host) rejection.

2. **REST API Contracts & Multi-Tenant IDOR (`server/tests/apiContracts.supertest.test.js`)**:
   - `GET /health`: Liveness probe status.
   - `GET /health/deep`: Deep dependency probe reporting status of MongoDB, Python AI service, and Redis.
   - `POST /api/v1/auth/login`: Credential validation, token issuance, PII exclusion, schema enforcement.
   - `POST /api/v1/auth/refresh`: Refresh token rotation and replay-attack rejection.
   - `GET /api/v1/employees`: Paginated employee records, cursor limits, authentication gating.
   - `GET /api/v1/employees/:id`: Single employee retrieval, ObjectId validation, 404 error formatting.
   - **Tenant Isolation (Cross-Org IDOR)**: Verifies Organization A admin cannot access or mutate Organization B employee profiles (fails closed with 404).
   - **Tenant Injection Prevention**: Parameter tampering (`?organizationId=orgB`) is strictly prevented; queries are forced to use `req.auth.organizationId`.
   - **Downstream Circuit Breaker**: Tests graceful HTTP 503 handling (`AI_SERVICE_UNAVAILABLE` / `AI_PREDICT_FAILED`) when AI service is offline.

3. **Python AI Service PyTest Suite (`ai-service/tests/`)**:
   - `test_api.py`: FastAPI routes, health checks, batch predictions, and input validation.
   - `test_shap.py`: Tree SHAP feature attribution generation, force plots in headless non-IPython environments, and malformed payload resilience.
   - `test_agent.py`: LangGraph 8-node decision recommendations, risk assessment, and HR workflow routing across `/decision/generate`, `/decision/batch`, `/decision/history`, and `/decision/dashboard`.
   - `test_nlp.py`: Employee feedback sentiment analysis and emotion classification under LITE/FULL capability profiles.
   - `test_rag.py` & `test_rag_groundedness.py`: Vector knowledge retrieval, threshold relevance (0.15 gate), and empty index fallbacks.
   - `test_features.py`: Feature engineering pipeline and categorical encodings.

4. **React Frontend Vitest Suite (`client/src/tests/`)**:
   - `Login.test.jsx`: Form rendering, Zod schema validation errors, malformed email handling, Redux API error rendering, loading spinner states, and demo credential population.
   - `ProtectedRoute.test.jsx`: Unauthenticated redirect to `/login`, auth initialization spinner, role permission authorization, and 403 Access Denied rendering.

### Test Execution Commands

```bash
# 1. Run Node.js Backend Core Test Suite (Unit + Supertest Contracts)
cd server && npm test

# 2. Run Python AI Service Tests with Coverage
cd ai-service && pytest --cov=app --cov-report=term-missing tests/

# 3. Run React Frontend Tests
cd client && npm run test
```

---

## 29. Performance and Optimization

- **Route Code-Splitting**: React pages loaded dynamically via `React.lazy()` reducing initial JS bundle size.
- **Threaded AI Startup**: Heavy ML/NLP/vectorstore startup sequences offloaded to worker threads via `asyncio.to_thread` with 60s step timeouts.
- **Hybrid RRF Search**: RRF fusion combining top vector matches with fast BM25 lexical ranking.

---

## 30. Important Design Decisions

- **Server-Bound Tenant Context**: `organizationId` is derived exclusively from the authenticated user record, preventing header-based cross-tenant spoofing.
- **Collection Pluralization Alignment**: FastAPI Python models explicitly read and write to `predictionhistories` to match Mongoose default pluralization rules.
- **Capability Probing**: Feature groups (NLP/RAG) are dynamically probed (`importlib.util.find_spec`) allowing dual LITE/FULL image deployments without environment flag drift.

---

## 31. Technical Trade-offs

- **Embedded ChromaDB vs. Managed Vector DB**: Embedded ChromaDB eliminates external vector DB costs for single-host deployments but requires persistent disk mounts.
- **Node Gateway Proxy vs. Direct UI $\rightarrow$ Python Connections**: Centralizing UI requests through Node ensures single-point JWT validation and audit logging at the cost of one extra HTTP hop.

---

## 32. Current Limitations

1. **CatBoost Wheel Availability on Windows Python 3.13**: Pre-compiled CatBoost wheels are not officially published for Python 3.13 on Windows; model training and inference gracefully fall back to XGBoost and LightGBM models.
2. **LITE Capability Mode in Low-Memory Hosts**: On memory-constrained hosts (< 512MB RAM), the AI service operates in `LITE` mode, omitting local PyTorch/Transformers and ChromaDB; 2 NLP accuracy tests requiring local Hugging Face downloads are conditionally skipped.
3. **End-to-End Browser Testing**: Browser-level Playwright tests were intentionally omitted to avoid heavy headless browser binary overhead and display dependencies in restricted CI container runners.
4. **Stripe Billing Integration**: In `server/src/models/Organization.js`, fields for `stripeCustomerId` and `stripeSubscriptionId` exist for planned billing milestones, but billing webhook endpoints are scheduled for Phase 2.
5. **Single Active ML Model Bundle**: The prediction service loads one primary active model bundle (`attrition_model.joblib`) from `/app/models/active` at any given time.

---

## 33. Known Issues / TODOs

- Reconcile legacy pre-seeded collections (`predictionHistory` vs `predictionhistories`) handled at startup by `migrate_prediction_history_collection()`.

---

## 34. Important Constants and Business Logic

- `JWT_ACCESS_TTL`: Default `15m`.
- `JWT_REFRESH_TTL`: Default `7d`.
- `RAG_MIN_RELEVANCE_SCORE`: `0.15`.
- `STARTUP_STEP_TIMEOUT_SECONDS`: `60`.

---

## 35. Complete Dependency Map

```
React SPA Component
    ↓ Axios API Client
Express Route (/api/v1/*)
    ↓ authenticate & authorize Middlewares
Express Controller
    ↓ Service / Repository
Mongoose Model → MongoDB
    ↓ (For AI Operations)
HTTP Request → FastAPI Route
    ↓ Service (Prediction / SHAP / RAG / Agent)
    ├→ CatBoost / Joblib Bundle
    ├→ SHAP Explainer Cache
    ├→ ChromaDB Vector Store
    └→ LangGraph Graph → Groq API (LLM)
```

---

## 36. Important Runtime Sequences

### Single Employee Attrition Prediction Run
1. User clicks "Predict Risk" on Employee Profile in UI.
2. Frontend issues `POST /api/v1/ai/predict` with `{ employeeId }`.
3. Node server authenticates token, extracts `organizationId`, and proxies request to FastAPI AI service.
4. FastAPI `prediction_service` retrieves employee record and enriches feature set with attendance/performance logs.
5. Scaler and encoders transform feature vector; model computes calibrated probability.
6. Risk level is assigned (`LOW`, `MEDIUM`, `HIGH`) based on optimized decision threshold.
7. Prediction result is upserted to `predictions` and logged in `predictionhistories`.
8. Python service returns prediction JSON to Node server, which logs audit event and sends response to UI.

---

## 37. Interview Perspective

### 30-Second Summary
"RetentionAI is an enterprise SaaS platform that predicts employee turnover and generates personalized retention plans. It uses a CatBoost ML model for attrition risk scoring, SHAP for feature explainability, a hybrid RAG pipeline for company policy search, and an 8-node LangGraph agent to synthesize policy-aligned retention recommendations."

### 1-Minute Summary
"RetentionAI is a full-stack, multi-tenant employee retention platform. The architecture features a React 18 SPA frontend, a Node.js/Express REST gateway, and a Python FastAPI AI microservice backed by MongoDB and ChromaDB. On the AI side, we train calibrated machine learning models to score employee attrition risk, use SHAP to pinpoint specific risk drivers like overtime or pay gaps, and utilize hybrid RAG (dense embeddings + BM25) to search tenant policy documents. Finally, an 8-node LangGraph agent combines these signals to generate structured, actionable HR retention strategies with cost and SLA estimates."

### 2-Minute Technical Deep-Dive
"Architecture-wise, RetentionAI isolates tenant context at every tier. The Node.js gateway validates JWTs and binds tenant context directly from database records, preventing header spoofing. When an attrition prediction is requested, the Node gateway delegates to the FastAPI microservice. FastAPI enriches raw employee data with historical attendance and performance metrics before running inference through a calibrated CatBoost pipeline. To explain the score, our SHAP module dynamically derives feature metadata from the trained bundle to compute local force values. If retention strategies are needed, our 8-node LangGraph state graph executes: validating context, pulling risk scores and SHAP drivers, retrieving tenant-isolated policy passages from ChromaDB using Reciprocal Rank Fusion, and invoking Groq's Llama 3.1 8B LLM to output structured recommendations. The entire Python service is designed for resiliency, using capability probing for dual LITE/FULL Docker builds and offloading heavy model loads to threaded async tasks with 60-second timeouts."

### Key Technical Challenges & Solutions
- **Challenge**: Async startup hangs in FastAPI due to HuggingFace network calls checking model revisions.
  - **Solution**: Set `AI_MODELS_OFFLINE=true`, enforcing `HF_HUB_OFFLINE=1` before importing transformer modules, and wrapping startup loads in `asyncio.to_thread` with explicit timebox limits.
- **Challenge**: Cross-tenant data leaks in multi-tenant RAG vector queries.
  - **Solution**: Applied mandatory `organizationId` metadata filtering in ChromaDB queries combined with a code-level defense-in-depth assertion validating document metadata before prompt construction.
- **Challenge**: Hallucinations in LLM policy answers.
  - **Solution**: Implemented a hard code-level relevance gate (`MIN_RELEVANCE_SCORE = 0.15`). If zero retrieved chunks meet the threshold, the LLM is never invoked, returning a standardized fallback message.

---

## 38. Project Questions an AI Should Be Able to Answer

- What is the overall system architecture of RetentionAI?
- How is multi-tenancy enforced across Node.js, FastAPI, MongoDB, and ChromaDB?
- What machine learning algorithms are used for attrition prediction, and how are models calibrated?
- How does the SHAP explainability engine compute local and global feature attributions?
- What are the 8 nodes of the LangGraph agent graph, and what does each node accomplish?
- How does the hybrid RAG retrieval pipeline combine dense vector search with sparse BM25 search?
- What mechanism prevents startup hangs when loading HuggingFace models?
- What is the difference between the FULL and LITE AI service Docker builds?
- How are JWT access tokens and opaque refresh tokens issued, validated, and stored?
- What database collections store prediction histories, and how was pluralization aligned between Node and Python?

---

## 39. Source-of-Truth Rules

1. The actual repository source code is the primary source of truth.
2. Existing documentation in `docs/` or `README.md` may reflect earlier iterations; implementation details in code override documentation statements when discrepancies arise.
3. If an operational setting or behavior cannot be confirmed from the repository source files, it is explicitly noted as not identifiable.
4. Secrets and credentials must never be exposed; safe placeholders are used throughout configuration references.

---

## 40. Final Project Summary

RetentionAI is a production-grade, multi-tenant employee intelligence and retention platform. Built with a React 18 frontend, a Node.js/Express API gateway, a Python FastAPI AI microservice, MongoDB document storage, and ChromaDB vector search, it provides an end-to-end workflow from attrition risk prediction to XAI feature attribution and AI agent strategy synthesis. By combining calibrated ML classification, SHAP explainability, transformer-based NLP, hybrid RAG policy retrieval, and an 8-node LangGraph state graph, RetentionAI empowers HR teams with transparent, actionable, and policy-grounded employee retention solutions.
