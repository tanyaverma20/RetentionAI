# RetentionAI — Complete System Architecture & Project Context Document

---

## Table of Contents

- [1. Executive Summary & Project Overview](#1-executive-summary--project-overview)
  - [1.1 One-Sentence Explanation](#11-one-sentence-explanation)
  - [1.2 Interview-Ready Explanation](#12-interview-ready-explanation)
  - [1.3 Detailed Technical Overview](#13-detailed-technical-overview)
  - [1.4 Operational Modes & Limitations](#14-operational-modes--limitations)
- [2. Project Goals, Problem Statement & Scope](#2-project-goals-problem-statement--scope)
  - [2.1 Motivation & Enterprise Turnover Economics](#21-motivation--enterprise-turnover-economics)
  - [2.2 Core System Objectives](#22-core-system-objectives)
  - [2.3 Out of Scope (Explicit Non-Goals)](#23-out-of-scope-explicit-non-goals)
- [3. Verified Technology Stack](#3-verified-technology-stack)
- [4. Complete Repository Structure & File Map](#4-complete-repository-structure--file-map)
- [5. System Architecture](#5-system-architecture)
  - [Figure 1: High-Level System Architecture](#figure-1-high-level-multi-tenant-system-architecture)
- [6. End-to-End System Workflow & Request Lifecycle](#6-end-to-end-system-workflow--request-lifecycle)
  - [6.1 Application Startup & Concurrent Background Warmup](#61-application-startup--concurrent-background-warmup)
  - [6.2 Complete Request Lifecycle & Middleware Pipeline](#62-complete-request-lifecycle--middleware-pipeline)
  - [Figure 2: End-to-End Request Lifecycle Sequence](#figure-2-end-to-end-request-lifecycle-and-service-orchestration)
- [7. Feature-by-Feature Technical Breakdown](#7-feature-by-feature-technical-breakdown)
  - [7.1 Predictive Workforce Attrition Modeling](#71-predictive-workforce-attrition-modeling)
  - [7.2 Explainable AI (SHAP XAI) & Causal Boundaries](#72-explainable-ai-shap-xai--causal-boundaries)
  - [7.3 Unstructured Employee Feedback NLP Analysis](#73-unstructured-employee-feedback-nlp-analysis)
  - [7.4 Enterprise Knowledge RAG Policy Retrieval](#74-enterprise-knowledge-rag-policy-retrieval)
  - [7.5 LangGraph Autonomous Retention Decision Engine](#75-langgraph-autonomous-retention-decision-engine)
  - [7.6 Executive Workforce Intelligence Center & Governance](#76-executive-workforce-intelligence-center--governance)
- [8. Frontend Architecture & User Interface](#8-frontend-architecture--user-interface)
  - [8.1 React 18 SPA Architecture & Redux Store](#81-react-18-spa-architecture--redux-store)
  - [8.2 Verified Page Inventory (28 Views)](#82-verified-page-inventory-28-views)
- [9. Backend Gateway Architecture (Node.js / Express)](#9-backend-gateway-architecture-nodejs--express)
  - [9.1 Middleware Execution Order](#91-middleware-execution-order)
  - [9.2 Role-Based Access Control (RBAC) Matrix (9 Roles)](#92-role-based-access-control-rbac-matrix-9-roles)
- [10. Verified API Endpoint Inventory (256 Endpoints)](#10-verified-api-endpoint-inventory-256-endpoints)
  - [10.1 Express Backend Gateway Routes (197 Endpoints across 31 Files)](#101-express-backend-gateway-routes-197-endpoints-across-31-files)
  - [10.2 FastAPI AI Microservice Routes (59 Endpoints across 11 Files)](#102-fastapi-ai-microservice-routes-59-endpoints-across-11-files)
  - [10.3 Core API Contract Reference](#103-core-api-contract-reference)
- [11. Database Architecture & Data Modeling](#11-database-architecture--data-modeling)
  - [11.1 MongoDB 7.0 & Mongoose Schema Mapping (45 Schemas)](#111-mongodb-70--mongoose-schema-mapping-45-schemas)
  - [Figure 9: Database Schema & Entity-Relationship Architecture](#figure-9-database-schema--entity-relationship-architecture)
- [12. Authentication, Session & Token Lifecycle](#12-authentication-session--token-lifecycle)
  - [12.1 Cryptographic Token Issuance & Refresh Strategy](#121-cryptographic-token-issuance--refresh-strategy)
  - [Figure 8: Authentication, Token Rotation & Replay Protection](#figure-8-authentication-token-rotation--replay-protection)
- [13. AI / Machine Learning Pipeline Architecture](#13-ai--machine-learning-pipeline-architecture)
  - [13.1 Feature Engineering & Multimodal Attribute Vector (28 Features)](#131-feature-engineering--multimodal-attribute-vector-28-features)
  - [13.2 Model Benchmarking, Calibration & Threshold Optimization](#132-model-benchmarking-calibration--threshold-optimization)
  - [Figure 3: ML Ingestion, Preprocessing & Inference Pipeline](#figure-3-ml-ingestion-preprocessing--inference-pipeline)
  - [Figure 4: SHAP Explainability & Attribution Architecture](#figure-4-shap-explainability--attribution-architecture)
- [14. Large Language Model (LLM) Integration & Prompt Engineering](#14-large-language-model-llm-integration--prompt-engineering)
- [15. Retrieval-Augmented Generation (Hybrid RAG) Architecture](#15-retrieval-augmented-generation-hybrid-rag-architecture)
  - [15.1 Dense Embeddings, BM25 Lexical Ranking & Reciprocal Rank Fusion](#151-dense-embeddings-bm25-lexical-ranking--reciprocal-rank-fusion)
  - [Figure 5: Hybrid RAG Policy Retrieval Architecture](#figure-5-hybrid-rag-policy-retrieval-architecture)
- [16. Autonomous Agent Architecture (LangGraph 8-Node State Machine)](#16-autonomous-agent-architecture-langgraph-8-node-state-machine)
  - [16.1 Graph Topology, AgentState & Node Contracts](#161-graph-topology-agentstate--node-contracts)
  - [Figure 6: 8-Node LangGraph Retention Decision Workflow](#figure-6-8-node-langgraph-retention-decision-workflow)
- [17. AI/ML Microservice Integration & Inter-Service Security](#17-aiml-microservice-integration--inter-service-security)
- [18. End-to-End Data Flow Trajectories](#18-end-to-end-data-flow-trajectories)
- [19. Core Classes, Modules & Architectural Interfaces](#19-core-classes-modules--architectural-interfaces)
- [20. Configuration Architecture & Runtime Environment](#20-configuration-architecture--runtime-environment)
- [21. Environment Variable Reference & Security Boundaries](#21-environment-variable-reference--security-boundaries)
- [22. External Dependencies & Cloud Services](#22-external-dependencies--cloud-services)
- [23. Error Handling, Circuit Breakers & Resilience](#23-error-handling-circuit-breakers--resilience)
  - [Figure 11: Error Handling & Fallback Hierarchy](#figure-11-error-handling-circuit-breakers--fallback-hierarchy)
- [24. Multi-Tenant Security & Defense-in-Depth Model](#24-multi-tenant-security--defense-in-depth-model)
  - [Figure 7: Multi-Tenant Security & Isolation Model](#figure-7-multi-tenant-security--isolation-model)
- [25. Networking, CORS, Reverse Proxy & Security Headers](#25-networking-cors-reverse-proxy--security-headers)
- [26. Containerization, Deployment & Cloud Topology](#26-containerization-deployment--cloud-topology)
  - [Figure 10: Deployment & Infrastructure Topology](#figure-10-deployment--infrastructure-topology)
- [27. Local Development & Operational Runtime Runbook](#27-local-development--operational-runtime-runbook)
- [28. Multi-Tier Testing Infrastructure & Quality Engineering](#28-multi-tier-testing-infrastructure--quality-engineering)
  - [28.1 Automated Test Execution Summary](#281-automated-test-execution-summary)
  - [28.2 Backend, AI & Frontend Test Suite Inventory](#282-backend-ai--frontend-test-suite-inventory)
  - [Figure 12: Multi-Tier Testing Architecture Matrix](#figure-12-multi-tier-testing-architecture-matrix)
- [29. Performance Benchmarks, Load Testing & Telemetry](#29-performance-benchmarks-load-testing--telemetry)
  - [29.1 Autocannon Load Testing Results & Scaling Curves](#291-autocannon-load-testing-results--scaling-curves)
  - [29.2 Production ML MLOps & Lineage Verification](#292-production-ml-mlops--lineage-verification)
- [30. Architectural Decisions (ADRs) & Trade-offs](#30-architectural-decisions-adrs--trade-offs)
- [31. Technical Trade-offs & Engineering Compromises](#31-technical-trade-offs--engineering-compromises)
- [32. Current System Limitations & Defensible Scope Boundaries](#32-current-system-limitations--defensible-scope-boundaries)
- [33. Technical Debt, Known Issues & Product Roadmap](#33-technical-debt-known-issues--product-roadmap)
- [34. Critical Constants, Thresholds & Default Parameters](#34-critical-constants-thresholds--default-parameters)
- [35. Complete System Dependency & Invocation Map](#35-complete-system-dependency--invocation-map)
- [36. Runtime Execution Sequences](#36-runtime-execution-sequences)
- [37. Technical Interview Preparation & Defense Guide](#37-technical-interview-preparation--defense-guide)
- [38. Definitive Architectural Q&A Reference](#38-definitive-architectural-qa-reference)
- [39. Source-of-Truth Verification Rules](#39-source-of-truth-verification-rules)
- [40. Document Metadata & Conclusion](#40-document-metadata--conclusion)

---

## List of Figures

| Figure | Title | Primary Section Link |
| :--- | :--- | :--- |
| **Figure 1** | High-Level Multi-Tenant System Architecture and Component Boundaries | [Section 5](#figure-1-high-level-multi-tenant-system-architecture) |
| **Figure 2** | End-to-End Request Lifecycle and Service Orchestration | [Section 6.2](#figure-2-end-to-end-request-lifecycle-and-service-orchestration) |
| **Figure 3** | ML Ingestion, Preprocessing & Inference Pipeline | [Section 13.2](#figure-3-ml-ingestion-preprocessing--inference-pipeline) |
| **Figure 4** | SHAP Explainability & Attribution Architecture | [Section 13.2](#figure-4-shap-explainability--attribution-architecture) |
| **Figure 5** | Hybrid RAG Policy Retrieval Architecture | [Section 15.1](#figure-5-hybrid-rag-policy-retrieval-architecture) |
| **Figure 6** | 8-Node LangGraph Retention Decision Workflow | [Section 16.1](#figure-6-8-node-langgraph-retention-decision-workflow) |
| **Figure 7** | Multi-Tenant Security & Isolation Model | [Section 24](#figure-7-multi-tenant-security--isolation-model) |
| **Figure 8** | Authentication, Token Rotation & Replay Protection | [Section 12.1](#figure-8-authentication-token-rotation--replay-protection) |
| **Figure 9** | Database Schema & Entity-Relationship Architecture | [Section 11.1](#figure-9-database-schema--entity-relationship-architecture) |
| **Figure 10** | Deployment & Infrastructure Topology | [Section 26](#figure-10-deployment--infrastructure-topology) |
| **Figure 11** | Error Handling, Circuit Breakers & Fallback Hierarchy | [Section 23](#figure-11-error-handling-circuit-breakers--fallback-hierarchy) |
| **Figure 12** | Multi-Tier Testing Architecture Matrix | [Section 28.2](#figure-12-multi-tier-testing-architecture-matrix) |

---

## 1. Executive Summary & Project Overview

### 1.1 One-Sentence Explanation
RetentionAI is a multi-tenant enterprise human resources intelligence platform combining calibrated machine learning (Logistic Regression / XGBoost / CatBoost), SHAP explainable AI, transformer-based NLP sentiment analysis, hybrid dense/sparse RAG policy retrieval (SentenceTransformers + BM25 + ChromaDB), and an 8-node LangGraph autonomous decision engine to predict employee attrition risk, explain feature attributions, and synthesize policy-grounded retention interventions.

### 1.2 Interview-Ready Explanation
"RetentionAI is an enterprise SaaS platform engineered to solve employee attrition by bridging predictive machine learning with automated HR decision orchestration. Architecturally, it operates as a multi-tenant system comprising a React 18 SPA frontend, a Node.js/Express REST API gateway, a MongoDB document store, and a FastAPI Python AI/ML microservice. The AI microservice serves calibrated attrition risk models while computing local and global SHAP feature attributions to provide actionable XAI. It incorporates an NLP pipeline for unstructured textual feedback analysis and a hybrid RAG pipeline using SentenceTransformers (`all-MiniLM-L6-v2`), BM25, and ChromaDB for tenant-isolated policy retrieval. Furthermore, an 8-node LangGraph state graph coordinates context validation, risk scoring, XAI extraction, policy matching, LLM reasoning (via Groq Llama 3.1 8B), and decision validation to produce actionable HR interventions with strict SLA, cost, and audit tracking."

### 1.3 Detailed Technical Overview
RetentionAI is built upon a microservice-oriented topology with strict multi-tenant isolation, structured data validation, and asynchronous fault-tolerant startup sequences:
- **Frontend SPA**: Built with React 18, Vite, TailwindCSS, and Redux Toolkit. Features route-based code splitting (`React.lazy`), role-based routing (RBAC across 9 roles), and dynamic visualizations using Recharts and Lucide icons across 28 distinct page views (see [Figure 1](#figure-1-high-level-multi-tenant-system-architecture)).
- **API Gateway / Backend Server**: Node.js/Express application managing JWT authentication (HS256 access tokens + CSPRNG opaque refresh tokens hashed with HMAC-SHA-256), RBAC authorization, input sanitization (`sanitizeInput`), request correlation (`X-Request-Id` and `X-Correlation-ID`), rate limiting, Mongoose ODM database mapping across 45 MongoDB schemas, and HTTP proxying to the Python AI service.
- **AI Microservice**: FastAPI application serving machine learning models, calculating SHAP explanations (`TreeExplainer` and `LinearExplainer`), performing NLP sentiment/emotion classification, executing enterprise hybrid RAG queries using Reciprocal Rank Fusion (RRF), and running an 8-node LangGraph workflow (`AgentState` typed state container).
- **Data & Vector Stores**: MongoDB 7.0 for transactional documents, application state, prediction histories, and audit logs. ChromaDB for vector embeddings of uploaded HR policies. Upstash Redis (optional REST API) for distributed job state tracking and AI concurrency locking.

### 1.4 Operational Modes & Limitations
1. **LITE vs. FULL AI Build Dual-State**: On memory-constrained free-tier hosts (< 512 MB RSS), the AI service runs in a "LITE" mode where heavyweight PyTorch/Transformers/ChromaDB imports are omitted, disabling local NLP and local vector search while maintaining prediction, SHAP, and LLM decision capabilities.
2. **Offline Hugging Face Reliance**: Models rely on pre-cached local weights (`AI_MODELS_OFFLINE=true` / `HF_HUB_OFFLINE=1`) to eliminate HuggingFace network latency and startup blocking.
3. **Single Active Model Bundle**: The prediction service loads one primary active model bundle (`attrition_model.joblib`) from `/app/models/active` at any given time, managed via cryptographic SHA-256 manifests.

---

## 2. Project Goals, Problem Statement & Scope

### 2.1 Motivation & Enterprise Turnover Economics
Unplanned employee turnover costs enterprises $1.5\times$ to $2\times$ an employee's annual salary in lost productivity, recruitment expenses, and institutional knowledge drain. Traditional HR approaches are reactive—intervening only after an employee submits a resignation. Existing predictive solutions function as "black boxes," failing to explain *why* an employee is at risk or provide actionable, policy-compliant steps to retain them.

### 2.2 Core System Objectives
- **Proactive Early Warning**: Compute calibrated attrition probability scores ($[0.0, 1.0]$) for every employee across tenant organizations.
- **Explainable Predictions (XAI)**: Generate local SHAP force values and global feature importances to identify top risk drivers (overtime hours, promotion gap, salary stagnation) with explicit causal disclaimers.
- **Unstructured Signal Extraction**: Analyze employee survey responses and manager feedback using transformer models to extract sentiment, emotion, and burnout indicators.
- **Grounded Policy RAG**: Query internal HR policy documents with dense/sparse hybrid search and guaranteed groundedness (no LLM generation when relevance $< 0.15$).
- **Autonomous Strategy Orchestration**: Execute an 8-node LangGraph agent graph to synthesize personalized, policy-aligned retention recommendations complete with estimated costs, recommended roles, and SLA targets.
- **Strict Multi-Tenant Isolation**: Enforce tenant boundaries (`organizationId`) at database, API, vector store, and LLM context levels.

### 2.3 Out of Scope (Explicit Non-Goals)
- Automatic execution of financial changes (e.g., payroll modifications or automated direct-deposit adjustments).
- Direct bidirectional synchronization with legacy third-party HRIS APIs (handled via standardized CSV/JSON bulk import endpoints).
- Unfiltered open-domain LLM chatting without grounded HR context.
- Unmonitored automated terminations or punitive employee actions.

---

## 3. Verified Technology Stack

| Category | Technology | Verified Version | Role / Purpose | File Location |
| :--- | :--- | :--- | :--- | :--- |
| **Language** | JavaScript (ESM) | Node 18+ / 20+ | Express Gateway & React SPA | `server/src/`, `client/src/` |
| **Language** | Python | 3.10+ / 3.11 | AI/ML, NLP, RAG & LangGraph Service | `ai-service/app/` |
| **Frontend Framework** | React | ^18.2.0 | UI component hierarchy & SPA state | `client/src/` |
| **Build Tool** | Vite | ^5.0.0 | Module bundling, HMR, code-splitting | `client/vite.config.js` |
| **State Management** | Redux Toolkit | ^2.0.1 | Global state (auth, notifications, dashboard) | `client/src/store/` |
| **Styling** | TailwindCSS | ^3.4.0 | Utility-first responsive CSS design system | `client/tailwind.config.js` |
| **Visualizations** | Recharts / Lucide | ^2.10 / ^0.300 | 21 charts (Bar, Line, Pie, Area) & icons | `client/src/components/`, `pages/` |
| **Backend Framework** | Express.js | ^4.21.2 | HTTP API server & request routing | `server/src/app.js` |
| **ODM / DB Driver** | Mongoose | ^8.9.3 | MongoDB document modeling & queries | `server/src/models/` |
| **Async Python DB** | Motor / PyMongo | ^3.3.0 | Async Python MongoDB driver | `ai-service/app/utils/database.py` |
| **AI Framework** | FastAPI | ^0.104.0 | Python web framework for ML microservice | `ai-service/app/main.py` |
| **Machine Learning** | Scikit-Learn / XGBoost / CatBoost | ^1.3 / ^2.0 / ^1.2 | Attrition prediction, preprocessing & calibration | `ai-service/app/training/`, `prediction/` |
| **XAI Engine** | SHAP | ^0.43.0 | Local/global feature attributions | `ai-service/app/explainability/` |
| **NLP Stack** | HuggingFace Transformers / PyTorch | ^4.35 / ^2.1 | Emotion classification & zero-shot sentiment | `ai-service/app/nlp/` |
| **Vector DB** | ChromaDB | ^0.4.18 | Local embeddings vector storage for RAG | `ai-service/app/rag/vectorstore/` |
| **Dense Embeddings** | SentenceTransformers | `all-MiniLM-L6-v2` | Dense semantic text vectorization (384 dims) | `ai-service/app/rag/embeddings/` |
| **Sparse Retrieval** | rank_bm25 | ^0.2.2 | BM25 sparse lexical retrieval | `ai-service/app/rag/services/rag_service.py` |
| **Agent Framework** | LangGraph / LangChain | ^0.0.10 / ^0.1.0 | 8-node stateful workflow execution | `ai-service/app/agent/` |
| **LLM Provider** | Groq API | Llama-3.1-8b-instant | High-speed LLM reasoning for agent & RAG | `ai-service/app/rag/chains/`, `agent/` |
| **Primary Database** | MongoDB | 7.0 | Document store for users, orgs, predictions, logs | Container `retentionai-mongo` |
| **Cache / Job Store** | Upstash Redis | REST API | Distributed job store & concurrency lock | `server/src/utils/redisClient.js` |
| **Backend Testing** | Node Native Runner / Supertest | Node 20+ / ^7.2.2 | In-memory REST API contracts, IDOR & unit tests | `server/tests/` |
| **Test DB Isolation** | mongodb-memory-server | ^11.2.0 | Ephemeral in-memory MongoDB for tests | `server/tests/` |
| **Python Testing** | PyTest / pytest-cov / HTTPX | ^9.1.1 / ^7.1.0 | ML inference, SHAP, RAG & agent tests | `ai-service/tests/` |
| **Frontend Testing** | Vitest / RTL | ^5.0.4 / ^16.0 | Unit & component tests for login & routes | `client/src/tests/` |
| **CI/CD Pipeline** | GitHub Actions | YAML Workflow | Multi-job parallel PR/push test & build pipeline | `.github/workflows/ci.yml` |
| **Containerization** | Docker / Docker Compose | Multi-stage | Multi-container environment orchestrator | `Dockerfile`, `docker-compose.yml` |

---

## 4. Complete Repository Structure & File Map

```
RetentionAI/
├── .github/
│   └── workflows/
│       └── ci.yml                     # 3-job parallel CI workflow (Backend, AI, Frontend)
├── .env.example                       # Root environment template for docker-compose
├── Dockerfile                         # Root multi-stage build reference
├── render.yaml                        # Render Blueprint deployment specification
├── docker-compose.yml                 # Local dev container orchestration (mongo, server, ai-service, client)
├── docker-compose.prod.yml            # Production container deployment config
├── CHANGELOG.md                       # Release notes & version milestones
├── CONTRIBUTING.md                    # Developer contribution guidelines
├── DISASTER_RECOVERY.md               # Incident response & backup runbook
├── README.md                          # Primary project documentation
├── resume_metrics.md                  # Reconciled performance & benchmark verification metrics
├── ai-service/                        # Python FastAPI AI Microservice (59 API Endpoints)
│   ├── Dockerfile                     # Python 3.10 slim deployment container
│   ├── requirements.txt               # Full ML dependency set (torch, transformers, chromadb)
│   ├── requirements-lite.txt          # Memory-optimized lite dependency set
│   ├── train_model.py                 # CLI model training & evaluation script
│   ├── seed_ml_data.py                # Synthetic dataset generator & DB seeder
│   ├── tests/                         # 17 PyTest test suites (167 passed, 100% pass rate)
│   │   ├── test_agent.py              # LangGraph decision agent workflows & endpoints
│   │   ├── test_agent_graph.py        # LangGraph StateGraph edge compilation
│   │   ├── test_decision_engine.py    # Rule-based decision fallback engine
│   │   ├── test_drift_monitoring.py   # PSI & Kolmogorov-Smirnov drift calculations
│   │   ├── test_drift_rigor.py        # Data quality checks & distribution shifts
│   │   ├── test_experiment_tracker.py # Durable local experiment lineage tracking
│   │   ├── test_experimentation.py    # Two-proportion z-test & sample-size planning
│   │   ├── test_explainability.py     # Local waterfall decomposition & global importance (41 tests)
│   │   ├── test_inference_observability.py # Latency logging & HMAC-SHA256 pseudonymization
│   │   ├── test_lite_build.py         # Graceful fallback under LITE build capability
│   │   ├── test_ml.py                 # Classification pipelines, metrics & baselines
│   │   ├── test_ml_pipeline_leakage.py# Stratified split & median imputation isolation (9 tests)
│   │   ├── test_model_registry.py     # Cryptographic SHA-256 manifest verification
│   │   ├── test_nlp.py                # Sentiment analysis & emotion classification
│   │   ├── test_rag.py                # Dense + sparse vector retrieval & RRF fusion
│   │   ├── test_rag_groundedness.py   # Relevance threshold (0.15) & empty index fallbacks
│   │   └── test_test_set_isolation.py # Strict holdout test partition isolation
│   └── app/
│       ├── main.py                    # FastAPI entrypoint, lifespan manager & base routes
│       ├── config.py                  # Pydantic startup configuration validation
│       ├── features.py                # Capability probing (NLP_AVAILABLE, RAG_AVAILABLE)
│       ├── agent/                     # LangGraph Retention Agent Engine
│       │   ├── agent_state.py         # AgentState TypedDict definition
│       │   ├── retention_graph.py     # 8-node graph compilation & singleton instance
│       │   ├── nodes.py               # 8 sequential agent node implementations
│       │   └── tools/                 # Tool wrappers (ml_tool, shap_tool, nlp_tool, rag_tool)
│       ├── api/                       # 10 FastAPI router modules
│       │   ├── agent_routes.py        # /api/v1/agent/retention-decision
│       │   ├── decision_routes.py     # /api/v1/decision/recommend, /history, /dashboard
│       │   ├── employee_intelligence_routes.py # /api/v1/intelligence/profile/:id
│       │   ├── experiment_routes.py   # /api/v1/experiments/power, /evaluate
│       │   ├── explain_routes.py      # /api/v1/explain/local, /global, /batch
│       │   ├── monitoring_routes.py   # /api/v1/monitoring/drift, /telemetry
│       │   ├── nlp_routes.py          # /api/v1/nlp/analyze, /feedback, /burnout
│       │   ├── rag_routes.py          # /api/v1/rag/query, /index, /search, /documents
│       │   ├── registry_routes.py     # /api/v1/registry/models, /promote
│       │   └── routes.py              # /api/v1/predict, /api/v1/predict/batch
│       ├── decision/                  # Rule-based decision heuristics & schemas
│       ├── explainability/            # SHAP cache, local waterfall & global explainer
│       ├── nlp/                       # Emotion/sentiment analyzer & transformers
│       ├── prediction/                # PredictionService, inference logger & drift
│       ├── preprocessing/             # Feature transformation pipeline (28 features)
│       ├── rag/                       # Chunkers, loaders, ChromaDB vectorstore & RRF service
│       ├── training/                  # Model trainer, hyperparameter tuner & benchmark
│       └── utils/                     # Database connection, logging, metrics, migrations
├── server/                            # Node.js / Express Backend Gateway (197 API Endpoints)
│   ├── Dockerfile                     # Node 18 Alpine production container
│   ├── package.json                   # Express server dependencies & test scripts
│   ├── tests/                         # 35 test files (Unit, Supertest Contracts, IDOR)
│   │   ├── apiContracts.supertest.test.js # REST contracts, tenant IDOR isolation, health
│   │   ├── error-handler.test.js      # AppError, 11000 duplicate key, Zod & 500 suppression
│   │   ├── jwt.test.js                # JWT claims, verification, tampered token rejection
│   │   ├── rbac.test.js               # Role permissions, wildcards & 403 Forbidden
│   │   ├── password-policy.test.js    # Password complexity and validation rules
│   │   ├── validation.test.js         # Zod schemas for auth, reset & registration
│   │   ├── rate-limit.test.js         # Express rate limiter & in-memory fallback
│   │   ├── cors-origins.test.js       # Dynamic origin matcher & wildcard rejection
│   │   ├── token-utils.test.js        # High-entropy token generation & crypto hashing
│   │   ├── aiGovernance.integration.test.js # HITL review, bias audit, red-team evals
│   │   └── tenant-isolation-idor.integration.test.js # Cross-organization data isolation
│   └── src/
│       ├── app.js                     # Express app setup, middleware pipeline & router bindings
│       ├── server.js                  # Server listener & database connection logic
│       ├── config/                    # Zod env schema, CORS, tenancy & roles (9 roles)
│       ├── controllers/               # 32 HTTP controllers handling business API requests
│       ├── middlewares/               # Authenticate, authorize, rateLimits, upload, sanitize
│       ├── models/                    # 45 Mongoose schemas (User, Employee, Prediction, etc.)
│       ├── repositories/              # Database data access abstraction layer
│       ├── routes/                    # 31 Express router definitions (/api/v1/*)
│       ├── services/                  # Business services (AI proxy, auth, interventions)
│       └── utils/                     # JWT tokens, HMAC hashing, metrics, logger
├── client/                            # React 18 / Vite Frontend Single Page App (28 Views)
│   ├── Dockerfile                     # Nginx static asset serving container
│   ├── nginx.conf                     # Production Nginx reverse proxy config
│   ├── package.json                   # React, Vite, Redux, Vitest & RTL dependencies
│   ├── vite.config.js                 # Vite build configuration, proxy & Vitest jsdom setup
│   └── src/
│       ├── App.jsx                    # Root Router, code-splitting & layout routes
│       ├── main.jsx                   # Entrypoint rendering React DOM with Redux Provider
│       ├── components/                # Reusable UI components (Modals, Nav, Sidebar, Charts)
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
├── docs/                              # Architecture guides, SRS, SDD, testing reports
│   ├── Load-Testing-Report.md         # Autocannon 50/100/150 connection benchmark findings
│   ├── TESTING.md                     # Comprehensive testing guide & inventory
│   └── TESTING_AUDIT.md               # Audit findings & remediation plan
├── models/                            # Active & archived joblib ML model binaries
│   └── active/
│       ├── attrition_model.joblib     # Production champion ML model bundle
│       └── manifest.json              # Cryptographic model metadata & metrics report
├── scripts/                           # Database check, backup, and restore shell scripts
└── tests/                             # Root end-to-end and integration test suites
```

---

## 5. System Architecture

RetentionAI implements a layered API Gateway + Specialized Microservice topology. All incoming traffic from browser clients terminates at Nginx (in production) or the Node.js Express Gateway. The Gateway handles identity, authorization, tenant context validation, and database persistence in MongoDB, proxying specialized ML/XAI/RAG/Agent requests to the Python FastAPI microservice over internal HTTP.

#### Figure 1: High-Level Multi-Tenant System Architecture
```mermaid
graph TB
    subgraph ClientTier ["Client Tier (Browser)"]
        SPA["React 18 SPA (Vite + TailwindCSS + Redux Toolkit)"]
        UI_ROUTER["React Router v6 (Lazy Suspense across 28 Pages)"]
        SPA --> UI_ROUTER
    end

    subgraph GatewayTier ["Backend API Gateway (Node.js / Express)"]
        REVERSE_PROXY["Nginx Reverse Proxy / Vite Dev Proxy"]
        EXPRESS["Express.js Server (Port 5000)"]
        MW_AUTH["Auth Middleware (JWT HS256 + HMAC-SHA256 Refresh)"]
        MW_TENANT["Tenant Enforcer (req.auth.organizationId)"]
        MW_RATE["Rate Limiter (express-rate-limit)"]
        ROUTERS["31 Router Modules (197 Endpoints)"]
        CONTROLLERS["32 Business Controllers"]
        MONGOOSE["Mongoose ODM Layer (45 Collections)"]

        REVERSE_PROXY --> EXPRESS
        EXPRESS --> MW_RATE --> MW_AUTH --> MW_TENANT --> ROUTERS --> CONTROLLERS --> MONGOOSE
    end

    subgraph AITier ["AI / ML Microservice (FastAPI / Python 3.10)"]
        FASTAPI["FastAPI Uvicorn Application (Port 8000)"]
        API_ROUTERS["10 API Routers (59 Endpoints)"]
        PRED_SRV["PredictionService (Calibrated Logistic Regression v2.0)"]
        SHAP_SRV["ShapExplainerCache (Tree / Linear Explainer)"]
        NLP_SRV["NLP Analyzer (Transformers Emotion / Sentiment)"]
        RAG_SRV["Hybrid RAG Service (Dense MiniLM + Sparse BM25 + RRF)"]
        AGENT_SRV["LangGraph 8-Node StateGraph Decision Engine"]

        FASTAPI --> API_ROUTERS
        API_ROUTERS --> PRED_SRV
        API_ROUTERS --> SHAP_SRV
        API_ROUTERS --> NLP_SRV
        API_ROUTERS --> RAG_SRV
        API_ROUTERS --> AGENT_SRV
    end

    subgraph DataTier ["Data & Persistence Tier"]
        MONGODB[("MongoDB 7.0 Cluster\n(Transactional Documents & Predictions)")]
        CHROMADB[("ChromaDB Vector Store\n(Tenant-Isolated HR Policies)")]
        REDIS[("Upstash Redis (Optional)\n(Job Tracking & Rate Limit Cache)")]
    end

    subgraph ExternalTier ["External AI & Cloud Services"]
        GROQ["Groq Cloud LLM API\n(Llama 3.1 / 3.3 Instant)"]
    end

    ClientTier -->|HTTP / REST JSON| GatewayTier
    CONTROLLERS -->|HTTP Internal Proxy (AI_SERVICE_TOKEN)| FASTAPI
    MONGOOSE -->|Mongoose Driver| MONGODB
    AITier -->|Motor Async Driver| MONGODB
    RAG_SRV -->|Vector Similarity Queries| CHROMADB
    AGENT_SRV -->|Grounded Reasoning Prompts| GROQ
    RAG_SRV -->|Policy Synthesis Prompts| GROQ
    EXPRESS -.->|Optional Cache / Locks| REDIS
```
*Figure 1: High-Level Multi-Tenant System Architecture and Component Boundaries.*

**Architectural Rationale & Flow Explanation (Figure 1):**
1. **Client Isolation**: The browser client interacts solely with the Gateway Tier via standard HTTP REST requests. Client code never directly contacts the Python microservice or database engines, preserving perimeter security.
2. **Gateway Responsibilities**: The Node.js Express Gateway operates as the security and routing hub. It authenticates users, verifies role permissions across 9 distinct roles, enforces tenant isolation, sanitizes input payloads, and coordinates transactions across 45 MongoDB collections.
3. **AI Microservice Delegation**: When complex mathematical or machine learning workloads are requested (e.g., attrition prediction, SHAP attribution calculation, hybrid policy retrieval, or LangGraph agent synthesis), the Gateway acts as a reverse proxy, delegating to FastAPI via an authenticated HTTP header (`AI_SERVICE_TOKEN`).
4. **Data Isolation**: MongoDB serves as the single source of truth for all structured data, accessed synchronously by Node and asynchronously by Python via Motor. ChromaDB runs locally on the AI container filesystem, isolating document embeddings with tenant metadata tags.

---

## 6. End-to-End System Workflow & Request Lifecycle

### 6.1 Application Startup & Concurrent Background Warmup
- **Node Server Startup (`server/src/server.js`)**:
  1. Loads environment variables and validates types using Zod schema (`server/src/config/env.js`).
  2. Establishes Mongoose connection to MongoDB with connection pooling (`maxPoolSize: 20`).
  3. Registers middleware pipeline: `requestId`, `correlationIdMiddleware`, `metricsMiddleware`, `requestLoggingMiddleware`, Helmet security headers, CORS origin matcher, compression, JSON body parser, and `sanitizeInput`.
  4. Mounts 31 Express route modules under `/api/v1/*` and exposes `/health` and `/health/deep`.
  5. Starts HTTP server on port 5000.
- **FastAPI Microservice Startup (`ai-service/app/main.py`)**:
  1. Checks `AI_MODELS_OFFLINE`. When true, sets `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` to guarantee local-only loading.
  2. Validates settings using Pydantic `BaseSettings` (`ai-service/app/config.py`).
  3. Connects to MongoDB via Motor async driver.
  4. Runs database collection migration check (`migrate_prediction_history_collection`).
  5. Offloads heavy model loads to concurrent background threads via `asyncio.to_thread` with 60s timeouts:
     - Thread 1: Loads champion Joblib model bundle (`attrition_model.joblib`) and warms `ShapExplainerCache`.
     - Thread 2: Loads Hugging Face emotion and sentiment transformer pipelines (if `NLP_AVAILABLE`).
     - Thread 3: Initializes ChromaDB vector store and preloads `all-MiniLM-L6-v2` embedding weights (if `RAG_AVAILABLE`).
  6. Mounts 10 router modules under `/api/v1/*` and binds Uvicorn listener on port 8000.

### 6.2 Complete Request Lifecycle & Middleware Pipeline
Every client request traverses a structured, audited pipeline from client click to database persistence:

#### Figure 2: End-to-End Request Lifecycle and Service Orchestration
```mermaid
sequenceDiagram
    autonumber
    actor User as HR Specialist (Client Browser)
    participant Client as React 18 SPA (Axios)
    participant Gateway as Express Gateway (Port 5000)
    participant Auth as Auth & Tenancy Middleware
    participant Controller as Express Controller
    participant FastAPI as FastAPI AI Service (Port 8000)
    participant Mongo as MongoDB 7.0 Cluster
    participant Chroma as ChromaDB Vector Store
    participant Groq as Groq LLM API

    User->>Client: Click "Generate Retention Strategy"
    Client->>Client: Attach JWT Access Token to Bearer Header
    Client->>Gateway: POST /api/v1/decisions/recommend { employeeId }
    Gateway->>Gateway: Assign X-Request-ID & Correlation ID
    Gateway->>Auth: Validate JWT Signature (HS256) & Expiration
    Auth->>Mongo: Lookup User & verify status == ACTIVE
    Mongo-->>Auth: User record & OrganizationId
    Auth->>Auth: Check RBAC Permission ('intervention.write')
    Auth-->>Gateway: Bind req.auth = { userId, role, organizationId }
    Gateway->>Controller: Forward to DecisionController
    Controller->>FastAPI: POST /api/v1/agent/retention-decision (Bearer AI_SERVICE_TOKEN)
    FastAPI->>FastAPI: Validate tenant ownership (emp.organizationId == req.orgId)
    FastAPI->>Mongo: Fetch employee history, performance, attendance
    Mongo-->>FastAPI: Employee 360 profile
    FastAPI->>FastAPI: Compute calibrated risk score & SHAP drivers
    FastAPI->>Chroma: Query tenant policy documents (hybrid dense + BM25)
    Chroma-->>FastAPI: Grounded policy chunks (Relevance >= 0.15)
    FastAPI->>Groq: Generate strategy prompt with strict schema
    Groq-->>FastAPI: Structured retention intervention plan
    FastAPI->>Mongo: Persist decision & execution audit trace
    FastAPI-->>Controller: Return structured JSON recommendation
    Controller->>Mongo: Log action to AuditLog collection
    Controller-->>Client: HTTP 200 OK with recommendation payload
    Client-->>User: Render strategy card with costs, SLA & citations
```
*Figure 2: End-to-End Request Lifecycle and Service Orchestration.*

**Lifecycle Step Breakdown (Figure 2):**
1. **Client Dispatch**: The user triggers an action in the React UI. Axios intercepts the outgoing request, injecting the stored JWT bearer token into the `Authorization` header.
2. **Edge Processing**: The Express server assigns a unique `X-Request-Id` and `X-Correlation-Id` for tracing across microservices.
3. **Authentication & Authorization**: The `authenticate` middleware verifies the token signature and expiration, queries the database to confirm the user account is active, and binds the tenant context (`req.auth.organizationId`). The `authorize` middleware ensures the user's role possesses the required permission.
4. **Service Proxying**: The Express controller validates parameters via Zod, checks rate limits, and proxies the request to the FastAPI AI microservice with the internal `AI_SERVICE_TOKEN`.
5. **AI Microservice Execution**: FastAPI verifies tenant ownership, computes or retrieves predictions and SHAP drivers, queries ChromaDB for company policies, invokes Groq LLM, and persists results.
6. **Audited Response**: The response returns to Node.js, which creates an immutable record in `AuditLog` and sends a structured JSON payload back to the React client.

---

## 7. Feature-by-Feature Technical Breakdown

### 7.1 Predictive Workforce Attrition Modeling
- **Purpose**: Calculate empirical probability of voluntary employee attrition ($[0.0, 1.0]$) and categorize risk into actionable tiers (`LOW`, `MEDIUM`, `HIGH`).
- **Implementation**: Located in `ai-service/app/prediction/prediction_service.py`. The service processes 28 multimodal features (23 numerical, 5 categorical) through a leakage-safe pipeline, executes inference via the champion model, applies isotonic calibration, and evaluates against an optimized decision threshold of $0.15$.
- **Database Persistence**: Writes the current prediction to the `predictions` collection and appends an immutable historical record to `predictionhistories` with native BSON `ObjectId`s.
- **Cross-Reference**: Detailed in [Section 13.2](#132-model-benchmarking-calibration--threshold-optimization) and [Figure 3](#figure-3-ml-ingestion-preprocessing--inference-pipeline).

### 7.2 Explainable AI (SHAP XAI) & Causal Boundaries
- **Purpose**: Decompose complex model predictions into quantifiable feature contributions, transforming black-box scores into actionable HR levers.
- **Implementation**: Located in `ai-service/app/explainability/shap_explainer.py`, `local_explainer.py`, and `global_explainer.py`. Manages a singleton `ShapExplainerCache` that holds a fitted `LinearExplainer` (for Logistic Regression) or `TreeExplainer` (for tree ensembles). Generates local waterfall plots and global feature rankings.
- **Causal Safety Disclaimer**: To prevent HR managers from treating statistical associations as causal guarantees, every explanation response includes a mandatory governance disclaimer: *"Statistical association, not confirmed causation."*
- **Cross-Reference**: Detailed in [Section 13.2](#132-model-benchmarking-calibration--threshold-optimization) and [Figure 4](#figure-4-shap-explainability--attribution-architecture).

### 7.3 Unstructured Employee Feedback NLP Analysis
- **Purpose**: Analyze qualitative employee sentiment, exit interview notes, and pulse survey comments to extract early turnover warnings before quantitative metrics shift.
- **Implementation**: Located in `ai-service/app/nlp/analyzer.py`. Uses Hugging Face Transformer pipelines to perform zero-shot classification and emotion detection. Computes continuous burnout risk scores, manager conflict indicators, and promotion frustration signals.
- **LITE Build Degradation**: When memory limits require running in `LITE` mode, the module gracefully degrades to keyword lexicon scoring, preventing out-of-memory crashes.

### 7.4 Enterprise Knowledge RAG Policy Retrieval
- **Purpose**: Ground HR recommendations in actual company policy (benefits, leave allowances, compensation bands) to prevent unlawful or non-compliant intervention proposals.
- **Implementation**: Located in `ai-service/app/rag/services/rag_service.py`. Implements hybrid search combining dense semantic embeddings (`all-MiniLM-L6-v2`, 384 dims) with sparse lexical search (BM25), merged via Reciprocal Rank Fusion (RRF).
- **Hard Groundedness Gate**: If no retrieved chunks exceed the minimum relevance threshold ($0.15$), the LLM is never invoked, returning a deterministic fallback: *"No relevant company policy found for this query."*
- **Cross-Reference**: Detailed in [Section 15.1](#151-dense-embeddings-bm25-lexical-ranking--reciprocal-rank-fusion) and [Figure 5](#figure-5-hybrid-rag-policy-retrieval-architecture).

### 7.5 LangGraph Autonomous Retention Decision Engine
- **Purpose**: Coordinate predictive scores, SHAP explanations, employee context, and HR policy into a cohesive, structured intervention strategy.
- **Implementation**: Located in `ai-service/app/agent/retention_graph.py` and `nodes.py`. Executes an 8-node sequential LangGraph state machine (`AgentState`) terminating in a validated intervention plan complete with estimated implementation costs, designated owner roles, and SLA targets.
- **Cross-Reference**: Detailed in [Section 16.1](#161-graph-topology-agentstate--node-contracts) and [Figure 6](#figure-6-8-node-langgraph-retention-decision-workflow).

### 7.6 Executive Workforce Intelligence Center & Governance
- **Purpose**: Provide C-suite leaders and compliance officers with aggregate turnover metrics, flight risk exposure, model fairness audits, and human-in-the-loop (HITL) review queues.
- **Implementation**: Express controllers (`executiveController.js`, `governanceController.js`) aggregate data across departments, tracking demographic parity, disparate impact ratios, and red-team test results.

---

## 8. Frontend Architecture & User Interface

### 8.1 React 18 SPA Architecture & Redux Store
The frontend is a single-page application built with React 18 and Vite. It utilizes Redux Toolkit for centralized state management across four core feature slices:
- `authSlice`: Handles user credentials, JWT access tokens, active tenant ID, and authentication status.
- `dashboardSlice`: Stores aggregated metrics, department risk distributions, and recent alerts.
- `employeeSlice`: Manages paginated employee lists, filter state, and active employee profiles.
- `notificationSlice`: Coordinates real-time notifications, task assignments, and system banners.

Axios API clients (`client/src/services/api.js`) attach JWT tokens to outgoing requests and implement automatic token refresh handling on 401 responses. Code splitting via `React.lazy()` and `Suspense` optimizes initial bundle size, achieving a verified 59% payload reduction.

### 8.2 Verified Page Inventory (28 Views)
The frontend contains 28 verified page views in `client/src/pages/`:
1. `AiAnalytics.jsx` — High-level AI model performance, confusion matrices, and drift monitoring.
2. `AiGovernancePage.jsx` — Fairness audits, demographic parity metrics, and HITL review queues.
3. `AiObservabilityPage.jsx` — Latency tracking, agent trace logs, and telemetry exports.
4. `AttendancePage.jsx` — Employee attendance tracking, leave frequency, and absenteeism patterns.
5. `AuditLogPage.jsx` — Immutable administrative and security audit event logs.
6. `CustomerOpsCenter.jsx` — Customer support, operational queue management, and ticket resolution.
7. `Dashboard.jsx` — Primary operational dashboard with quick stats and high-risk employee tables.
8. `DepartmentAnalytics.jsx` — Department-level retention metrics, headcount trends, and budget impact.
9. `Departments.jsx` — Department listing, manager assignments, and operational parameters.
10. `EmployeeProfile.jsx` — 360° employee view, risk score gauge, SHAP waterfall plot, and timeline.
11. `Employees.jsx` — Paginated directory of all organization employees with filters.
12. `EmployeeVoicePage.jsx` — NLP sentiment trends, pulse survey results, and burnout heatmaps.
13. `ExecutiveDashboard.jsx` — C-suite strategic overview, financial risk exposure, and turnover forecast.
14. `ForgotPassword.jsx` — Self-service password recovery request form.
15. `Home.jsx` — Landing and redirect portal based on authentication state.
16. `HrOperationsDashboard.jsx` — Daily HR task management, intervention tracking, and approvals.
17. `InterventionsPage.jsx` — Active retention interventions, workflow statuses, and SLA timers.
18. `KnowledgeManagement.jsx` — HR policy document upload, indexing status, and vector query playground.
19. `Login.jsx` — Secure user authentication view with demo credential selectors.
20. `ManagerDashboard.jsx` — Direct manager view for team flight risks and performance notes.
21. `NotFound.jsx` — Standardized 404 error page with route recovery options.
22. `PerformancePage.jsx` — Performance review history, rating distributions, and promotion gap tracking.
23. `PromotionsPage.jsx` — Historical promotion logs, career velocity analysis, and stagnation alerts.
24. `ReportsPage.jsx` — Exportable executive and operational turnover reports (CSV/PDF).
25. `ResetPassword.jsx` — Password reset form requiring cryptographically signed recovery tokens.
26. `Signup.jsx` — Tenant registration and initial administrator onboarding.
27. `TasksPage.jsx` — User-assigned intervention follow-ups and operational action items.
28. `TrainingPage.jsx` — Professional development tracking and training completion metrics.

---

## 9. Backend Gateway Architecture (Node.js / Express)

### 9.1 Middleware Execution Order
Express executes middleware sequentially for every incoming request:
1. `requestId`: Generates a unique UUIDv4 identifier attached as `req.id` and header `X-Request-Id`.
2. `correlationIdMiddleware`: Extracts or creates `X-Correlation-ID` for cross-service tracing.
3. `metricsMiddleware`: Tracks endpoint latency, request counts, and status code distributions.
4. `requestLoggingMiddleware`: Emits structured Winston log entries for incoming HTTP traffic.
5. `helmet`: Configures HTTP security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options).
6. `cors`: Matches origins dynamically using `createOriginMatcher` against configured allowlists.
7. `compression`: Compresses response payloads using Gzip / Deflate.
8. `express.json`: Parses incoming JSON request bodies with size limits (10MB).
9. `sanitizeInput`: Recursively strips MongoDB query injection operators (`$where`, `$gt`, `$regex`) from request bodies and query strings.
10. `routes`: Evaluates route definitions across 31 router modules.
11. `enforceActiveOrganization`: Validates tenant account status (`ACTIVE` vs `SUSPENDED`).
12. `notFoundHandler`: Catches unmatched routes, returning structured 404 responses.
13. `errorHandler`: Global error normalization middleware catching `AppError`, Zod errors, and MongoDB exceptions (see [Figure 11](#figure-11-error-handling-circuit-breakers--fallback-hierarchy)).

### 9.2 Role-Based Access Control (RBAC) Matrix (9 Roles)
RetentionAI implements granular RBAC defined in `server/src/config/roles.js`. Verified source code confirms **9 distinct roles**:

| Role Name | Scope & Authority | Verified Permissions |
| :--- | :--- | :--- |
| **`ADMIN`** | Organization superuser; full administrative control | `['*']` (Wildcard root access) |
| **`HR_MANAGER`** | Operational HR leader; employee CRUD & interventions | `employee.read`, `prediction.read`, `intervention.write`, `task.write`, `approval.decide`, `attachment.write`, `audit.read`, plus base workflow permissions |
| **`HR_ANALYST`** | Analytics specialist; read-only data & reporting | `employee.read`, `prediction.read`, plus base workflow permissions |
| **`DEPARTMENT_MANAGER`** | Team leader; team monitoring & intervention proposals | `employee.read`, `intervention.write`, `task.write`, `attachment.write`, plus base workflow permissions |
| **`EMPLOYEE`** | Individual contributor; self-service profile access | `profile.read`, `profile.write`, `comment.write`, `notification.read`, `task.read` |
| **`HR_DIRECTOR`** | Executive HR strategist; approvals & automations | `employee.read`, `prediction.read`, `executive.read`, `executive.write`, `task.write`, `intervention.write`, `approval.decide`, `attachment.write`, `audit.read`, `automation.admin`, plus base workflow permissions |
| **`CHRO`** | Chief Human Resources Officer; strategic approvals | `employee.read`, `prediction.read`, `executive.read`, `executive.write`, `intervention.write`, `approval.decide`, `audit.read`, plus base workflow permissions |
| **`CEO`** | Chief Executive Officer; high-level executive view | `executive.read`, plus base workflow permissions |
| **`COMPLIANCE_OFFICER`** | AI Safety & Compliance Officer; fairness audits | `governance.read`, `governance.write`, `bias.read`, `bias.write`, `hitl.decide`, `audit.read`, plus base workflow permissions |

*Base Workflow Permissions (`WORKFLOW_BASE`)*: `task.read`, `intervention.read`, `comment.write`, `notification.read`, `search.read`.

---

## 10. Verified API Endpoint Inventory (256 Endpoints)

Across the Node.js Express Gateway and the Python FastAPI AI Microservice, the repository contains **256 verified API route registrations**:

### 10.1 Express Backend Gateway Routes (197 Endpoints across 31 Files)
- `aiRoutes.js` (8 endpoints): `/train`, `/predict/batch`, `/predict/:id`, `/model/info`, `/model/metrics`, `/dashboard`, `/employee-decision`.
- `analyticsRoutes.js` (13 endpoints): Turnover trends, risk distribution, department rollups, flight risks.
- `approvalRoutes.js` (2 endpoints): Approval submission and decision history.
- `attachmentRoutes.js` (3 endpoints): File upload, download, and deletion.
- `auditRoutes.js` (3 endpoints): Audit trail query, export, and resource history.
- `authRoutes.js` (7 endpoints): `/login`, `/register`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/me`.
- `automationRoutes.js` (2 endpoints): Workflow trigger configurations and execution logs.
- `billingRoutes.js` (8 endpoints): Plan catalogs, subscription management, invoices, webhooks, reconciliation.
- `commentRoutes.js` (3 endpoints): Intervention comment creation, listing, and moderation.
- `decisionRoutes.js` (7 endpoints): AI recommendations, approval gates, and history.
- `departmentRoutes.js` (8 endpoints): Department CRUD, manager assignment, and metrics.
- `employeeIntelligenceRoutes.js` (4 endpoints): 360° intelligence profiles and NLP insights.
- `employeeRoutes.js` (18 endpoints): Employee CRUD, soft-delete, bulk CSV import, profile picture upload.
- `executiveRoutes.js` (12 endpoints): Executive summaries, risk forecasts, cost simulations, escalation queues.
- `explainRoutes.js` (5 endpoints): Local SHAP, global feature importance, batch explanations.
- `governanceRoutes.js` (9 endpoints): Guardrail logs, bias audits, policy updates, HITL queues, red-team evaluations.
- `healthRoutes.js` (3 endpoints): Liveness check (`/health`), deep health (`/health/deep`), readiness.
- `hrRoutes.js` (6 endpoints): Generic HR sub-collection operations (attendance, performance, surveys).
- `importRoutes.js` (4 endpoints): Asynchronous CSV import job tracking and template downloads.
- `interventionRoutes.js` (11 endpoints): Retention workflow CRUD, status transitions, SLA monitoring.
- `invitationRoutes.js` (4 endpoints): Tenant user invitations, validation, and acceptance.
- `knowledgeRoutes.js` (10 endpoints): HR policy document upload, indexing, search, and deletion.
- `notificationRoutes.js` (7 endpoints): User notification inbox, preferences, read states.
- `observabilityRoutes.js` (8 endpoints): Telemetry stats, drift metrics, agent trace logs, evaluation benchmarks, model registry views.
- `organizationRoutes.js` (8 endpoints): Tenant profile management, subscription updates, settings.
- `reportingRoutes.js` (6 endpoints): Scheduled and ad-hoc report exports (CSV, PDF, DOCX).
- `searchRoutes.js` (1 endpoint): Global federated search across employees, interventions, and policies.
- `taskRoutes.js` (9 endpoints): Operational tasks, due dates, assignments, status updates.
- `usageRoutes.js` (1 endpoint): Tenant resource and API usage metrics.
- `userRoutes.js` (6 endpoints): User account administration, role assignment, password updates.
- `workflowRoutes.js` (1 endpoint): Workflow automation engine statistics.

### 10.2 FastAPI AI Microservice Routes (59 Endpoints across 11 Files)
- `agent_routes.py` (1 endpoint): `POST /api/v1/agent/retention-decision` (LangGraph 8-node execution).
- `decision_routes.py` (6 endpoints): `/decision/recommend`, `/decision/batch`, `/decision/history`, `/decision/dashboard`, `/decision/rule-based`.
- `employee_intelligence_routes.py` (6 endpoints): Comprehensive NLP + ML intelligence profile endpoints.
- `experiment_routes.py` (4 endpoints): A/B testing power analysis, two-proportion z-tests, ROI estimations.
- `explain_routes.py` (8 endpoints): Local waterfall coordinates, global importances, batch explanations.
- `monitoring_routes.py` (3 endpoints): PSI drift monitoring, feature drift, telemetry reporting.
- `nlp_routes.py` (6 endpoints): Text sentiment analysis, emotion extraction, burnout detection, feedback processing.
- `rag_routes.py` (13 endpoints): Document indexing, semantic search, hybrid query, vector management.
- `registry_routes.py` (3 endpoints): Model manifest inspection, champion promotion, experiment tracking.
- `routes.py` (6 endpoints): Single prediction, batch prediction, model info, threshold evaluation.
- `main.py` (3 endpoints): Root status (`/`), service health (`/health`), capability inspection (`/capabilities`).

### 10.3 Core API Contract Reference

| Method | Route | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | No | Authenticate credentials; return access token & set refresh cookie |
| `POST` | `/api/v1/auth/refresh` | No | Rotate opaque refresh token; return new access token |
| `GET` | `/api/v1/employees` | Yes | List tenant employees with pagination, search, and department filters |
| `GET` | `/api/v1/employees/:id` | Yes | Get employee 360 profile with historical attrition risk |
| `POST` | `/api/v1/ai/predict/:id` | Yes | Execute calibrated attrition prediction for an individual employee |
| `GET` | `/api/v1/explain/local/:id` | Yes | Retrieve SHAP local waterfall feature attribution and top drivers |
| `POST` | `/api/v1/knowledge/query` | Yes | Execute hybrid RAG search against tenant policy vector store |
| `POST` | `/api/v1/decisions/recommend` | Yes | Trigger 8-node LangGraph autonomous retention strategy synthesis |
| `GET` | `/api/v1/executive/summary` | Yes (`EXECUTIVE`+) | Retrieve organizational turnover metrics and flight risk distribution |
| `GET` | `/api/v1/observability/telemetry` | Yes (`ADMIN`+) | Get AI pipeline latency, drift, and call volume telemetry |
| `GET` | `/health` | No | Liveness probe returning process status and uptime |
| `GET` | `/health/deep` | No | Deep readiness inspection (MongoDB, AI Microservice, Redis, RAM/CPU) |

---

## 11. Database Architecture & Data Modeling

### 11.1 MongoDB 7.0 & Mongoose Schema Mapping (45 Schemas)
MongoDB serves as the primary document store, managed by Mongoose ODM in Node.js and Motor in Python. All tenant collections include an `organizationId` typed as BSON `ObjectId`, backed by compound indexes (`{ organizationId: 1, ... }`) to enforce tenant query boundaries.

The repository defines **45 Mongoose model schemas** in `server/src/models/`:
`AgentTraceLog`, `AiBiasAuditLog`, `AiGovernancePolicy`, `AiGuardrailLog`, `AiRedTeamLog`, `AiTelemetry`, `Approval`, `Attachment`, `Attendance`, `AuditLog`, `BillingEvent`, `BillingPlan`, `Comment`, `Decision`, `Department`, `Employee`, `EmployeeChange`, `EmployeeFeedback`, `EmployeeIntelligence`, `ExecutiveAlert`, `Explanation`, `GlobalFeatureImportance`, `Import`, `Intervention`, `Invitation`, `Invoice`, `KnowledgeDocument`, `ManagerNote`, `ModelDriftLog`, `ModelMetadata`, `Notification`, `NotificationPreference`, `Organization`, `Performance`, `Prediction`, `PredictionHistory`, `PromotionHistory`, `RefreshToken`, `Role`, `Subscription`, `Survey`, `Task`, `TenantEntitlement`, `TrainingHistory`, `User`.

#### Figure 9: Database Schema & Entity-Relationship Architecture
```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : "has members"
    ORGANIZATION ||--o{ EMPLOYEE : "employs"
    ORGANIZATION ||--o{ DEPARTMENT : "contains"
    ORGANIZATION ||--o{ KNOWLEDGE_DOCUMENT : "owns policies"
    ORGANIZATION ||--o{ AUDIT_LOG : "records events"

    USER ||--o{ AUDIT_LOG : "triggers"
    USER ||--o{ REFRESH_TOKEN : "holds sessions"
    ROLE ||--o{ USER : "assigned to"

    DEPARTMENT ||--o{ EMPLOYEE : "assigns"
    EMPLOYEE ||--o{ PREDICTION : "current risk"
    EMPLOYEE ||--o{ PREDICTION_HISTORY : "historical risk"
    EMPLOYEE ||--o{ EXPLANATION : "SHAP attributions"
    EMPLOYEE ||--o{ ATTENDANCE : "attendance logs"
    EMPLOYEE ||--o{ PERFORMANCE : "evaluations"
    EMPLOYEE ||--o{ SURVEY : "survey responses"
    EMPLOYEE ||--o{ INTERVENTION : "targeted by"

    INTERVENTION ||--o{ TASK : "generates tasks"
    INTERVENTION ||--o{ APPROVAL : "requires approval"
    INTERVENTION ||--o{ COMMENT : "has discussion"
    INTERVENTION ||--o{ ATTACHMENT : "supports files"

    ORGANIZATION {
        ObjectId _id PK
        string name
        string slug
        string status "ACTIVE | SUSPENDED"
        string subscriptionTier "FREE | PRO | ENTERPRISE"
        date createdAt
    }

    USER {
        ObjectId _id PK
        ObjectId organizationId FK
        string name
        string email
        string passwordHash "bcrypt 12 rounds"
        string role "ADMIN | HR_MANAGER | CHRO | ..."
        string status "ACTIVE | INACTIVE"
    }

    EMPLOYEE {
        ObjectId _id PK
        ObjectId organizationId FK
        ObjectId departmentId FK
        string employeeCode
        string name
        string email
        string jobRole
        number salary
        number tenure_months
        string status "ACTIVE | TERMINATED"
        boolean isDeleted
    }

    PREDICTION {
        ObjectId _id PK
        ObjectId organizationId FK
        ObjectId employeeId FK
        number riskScore "0.0 - 1.0"
        string riskLevel "LOW | MEDIUM | HIGH"
        number confidenceScore
        string modelVersion
        date predictedAt
    }

    PREDICTION_HISTORY {
        ObjectId _id PK
        ObjectId organizationId FK
        ObjectId employeeId FK
        number riskScore
        string riskLevel
        string triggerSource "BATCH | SINGLE | AGENT"
        date timestamp
    }

    EXPLANATION {
        ObjectId _id PK
        ObjectId organizationId FK
        ObjectId employeeId FK
        json topDrivers
        json waterfallData
        number baseValue
        date generatedAt
    }

    INTERVENTION {
        ObjectId _id PK
        ObjectId organizationId FK
        ObjectId employeeId FK
        string title
        string strategyType
        string status "PROPOSED | APPROVED | IN_PROGRESS | COMPLETED"
        number estimatedCost
        date targetSla
        ObjectId assignedTo FK
    }

    KNOWLEDGE_DOCUMENT {
        ObjectId _id PK
        ObjectId organizationId FK
        string title
        string fileUrl
        number chunkCount
        string status "INDEXED | FAILED"
    }

    AUDIT_LOG {
        ObjectId _id PK
        ObjectId organizationId FK
        ObjectId userId FK
        string action
        string resourceType
        string ipAddress
        date timestamp
    }
```
*Figure 9: Database Schema & Entity-Relationship Architecture.*

**Data Relationship & Pluralization Architecture (Figure 9):**
1. **Multi-Tenant Ownership**: `Organization` acts as the root tenant boundary. All critical entity queries filter by `organizationId`.
2. **Collection Pluralization Alignment**: To maintain schema compatibility between Node.js Mongoose and Python Motor, collections use standard Mongoose pluralization. Specifically, the prediction history collection is named `predictionhistories`, verified across both services.
3. **Auditing & Traceability**: Modifications to sensitive resources (employees, predictions, interventions) generate corresponding records in `AuditLog` and `AgentTraceLog`.

---

## 12. Authentication, Session & Token Lifecycle

### 12.1 Cryptographic Token Issuance & Refresh Strategy
RetentionAI utilizes a dual-token authentication scheme combining short-lived signed JWTs with high-entropy opaque refresh tokens:
- **Access Tokens**: Short-lived JSON Web Tokens signed with HS256 (`JWT_ACCESS_SECRET`, 15-minute TTL). Payload carries `sub` (userId), `role`, `organizationId`, and token issuance timestamps.
- **Refresh Tokens**: Opaque 48-byte cryptographically secure pseudorandom numbers (CSPRNG, 384 bits of entropy). Stored in the database solely as HMAC-SHA-256 hashes (`JWT_REFRESH_SECRET`, 7-day TTL).
- **Token Family & Replay Detection**: Refresh tokens are assigned a `familyId`. When a refresh token is exchanged, it is immediately revoked and replaced with a newly generated token. If an already-revoked refresh token is presented (indicating a replay attack or token theft), the entire family is immediately invalidated, terminating all active sessions for that user.

#### Figure 8: Authentication, Token Rotation & Replay Protection
```mermaid
sequenceDiagram
    autonumber
    actor Client as React Client (User)
    participant Server as Express Server (/auth)
    participant DB as MongoDB (User / RefreshToken)

    Note over Client,Server: Authentication (Login Flow)
    Client->>Server: POST /api/v1/auth/login { email, password }
    Server->>DB: Query User by email
    DB-->>Server: User record (with bcrypt passwordHash)
    Server->>Server: bcrypt.compare(password, passwordHash) [12 rounds]
    alt Password Mismatch or User Inactive
        Server-->>Client: 401 Unauthorized (INVALID_CREDENTIALS)
    else Credentials Verified
        Server->>Server: Generate JWT Access Token (HS256, 15m TTL, payload: sub, role, orgId)
        Server->>Server: Generate Opaque Refresh Token (CSPRNG 48-byte base64url, 384-bit)
        Server->>Server: Compute HMAC-SHA256 hash of refresh token
        Server->>DB: Store hashed refresh token with familyId, orgId, expiry (7d)
        Server-->>Client: Set HTTP-Only Cookie (refreshToken) + JSON { accessToken, user }
    end

    Note over Client,Server: Authenticated Request Flow
    Client->>Server: GET /api/v1/employees (Header: Authorization: Bearer <accessToken>)
    Server->>Server: jwt.verify(accessToken, JWT_ACCESS_SECRET)
    Server-->>Client: HTTP 200 OK + Employee List

    Note over Client,Server: Token Rotation (Silent Refresh Flow)
    Client->>Server: POST /api/v1/auth/refresh (Cookie: refreshToken)
    Server->>Server: Compute HMAC-SHA256 of received refresh token
    Server->>DB: Find token record by hash
    alt Token Revoked or Previously Used (Replay Attack Detected)
        Server->>DB: Invalidate Entire Token Family (familyId)
        Server-->>Client: 401 Unauthorized (TOKEN_REVOKED - Force Relogin)
    else Token Valid & Unexpired
        Server->>DB: Mark old token as REVOKED / ROTATED
        Server->>Server: Generate New Access Token (15m) + New Refresh Token (7d)
        Server->>DB: Save new hashed refresh token in same familyId
        Server-->>Client: Updated HTTP-Only Cookie + JSON { accessToken }
    end

    Note over Client,Server: Logout Flow
    Client->>Server: POST /api/v1/auth/logout
    Server->>DB: Mark refresh token record as REVOKED
    Server-->>Client: Clear HTTP-Only Cookie + 200 OK
```
*Figure 8: Authentication, Token Rotation & Replay Protection.*

---

## 13. AI / Machine Learning Pipeline Architecture

### 13.1 Feature Engineering & Multimodal Attribute Vector (28 Features)
The ML pipeline processes **28 features** (23 numerical, 5 categorical) defined in `ai-service/app/preprocessing/pipeline.py` and verified in `models/active/manifest.json`:
- **Numerical Features (23)**: `age`, `salary`, `tenure_months`, `years_since_last_promotion`, `promotion_count`, `promotion_gap_ratio`, `salary_growth_pct`, `training_hours`, `training_completion_rate`, `performance_rating`, `overtime_hours`, `attendance_percentage`, `leave_count`, `leave_frequency`, `job_satisfaction`, `work_life_balance`, `avg_survey_score`, `engagement_score`, `feedback_frequency`, `sentiment_score`, `burnout_score`, `promotion_frustration_nlp`, `manager_conflict_nlp`.
- **Categorical Features (5)**: `gender`, `employmentType`, `workLocation`, `designation`, `departmentId`.

### 13.2 Model Benchmarking, Calibration & Threshold Optimization
The platform evaluates 5 candidate algorithm families (`LogisticRegression`, `RandomForest`, `XGBoost`, `LightGBM`, `CatBoost`) against a `DummyClassifier` baseline. The production champion model is a **Calibrated Logistic Regression** model (`v2.0`):
- **PR-AUC**: **0.6847** (vs. baseline 0.1960 — **+48.87% lift**).
- **ROC-AUC**: **0.8895**.
- **Recall**: **89.12%** (131 out of 147 true positives detected).
- **Precision**: **43.81%**.
- **Accuracy**: **75.47%** (at tuned threshold $0.15$; reaches $82.31\%$ at threshold $0.07$).
- **$F_1$ Score**: **0.5874**; **$F_2$ Score**: **0.7384** (weighted toward recall to prevent missing at-risk employees).
- **Calibration**: Isotonic regression yielding a Brier score of **0.0980**.
- **Confusion Matrix on Holdout Partition**: $\text{TN}=435$, $\text{FP}=168$, $\text{FN}=16$, $\text{TP}=131$.

#### Figure 3: ML Ingestion, Preprocessing & Inference Pipeline
```mermaid
graph LR
    subgraph Ingestion ["1. Data Ingestion & Enrichment"]
        EMP["Employee Record\n(MongoDB)"] --> JOIN["HR History Joiner\n(Attendance, Performance, Surveys)"]
        JOIN --> RAW["28 Raw Multimodal Attributes"]
    end

    subgraph Preprocessing ["2. Leakage-Safe Preprocessing Pipeline"]
        RAW --> SPLIT["Stratified Split\n(Train 70% | Val 15% | Test 15%)"]
        SPLIT --> IMPUTE["Median Imputation\n(Fitted on Train Set Only)"]
        IMPUTE --> SCALE["StandardScaler\n(23 Numerical Features)"]
        IMPUTE --> ENCODE["Label / Ordinal Encoding\n(5 Categorical Features)"]
        SCALE --> FEAT["Engineered Feature Vector (28 Features)"]
        ENCODE --> FEAT
    end

    subgraph Modeling ["3. Model Inference & Calibration"]
        FEAT --> MODEL["Base Estimator\n(Champion: Logistic Regression)"]
        MODEL --> CALIB["Probability Calibration\n(Isotonic Regression)"]
        CALIB --> PROB["Empirical Probability P(Attrition)"]
    end

    subgraph DecisionBoundary ["4. Thresholding & Persistence"]
        PROB --> THRESH{"P >= 0.15 Decision Cutoff\n(Optimized for Recall & F2)"}
        THRESH -->|">= 0.15"| HIGH["HIGH / MEDIUM RISK\n(Flagged for Retention Action)"]
        THRESH -->|"< 0.15"| LOW["LOW RISK\n(Normal Monitoring)"]
        HIGH --> WRITE["Upsert to 'predictions' &\nAppend to 'predictionhistories'"]
        LOW --> WRITE
    end
```
*Figure 3: ML Ingestion, Preprocessing & Inference Pipeline.*

#### Figure 4: SHAP Explainability & Attribution Architecture
```mermaid
graph TD
    subgraph InputData ["Input Vector"]
        VEC["Preprocessed Employee Feature Vector (28 Dims)"]
        BASE["Training Set Background Matrix (K-Means / Sampled)"]
    end

    subgraph ExplainerCache ["SHAP Explainer Engine"]
        CACHE["ShapExplainerCache (Singleton)"]
        CACHE --> TREE_EXP["TreeExplainer (CatBoost / XGBoost / RF)"]
        CACHE --> LIN_EXP["LinearExplainer (Logistic Regression Champion)"]
    end

    subgraph Attribution ["Attribution & Decomposition"]
        VEC & BASE --> ExplainerCache
        ExplainerCache --> SHAP_VALS["Raw SHAP Values\nphi_i per feature i"]
        SHAP_VALS --> SUM_PROP["Additive Efficiency:\nf(x) = E[f(x)] + SUM(phi_i)"]
    end

    subgraph Formatting ["Presentation & Guardrails"]
        SUM_PROP --> TOP_DRIVERS["Top Positive Drivers\n(Overtime, Stagnation, Pay Gap)"]
        SUM_PROP --> WATERFALL["Waterfall Chart Coordinates\n(Base E[X] -> Final Output)"]
        TOP_DRIVERS & WATERFALL --> DISCLAIMER["Mandatory Causal Disclaimer:\n'Statistical association, not confirmed causation'"]
        DISCLAIMER --> JSON_RESP["Explainability API Response JSON"]
    end
```
*Figure 4: SHAP Explainability & Attribution Architecture.*

---

## 14. Large Language Model (LLM) Integration & Prompt Engineering

RetentionAI leverages the **Groq Cloud API** running `llama-3.1-8b-instant` (with `llama-3.3-70b` available for executive summaries). Groq provides sub-second inference latency, essential for interactive agent workflows.
- **Structured JSON Schema Gating**: System prompts enforce structured JSON output adhering to predefined Pydantic schemas (`RetentionStrategyOutput`).
- **Prompt Isolation**: System prompts strictly forbid open-domain conversation, confining reasoning to tenant-isolated policy context and employee metrics provided in the payload.
- **Deterministic Rule Fallback**: If Groq returns rate-limit errors, network timeouts, or invalid JSON, the system falls back to a deterministic rule-based heuristic matrix (`ai-service/app/decision/`), guaranteeing uninterrupted operational availability (see [Figure 11](#figure-11-error-handling-circuit-breakers--fallback-hierarchy)).

---

## 15. Retrieval-Augmented Generation (Hybrid RAG) Architecture

### 15.1 Dense Embeddings, BM25 Lexical Ranking & Reciprocal Rank Fusion
RetentionAI's RAG pipeline indexes tenant HR policy documents into ChromaDB. To balance semantic search with exact lexical keyword matching, it implements a hybrid architecture:
- **Dense Vector Retrieval**: Uses `SentenceTransformers` (`all-MiniLM-L6-v2`, 384 dimensions) to identify conceptual semantics.
- **Sparse Lexical Retrieval**: Uses BM25 (`rank_bm25`) to catch exact acronyms, policy IDs, and legal terms.
- **Reciprocal Rank Fusion (RRF)**: Merges ranked lists using $RRF(d) = \sum \frac{1}{60 + \text{rank}(d)}$.
- **Relevance Gate ($0.15$)**: If the fused score is below $0.15$, the LLM is bypassed, preventing hallucinated policies.

#### Figure 5: Hybrid RAG Policy Retrieval Architecture
```mermaid
graph TD
    subgraph Ingestion ["Policy Ingestion Pipeline"]
        DOC["HR Policy Document (PDF/DOCX/TXT)"]
        CLEAN["Text Cleaner & Normalizer"]
        CHUNK["Recursive Character Text Splitter\n(Chunk Size: 500, Overlap: 50)"]
        EMBED["SentenceTransformers\n(all-MiniLM-L6-v2, 384 dims)"]
        META["Metadata Attacher\n(organizationId, docTitle, version)"]

        DOC --> CLEAN --> CHUNK --> EMBED --> META
        META --> CHROMA_DB[("ChromaDB Vector Store\n(Persistent Collection)")]
    end

    subgraph Retrieval ["Hybrid Retrieval & Fusion"]
        QUERY["User / Agent HR Policy Query"]
        QUERY --> DENSE_SEARCH["Dense Semantic Vector Search\n(Cosine Distance via ChromaDB)"]
        QUERY --> SPARSE_SEARCH["Sparse Lexical Keyword Search\n(BM25 Algorithm)"]
        CHROMA_DB --> DENSE_SEARCH

        DENSE_SEARCH -->|Top-K Dense Ranks| RRF["Reciprocal Rank Fusion (RRF)\nScore = SUM(1 / (k + rank))"]
        SPARSE_SEARCH -->|Top-K Sparse Ranks| RRF
    end

    subgraph Gatekeeper ["Multi-Tenant & Relevance Gating"]
        RRF --> TENANT_FILTER{"Tenant Metadata Assertion\nchunk.orgId == req.orgId"}
        TENANT_FILTER -->|Pass| REL_CHECK{"Relevance Score >= 0.15 ?"}
        TENANT_FILTER -->|Mismatch| DROP["Drop Chunk (Log Security Alert)"]
        REL_CHECK -->|No Chunks >= 0.15| FALLBACK["Groundedness Fallback\n'No relevant HR policy found.'\n(LLM NOT Invoked)"]
        REL_CHECK -->|Chunks >= 0.15| PROMPT["Construct Grounded Context Prompt\nwith Citations & Constraints"]
    end

    subgraph Generation ["Synthesis"]
        PROMPT --> GROQ["Groq LLM (Llama 3.1 8B Instant)"]
        GROQ --> RESPONSE["Policy-Grounded Answer\n+ Verified Inline Citations [Doc: Page]"]
    end
```
*Figure 5: Hybrid RAG Policy Retrieval Architecture.*

---

## 16. Autonomous Agent Architecture (LangGraph 8-Node State Machine)

### 16.1 Graph Topology, AgentState & Node Contracts
The retention strategy agent is implemented using LangGraph in `ai-service/app/agent/retention_graph.py`. The execution state is tracked within `AgentState` (`agent_state.py`). The pipeline consists of **8 sequential nodes**:

#### Figure 6: 8-Node LangGraph Retention Decision Workflow
```mermaid
graph TD
    START([START: Agent Invocation]) --> N1

    subgraph Node1 ["1. context_validation_node"]
        N1["Validate Tenant Context\n- Verify organizationId & employeeId\n- Cross-tenant boundary check\n- Extract baseline demographic attributes"]
    end

    N1 -->|Valid| N2
    N1 -->|Invalid / Cross-Tenant| FAIL([TERMINATE: Security Violation])

    subgraph Node2 ["2. ml_risk_agent_node"]
        N2["ML Risk Assessment\n- Fetch or compute calibrated attrition risk\n- Classify Risk Level (LOW, MEDIUM, HIGH)\n- Evaluate confidence score"]
    end

    N2 --> N3

    subgraph Node3 ["3. explainability_agent_node"]
        N3["SHAP Feature Attribution\n- Query ShapExplainerCache\n- Extract top 3-5 positive risk drivers\n- Attach humanized feature labels & impact"]
    end

    N3 --> N4

    subgraph Node4 ["4. employee_context_agent_node"]
        N4["Employee Context Enrichment\n- Aggregate attendance & leave records\n- Pull performance rating & promotion gap\n- Retrieve NLP sentiment/burnout metrics"]
    end

    N4 --> N5

    subgraph Node5 ["5. rag_policy_agent_node"]
        N5["RAG Policy Retrieval\n- Execute hybrid search for HR policies\n- Filter strictly by organizationId\n- Extract grounded retention benefits & SLA"]
    end

    N5 --> N6

    subgraph Node6 ["6. retention_strategy_agent_node"]
        N6{"Reasoning Engine\n- Attempt Groq LLM strategy synthesis\n- Fallback to rule-based engine if offline"}
    end

    N6 --> N7

    subgraph Node7 ["7. decision_validation_node"]
        N7["Integrity & Citation Validation\n- Validate actionability and budget limits\n- Verify policy citation groundings\n- Check against bias & governance guardrails"]
    end

    N7 --> N8

    subgraph Node8 ["8. final_decision_node"]
        N8["Final Decision Synthesis\n- Assemble structured recommendation payload\n- Estimate cost & intervention timeline\n- Compile immutable audit trace log"]
    end

    N8 --> COMPLETE([END: Return Structured Strategy])
```
*Figure 6: 8-Node LangGraph Retention Decision Workflow.*

**Node Execution Details (Figure 6):**
1. `context_validation_node`: Validates `organizationId` and `employeeId`. Queries MongoDB; verifies that the employee record belongs to the calling organization. Fails immediately on tenant mismatch.
2. `ml_risk_agent_node`: Retrieves the latest risk score or invokes `prediction_service` to score the employee.
3. `explainability_agent_node`: Queries `shap_cache` to extract the top 3-5 positive risk drivers.
4. `employee_context_agent_node`: Pulls attendance, performance ratings, tenure, promotion gaps, and NLP sentiment metrics into a unified context payload.
5. `rag_policy_agent_node`: Formulates policy queries based on identified SHAP drivers and retrieves matching policy passages from ChromaDB.
6. `retention_strategy_agent_node`: Calls Groq LLM to synthesize personalized retention options. If the LLM is unreachable, triggers the rule-based decision fallback.
7. `decision_validation_node`: Validates that proposed actions adhere to budget caps and match retrieved policy citations.
8. `final_decision_node`: Formats the final output payload, attaches the complete execution trace, and persists the record.

---

## 17. AI/ML Microservice Integration & Inter-Service Security

The Express backend and FastAPI microservice communicate via private HTTP networking within the Docker container bridge.
- **Shared Service Secret**: Every request from Express to FastAPI must include `Authorization: Bearer <AI_SERVICE_TOKEN>`. FastAPI validates this header via dependency injection (`verify_service_token`).
- **Tenant Context Propagation**: Express forwards `X-Organization-Id`, `X-User-Id`, and `X-Correlation-Id` headers.
- **FastAPI Direct Persistence**: For high-throughput ML artifacts (e.g., batch predictions, SHAP matrices), FastAPI writes directly to MongoDB via Motor, avoiding the overhead of serializing massive datasets back through the Express gateway.

---

## 18. End-to-End Data Flow Trajectories

1. **Prediction Data Flow**: Employee Document $\rightarrow$ Feature Transformer $\rightarrow$ Calibrated ML Model $\rightarrow$ Probability Score $\rightarrow$ Threshold Split ($0.15$) $\rightarrow$ Persisted to `predictions` & `predictionhistories`.
2. **SHAP Explanation Data Flow**: Feature Vector $\rightarrow$ SHAP Explainer Cache $\rightarrow$ Local Attribution Decomposer $\rightarrow$ Waterfall Coordinates + Top Drivers $\rightarrow$ Causal Disclaimer Attachment $\rightarrow$ Response JSON.
3. **Policy RAG Data Flow**: User Query $\rightarrow$ Dense/Sparse Retrieval $\rightarrow$ Reciprocal Rank Fusion $\rightarrow$ Tenant ID Filter $\rightarrow$ Relevance Threshold ($0.15$) $\rightarrow$ Grounded LLM Prompt $\rightarrow$ Answer with Citations.
4. **Autonomous Strategy Flow**: Employee ID $\rightarrow$ LangGraph State Machine (8 Nodes) $\rightarrow$ Context Validation $\rightarrow$ ML Risk $\rightarrow$ SHAP Drivers $\rightarrow$ Policy Retrieval $\rightarrow$ Groq LLM Synthesis $\rightarrow$ Decision Validation $\rightarrow$ Intervention Payload.

---

## 19. Core Classes, Modules & Architectural Interfaces

- `PredictionService` (`ai-service/app/prediction/prediction_service.py`): Manages ML model loading, feature preprocessing, calibration, and inference.
- `ShapExplainerCache` (`ai-service/app/explainability/shap_explainer.py`): Thread-safe singleton holding fitted explainers and background baseline data.
- `retention_graph_app` (`ai-service/app/agent/retention_graph.py`): Compiled 8-node LangGraph executable graph instance.
- `rag_service.py` (`ai-service/app/rag/services/rag_service.py`): Core hybrid RAG engine implementing BM25, ChromaDB dense search, and RRF fusion.
- `authenticate` (`server/src/middlewares/authenticate.js`): Express middleware validating JWT signatures and attaching authenticated user context.
- `authorize` (`server/src/middlewares/authorize.js`): RBAC enforcement middleware evaluating role memberships and permission strings.
- `AppError` (`server/src/errors/AppError.js`): Standardized operational exception class carrying HTTP status codes and machine-readable error identifiers.

---

## 20. Configuration Architecture & Runtime Environment

Configuration follows the 12-factor application methodology:
- **Node.js Gateway**: Validated at boot via Zod schema (`server/src/config/env.js`). Missing required keys crash the process immediately with clear configuration errors.
- **FastAPI AI Microservice**: Validated at boot via Pydantic `BaseSettings` (`ai-service/app/config.py`).
- **Offline Mode Control**: `AI_MODELS_OFFLINE=true` forces the Python service into offline operation, setting `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` before libraries initialize.

---

## 21. Environment Variable Reference & Security Boundaries

| Variable | Required | Service | Purpose | Safe Example / Default |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | Server | Runtime environment | `development` / `production` |
| `PORT` | No | Server | HTTP port for Express | `5000` |
| `MONGODB_URI` | Yes | Server & AI | MongoDB connection string | `mongodb://localhost:27017/retentionai` |
| `JWT_ACCESS_SECRET` | Yes | Server | Secret for signing HS256 access tokens | `<high-entropy-secret>` |
| `JWT_REFRESH_SECRET` | Yes | Server | Secret for HMAC hashing refresh tokens | `<high-entropy-secret>` |
| `AI_SERVICE_URL` | Yes | Server | Internal URL for Python AI microservice | `http://localhost:8000` |
| `AI_SERVICE_TOKEN` | Yes | Server & AI | Shared secret for inter-service authentication | `<high-entropy-secret>` |
| `GROQ_API_KEY` | Yes (Prod) | AI Service | API key for Groq Cloud LLM inference | `<groq-api-key>` |
| `CORS_ORIGINS` | Yes | Server | Comma-separated list of allowed origins | `http://localhost:5173,http://localhost:3000` |
| `AI_MODELS_OFFLINE` | No | AI Service | Prevent HuggingFace network calls at startup | `true` |
| `CHROMA_PERSIST_DIR` | No | AI Service | Filesystem path for ChromaDB storage | `/app/chroma_db` |
| `UPSTASH_REDIS_REST_URL`| No | Server | Upstash Redis REST endpoint (optional cache) | `<optional-url>` |

---

## 22. External Dependencies & Cloud Services

- **MongoDB Atlas / Local MongoDB 7.0**: Primary document database.
- **Groq Cloud API**: High-speed LLM inference serving `llama-3.1-8b-instant`.
- **ChromaDB**: Local, embedded vector database storing HR policy embeddings.
- **Upstash Redis (REST)**: Optional external caching layer and distributed lock provider.
- **Stripe API**: Billing customer ID and subscription plan placeholders (full checkout integration scheduled for Phase 2).

---

## 23. Error Handling, Circuit Breakers & Resilience

### Figure 11: Error Handling, Circuit Breakers & Fallback Hierarchy
```mermaid
graph TD
    REQ["Incoming API / AI Request"] --> ROUTE_EXEC["Route Controller Execution"]

    ROUTE_EXEC --> TRY_BLOCK{"Try / Catch Block"}

    subgraph ExpressErrors ["Express Error Normalization Middleware (errorHandler.js)"]
        TRY_BLOCK -->|Error Thrown| ERR_CLASSIFY{"Error Classification"}
        ERR_CLASSIFY -->|code === 11000| ERR_409["HTTP 409 Conflict\n'Duplicate resource key violation'"]
        ERR_CLASSIFY -->|name === 'ValidationError'| ERR_400["HTTP 400 Bad Request\n'Mongoose schema validation failed'"]
        ERR_CLASSIFY -->|name === 'ZodError'| ERR_ZOD["HTTP 400 Bad Request\nStructured field-level issue details array"]
        ERR_CLASSIFY -->|instanceof AppError| ERR_APP["HTTP [appError.statusCode]\nStandardized machine code & message"]
        ERR_CLASSIFY -->|Unhandled Exception| ERR_500["HTTP 500 Internal Server Error\nSuppress stack traces & secrets\nLog internal correlation ID"]
    end

    subgraph DownstreamResilience ["FastAPI & External Service Circuit Breakers"]
        TRY_BLOCK -->|FastAPI Call| AI_CALL{"Python AI Microservice Call"}
        AI_CALL -->|Service Unavailable / Timeout| AI_FALLBACK["Circuit Breaker:\nReturn 503 AI_SERVICE_UNAVAILABLE\nor fall back to cached risk score"]

        AI_CALL -->|FastAPI Success| AGENT_EXEC["LangGraph Agent Execution"]
        AGENT_EXEC --> LLM_CALL{"Groq LLM Call"}
        LLM_CALL -->|Rate Limit / Timeout / Network Error| RULE_FALLBACK["Rule-Based Strategy Fallback:\nSynthesize deterministic recommendations\nfrom pre-approved HR policy matrix"]
        LLM_CALL -->|Success| LLM_RESPONSE["Structured LLM Strategy"]

        AGENT_EXEC --> RAG_CALL{"RAG Policy Retrieval"}
        RAG_CALL -->|Relevance Score < 0.15| NO_RAG["Groundedness Gate:\nReturn standard policy disclaimer\n(Bypass LLM completely)"]
    end

    ERR_409 & ERR_400 & ERR_ZOD & ERR_APP & ERR_500 --> CLIENT_ERR["Structured JSON Client Response\n{ success: false, error: { code, message, requestId } }"]
```
*Figure 11: Error Handling, Circuit Breakers & Fallback Hierarchy.*

**Resilience & Exception Normalization (Figure 11):**
1. **Secret & Stack Trace Suppression**: Production responses redact raw database errors, stack traces, and environment keys. Unhandled exceptions return generic HTTP 500 errors with a traceable `requestId`.
2. **Deterministic Code Translation**: MongoDB code 11000 becomes HTTP 409 Conflict; Mongoose ValidationErrors become HTTP 400 Bad Request; Zod schema validation errors map into clean field-level error arrays.
3. **Downstream Fallbacks**: If the Python service is offline, Express returns HTTP 503 with machine code `AI_SERVICE_UNAVAILABLE`. If the Groq LLM API fails, the LangGraph agent falls back to a deterministic rule-based retention strategy engine.

---

## 24. Multi-Tenant Security & Defense-in-Depth Model

RetentionAI enforces tenant isolation through a 5-layer defense-in-depth architecture:

#### Figure 7: Multi-Tenant Security & Isolation Model
```mermaid
graph TD
    subgraph Ingress ["1. Request Ingress & JWT Validation"]
        REQ["Incoming Client Request"] --> EXTRACT["Extract Bearer JWT Token"]
        EXTRACT --> VERIFY["Verify Token Signature (HS256) & Expiry"]
        VERIFY --> DB_USER["Lookup User in MongoDB"]
        DB_USER --> BIND["Extract user.organizationId\nBind to req.auth (Server-Managed)"]
    end

    subgraph MiddlewareGate ["2. Middleware Defense Layers"]
        BIND --> ORG_STATUS{"Organization Status Check\norganization.status == 'ACTIVE'"}
        ORG_STATUS -->|"SUSPENDED"| FORBIDDEN_ORG["403 Forbidden\n'Organization account suspended'"]
        ORG_STATUS -->|"ACTIVE"| RBAC_CHECK{"Role & Permission Check\nauthorize(roles / permissions)"}
        RBAC_CHECK -->|"Insufficient"| FORBIDDEN_ROLE["403 Forbidden\n'Access Denied'"]
        RBAC_CHECK -->|"Authorized"| SANITIZE["Input Sanitization\nStrip $ where, $gt, and client-supplied orgId"]
    end

    subgraph DatabaseIsolation ["3. Data Layer Tenant Scoping"]
        SANITIZE --> QUERY_BUILD["Repository Query Constructor\nInject { organizationId: req.auth.organizationId }"]
        QUERY_BUILD --> MONGO_EXEC["MongoDB Query Execution\nIndexes: { organizationId: 1, ... }"]
        MONGO_EXEC --> DOCS["Tenant-Isolated Documents Returned\n(Cross-tenant IDs return 404 Not Found)"]
    end

    subgraph VectorIsolation ["4. Vector Store Isolation"]
        SANITIZE --> CHROMA_QUERY["ChromaDB Vector Retrieval"]
        CHROMA_QUERY --> CHROMA_FILTER["Metadata Filter:\n{'organizationId': {'$eq': req.auth.organizationId}}"]
        CHROMA_FILTER --> ASSERTION["In-Code Defense Assertion:\nAssert all chunk.orgId == req.auth.organizationId"]
        ASSERTION --> VEC_DOCS["Tenant Policy Chunks Only"]
    end

    subgraph AuditTrail ["5. Immutable Audit Trail"]
        DOCS & VEC_DOCS --> AUDIT["AuditLog Service\nWrite immutable record with actorId, orgId, action, IP"]
    end
```
*Figure 7: Multi-Tenant Security & Isolation Model.*

**Defense-in-Depth Mechanics (Figure 7):**
1. **Server-Derived Tenant Identity**: `organizationId` is never trusted from query parameters, path variables, or request bodies. It is extracted exclusively from the cryptographically verified JWT access token and confirmed against the active database user record.
2. **Closed-by-Default Cross-Org Access**: When a user attempts to read or mutate a resource belonging to another organization (IDOR attempt), the query fails to match and returns HTTP 404 Not Found rather than 403 Forbidden, preventing resource enumeration.
3. **ChromaDB Defense Assertion**: Vector queries apply mandatory metadata filtering (`organizationId == req.auth.organizationId`). As an extra defense-in-depth safeguard, retrieved chunks are validated in code before being added to LLM prompts.

---

## 25. Networking, CORS, Reverse Proxy & Security Headers

- **CORS Configuration**: Express utilizes a custom origin matcher (`createOriginMatcher`) that rejects wildcard (`*`) hosts in production and only accepts explicitly configured hostnames matching the tenant domain.
- **Nginx Reverse Proxy**: In production, Nginx serves static compiled assets directly and proxies `/api/*` requests to the Express container on port 5000 with `proxy_set_header` forwarding real client IPs.
- **Security Headers**: Helmet configures Content Security Policy (CSP), HTTP Strict Transport Security (HSTS, max-age 31536000), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: SAMEORIGIN`.

---

## 26. Containerization, Deployment & Cloud Topology

The platform supports both local development containerization via Docker Compose and production cloud deployments via Render Blueprint (`render.yaml`):

#### Figure 10: Deployment & Infrastructure Topology
```mermaid
graph TB
    subgraph PublicInternet ["Public Internet / Client Users"]
        USER_BROWSER["HR Specialist / Executive Browser"]
    end

    subgraph EdgeTier ["Edge Routing & SSL Termination"]
        DNS["Cloudflare DNS / Edge Network"]
        SSL["SSL / TLS 1.3 Termination"]
        DNS --> SSL
    end

    subgraph ProductionHost ["Containerized Production Host (Render / Cloud VM)"]
        subgraph FrontendPod ["Frontend Container (Nginx)"]
            NGINX_ROUTER["Nginx Server (Port 80/443)"]
            SPA_ASSETS["React Static Assets (Vite Dist)"]
            NGINX_ROUTER --> SPA_ASSETS
        end

        subgraph BackendPod ["Backend Gateway Container (Node 18 Alpine)"]
            EXPRESS_APP["Express Gateway Application (Port 5000)"]
            EXPRESS_APP --> HEALTH["/health & /health/deep Probes"]
        end

        subgraph AIPod ["AI Microservice Container (Python 3.10 Slim)"]
            FASTAPI_APP["FastAPI / Uvicorn (Port 8000)"]
            MODEL_BIN["Active Models (/app/models/active)"]
            CHROMA_PERSIST["Local ChromaDB (/app/chroma_db)"]
            FASTAPI_APP --> MODEL_BIN
            FASTAPI_APP --> CHROMA_PERSIST
        end

        NGINX_ROUTER -->|/api/* Reverse Proxy| EXPRESS_APP
        EXPRESS_APP -->|Internal HTTP Proxy (AI_SERVICE_TOKEN)| FASTAPI_APP
    end

    subgraph ManagedServices ["External Managed Cloud Infrastructure"]
        ATLAS[("MongoDB Atlas 7.0 Cluster\n(Replica Set + VPC Peering)")]
        UPSTASH[("Upstash Redis REST API\n(Distributed Cache & Locks)")]
        GROQ_API["Groq Cloud LLM API\n(Llama 3.1 8B / 3.3 70B)"]
    end

    USER_BROWSER --> DNS
    SSL --> NGINX_ROUTER
    EXPRESS_APP --> ATLAS
    FASTAPI_APP --> ATLAS
    EXPRESS_APP -.-> UPSTASH
    FASTAPI_APP --> GROQ_API
```
*Figure 10: Deployment & Infrastructure Topology.*

---

## 27. Local Development & Operational Runtime Runbook

```bash
# 1. Start Local Infrastructure Containers (MongoDB & optional Redis)
docker-compose up mongo -d

# 2. Launch FastAPI Python AI Microservice (Port 8000)
cd ai-service
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Launch Node.js / Express API Gateway (Port 5000)
cd ../server
npm install
npm run dev

# 4. Launch React 18 / Vite Frontend Single Page App (Port 5173)
cd ../client
npm install
npm run dev
```

---

## 28. Multi-Tier Testing Infrastructure & Quality Engineering

### 28.1 Automated Test Execution Summary
RetentionAI maintains a multi-tier testing architecture across all tiers:

```
Platform Automated Test Verification Summary:
├── Python FastAPI AI Service (PyTest):  167 Passed, 0 Failed (100% pass rate in 267.39s)
├── Node.js Backend Gateway (node --test): 58 Passed, 0 Failed in core suite (35 test files total)
└── React Frontend SPA (Vitest + RTL):     11 Passed, 0 Failed in 4.17s
─────────────────────────────────────────────────────────────────────────────────
CORE PLATFORM VERIFIED TESTS:             236+ Total Automated Tests Passing (Zero Regressions)
```
*(Note: In restricted low-memory LITE environments where Hugging Face downloads are disabled, PyTest reports 108 passed and 2 conditionally skipped tests).*

### 28.2 Backend, AI & Frontend Test Suite Inventory
- **Node.js Test Suites (`server/tests/`, 35 Files)**:
  - `error-handler.test.js`: Validates `AppError`, Mongo 11000 duplicate keys $\rightarrow$ 409, Mongoose CastErrors $\rightarrow$ 400, and internal stack trace suppression.
  - `jwt.test.js`: Verifies HS256 signature verification, claims encoding, and expired token rejection.
  - `rbac.test.js`: Tests permission trees across all 9 roles, including wildcard admin access and 403 Forbidden gates.
  - `apiContracts.supertest.test.js`: In-memory Supertest contract suite testing authentication, employee pagination, IDOR tenant isolation (Org A vs Org B closed 404s), and circuit breaker fallbacks.
  - `aiGovernance.integration.test.js` & `tenant-isolation-idor.integration.test.js`: Multi-tenant boundary regression suites.
- **Python AI Microservice Suites (`ai-service/tests/`, 17 Suites)**:
  - `test_ml_pipeline_leakage.py` (9 tests): Validates stratified 70/15/15 splitting and strict training-only median imputation.
  - `test_explainability.py` (41 tests): Tests local waterfall plot generation, global feature importances, and headless non-IPython rendering.
  - `test_agent.py` & `test_agent_graph.py`: Validates LangGraph 8-node state transitions and Groq prompt assembly.
  - `test_rag.py` & `test_rag_groundedness.py`: Tests dense + sparse hybrid vector search and the 0.15 relevance gate.
  - `test_drift_monitoring.py` & `test_drift_rigor.py`: Verifies PSI and Kolmogorov-Smirnov drift calculations.
  - `test_model_registry.py` (13 tests): Verifies cryptographic SHA-256 model packaging and manifest validation.
- **React Frontend Suites (`client/src/tests/`, 2 Files)**:
  - `Login.test.jsx`: Form validation schemas, Redux error handling, loading spinners, and demo credential pre-population.
  - `ProtectedRoute.test.jsx`: Redirection to `/login`, authentication initialization, and role permission 403 rendering.

#### Figure 12: Multi-Tier Testing Architecture Matrix
```mermaid
graph TB
    subgraph Pipeline ["GitHub Actions CI/CD Pipeline (.github/workflows/ci.yml)"]
        TRIGGER["Push / Pull Request Trigger"]
    end

    subgraph Tier1 ["Tier 1: Node.js Backend Testing (server/tests/)"]
        NODE_UNIT["Node Native Test Runner (node --test)\n8 Unit & Utility Suites (58 passing tests)"]
        SUPERTEST["Supertest Contract & IDOR Integration\napiContracts.supertest.test.js\nIn-memory MongoDB (MongoMemoryServer)"]
        NODE_FULL["Full Regression Suite (node --test tests/*.test.js)\n35 Test Files spanning Auth, Tenancy, RBAC, Governance"]
    end

    subgraph Tier2 ["Tier 2: Python AI Microservice Testing (ai-service/tests/)"]
        PYTEST["PyTest Runner + pytest-cov\n17 Test Suites (167 tests, 100% pass rate in 267s)"]
        ML_TESTS["Leakage & Pipeline Tests\ntest_ml_pipeline_leakage.py (9 tests)\ntest_test_set_isolation.py (Holdout isolation)"]
        XAI_TESTS["SHAP & Explainability Tests\ntest_explainability.py (41 tests)\nHeadless non-IPython rendering"]
        AGENT_TESTS["LangGraph & Decision Tests\ntest_agent.py, test_agent_graph.py, test_decision_engine.py"]
        DRIFT_TESTS["Drift & Registry Tests\ntest_drift_monitoring.py, test_model_registry.py"]
        LITE_TESTS["Capability Degradation Tests\ntest_lite_build.py (Graceful LITE mode verification)"]
    end

    subgraph Tier3 ["Tier 3: Frontend SPA Testing (client/src/tests/)"]
        VITEST["Vitest Test Runner (^5.0.4) + JSDOM\n2 Test Files (11 passing tests in 4.17s)"]
        LOGIN_TEST["Login.test.jsx\nSchema validation, Redux errors, loading states"]
        ROUTE_TEST["ProtectedRoute.test.jsx\nAuth redirection, RBAC 403 access control"]
        BUILD_TEST["Vite Production Bundle Verification\nZero bundle compilation errors in 12.76s"]
    end

    subgraph Tier4 ["Tier 4: Performance & Load Testing (docs/Load-Testing-Report.md)"]
        AUTOCANNON["Autocannon Benchmark Suite\n50 / 100 / 150 Concurrent Connections"]
        BENCH_DASH["workflow_dashboard: 107 -> 172 req/s (Healthy scale)"]
        BENCH_EMP["employees_list: 18.6 -> 8.9 req/s (Populate bottleneck)"]
    end

    TRIGGER --> Tier1 & Tier2 & Tier3
```
*Figure 12: Multi-Tier Testing Architecture Matrix.*

---

## 29. Performance Benchmarks, Load Testing & Telemetry

### 29.1 Autocannon Load Testing Results & Scaling Curves
Load testing was conducted using Autocannon (`server/scripts/load-test-safe.js`) across 50, 100, and 150 concurrent connections (verified in `docs/Load-Testing-Report.md`):

| Target Endpoint | @50 Connections | @100 Connections | @150 Connections | Scaling Behavior Observed |
| :--- | :--- | :--- | :--- | :--- |
| `workflow_dashboard` | 107 req/s, p50 335ms | 150 req/s, p50 610ms | **172 req/s**, p50 819ms | **Positive Scale**: Throughput rises with load; modest latency growth |
| `employees_list` (1,470 docs) | 18.6 req/s, p50 2.2s | 12.5 req/s, p50 5.0s | 8.9 req/s, p50 7.8s | **Degrades**: Bottleneck in Mongoose `.populate()` joins |
| `dashboard_analytics` | 12.5 req/s, p50 3.2s | 12.5 req/s, p50 5.0s | 0 req/s (timed out) | **Stalls**: Ephemeral in-memory MongoDB query contention |
| `ai/predict/:id` (Single) | 50 conn: p50 2.0s | — | — | **Single-request base latency: ~120ms** |

*Real-World Finding*: As documented in `docs/Load-Testing-Report.md`, while the workflow dashboard scales smoothly to 172 req/s, endpoints performing multiple Mongoose `.populate()` joins over 1,470 employee records degrade under high concurrency. This is identified as an optimization target (requiring field projection trimming and index optimization) rather than hidden.

### 29.2 Production ML MLOps & Lineage Verification
- **Dataset Size**: 1,470 synthetic employee records (147 terminated = 10.0% attrition rate) generated via the Faker-based Node generator (`dataset-generator/`).
- **Data Leakage Elimination**: Confirmed via 9 passing tests in `tests/test_ml_pipeline_leakage.py`. Median imputation and standard scaling parameters are fitted strictly on the 70% training split.
- **Champion Model Performance**: Calibrated Logistic Regression achieves a PR-AUC of **0.6847** (+48.87% lift over 0.1960 baseline), ROC-AUC of **0.8895**, and **89.12% recall** at an optimized cutoff of **0.15** ($F_2 = 0.7384$).

---

## 30. Architectural Decisions (ADRs) & Trade-offs

1. **ADR-01: Express API Gateway vs. Direct UI-to-FastAPI Communication**
   - *Decision*: Route all client traffic through the Node.js Express Gateway.
   - *Rationale*: Centralizes JWT authentication, RBAC authorization, rate limiting, and audit logging in a single perimeter layer. The additional HTTP hop (~5-10ms) is well worth the unified security boundary.
2. **ADR-02: Embedded ChromaDB vs. Managed Cloud Vector DB**
   - *Decision*: Deploy ChromaDB as an embedded local vector store mounted on persistent disk.
   - *Rationale*: Eliminates third-party managed vector DB costs and network latency for single-host deployments while satisfying tenant isolation via metadata filters.
3. **ADR-03: Dual LITE vs. FULL AI Microservice Build Profiles**
   - *Decision*: Support dynamic capability probing via `importlib.util.find_spec`.
   - *Rationale*: Allows running on memory-constrained hosts (< 512MB RAM) by gracefully omitting PyTorch and Transformers while maintaining core prediction, SHAP, and LLM functionality.
4. **ADR-04: Recall-Weighted Threshold Tuning ($0.15$)**
   - *Decision*: Calibrate decision threshold to $0.15$ to optimize the $F_2$ score rather than using a default $0.5$ cutoff.
   - *Rationale*: In employee retention, false negatives (failing to identify an employee who subsequently quits) cost significantly more than false positives (providing an unnecessary retention check-in).

---

## 31. Technical Trade-offs & Engineering Compromises

- **Mongoose Populate Convenience vs. Query Throughput**: Mongoose `.populate()` simplifies object-relational mapping across 45 collections, but introduces measurable latency degradation under concurrent load on large collections.
- **Groq API Cloud Reliance vs. Self-Hosted LLMs**: Utilizing Groq Llama-3.1-8b provides sub-second generation speeds without requiring local GPU infrastructure, but introduces an external internet dependency. Mitigated by the deterministic rule-based fallback engine.
- **Local Embedded ChromaDB Scalability**: Embedded ChromaDB operates efficiently for thousands of policy documents but requires transitioning to a distributed vector service (e.g., Qdrant or Milvus) if policy catalogs reach millions of chunks.

---

## 32. Current System Limitations & Defensible Scope Boundaries

1. **Synthetic Training Dataset**: The model is trained on 1,470 synthetic employee records generated via `dataset-generator/` with realistic corporate distributions, rather than actual private enterprise HR data or the public IBM Kaggle dataset (though the schema is compatible).
2. **CatBoost Wheel Availability on Windows Python 3.13**: Pre-compiled CatBoost wheels are not published for Python 3.13 on Windows; model training and inference gracefully fall back to XGBoost, LightGBM, and Logistic Regression.
3. **Single Active Model Bundle**: The prediction service serves one active model bundle (`attrition_model.joblib`) from `/app/models/active` at any given time.
4. **Stripe Billing Phase 2 Scope**: In `server/src/models/Organization.js`, fields for `stripeCustomerId` and `stripeSubscriptionId` exist, but automated credit card checkout and billing webhook processing are scheduled for Phase 2.
5. **No End-to-End Browser Testing**: Browser-level Playwright tests were intentionally omitted to prevent container runner instability and avoid heavy headless browser binary overhead in CI.

---

## 33. Technical Debt, Known Issues & Product Roadmap

- **Legacy Collection Pluralization Migration**: Handled cleanly at startup by `migrate_prediction_history_collection()`, but legacy pre-seeded collections (`predictionHistory`) should be retired.
- **Aggregation Pipeline Optimization**: Optimize `.populate()` joins in `employeeService.js` and `analyticsService.js` using lean projection pipelines to improve concurrent read throughput.
- **Phase 2 Planned Features**: Automated Stripe subscription billing webhooks, real-time Slack/Teams alert notifications, and multi-model A/B canary routing in production.

---

## 34. Critical Constants, Thresholds & Default Parameters

- `JWT_ACCESS_TTL`: `15m` (15 minutes).
- `JWT_REFRESH_TTL`: `7d` (7 days).
- `BCRYPT_SALT_ROUNDS`: `12`.
- `ML_DECISION_THRESHOLD`: `0.15` (optimized for $F_2$ score and 89.12% recall).
- `RAG_MIN_RELEVANCE_SCORE`: `0.15` (hard gate for LLM generation).
- `RAG_CHUNK_SIZE`: `500` characters; `RAG_CHUNK_OVERLAP`: `50` characters.
- `STARTUP_STEP_TIMEOUT_SECONDS`: `60` seconds.
- `MONGO_CONNECTION_POOL_SIZE`: `maxPoolSize: 20`.

---

## 35. Complete System Dependency & Invocation Map

```
React SPA Component (28 Views)
    ↓ Axios API Client (with Bearer JWT)
Express Middleware Pipeline (requestId → auth → rbac → tenancy → sanitize)
    ↓ Route Handlers (197 Endpoints across 31 Router Files)
Express Controllers (32 Business Controllers)
    ↓ Services & Mongoose Models (45 Schemas) → MongoDB 7.0 Cluster
    ↓ (For Specialized AI Operations)
HTTP Proxy Request (Authorization: Bearer AI_SERVICE_TOKEN)
    ↓ FastAPI Application (59 Endpoints across 11 Router Files)
    ├→ PredictionService (Calibrated Logistic Regression v2.0)
    ├→ ShapExplainerCache (Tree / Linear Explainer)
    ├→ ChromaDB Vector Store (Dense all-MiniLM-L6-v2 + Sparse BM25 + RRF)
    ├→ NLP Transformers (Emotion & Sentiment Pipelines)
    └→ LangGraph 8-Node Graph (AgentState) → Groq LLM API (Llama 3.1 8B)
```

---

## 36. Runtime Execution Sequences

### Single Employee Attrition Prediction & Intervention Synthesis
1. An HR manager navigates to an employee's profile and clicks *"Generate Retention Plan"*.
2. The React client issues `POST /api/v1/decisions/recommend` with `{ employeeId }` and Bearer JWT token.
3. Express verifies JWT claims, confirms the user has `intervention.write` permission, derives `organizationId`, and forwards the request to FastAPI.
4. FastAPI validates that the employee belongs to the calling organization.
5. The LangGraph state machine initiates:
   - Node 1 validates context.
   - Node 2 computes a calibrated attrition risk score ($P(\text{attrition}) = 0.78 \rightarrow \text{HIGH RISK}$).
   - Node 3 extracts SHAP drivers (e.g., $+0.32$ overtime hours, $+0.21$ promotion stagnation).
   - Node 4 enriches employee timeline and sentiment notes.
   - Node 5 executes hybrid search in ChromaDB, retrieving the company's *"Work-Life Balance & Overtime Policy"* and *"Internal Career Mobility Guidelines"*.
   - Node 6 calls Groq LLM, synthesizing a personalized intervention plan with structured action items.
   - Node 7 validates that proposed actions match company policy citations and budget limits.
   - Node 8 assembles the final payload and logs the execution trace.
6. FastAPI persists the recommendation to `decisions` and returns structured JSON to Express.
7. Express writes an entry to `AuditLog` and sends HTTP 200 to the browser.
8. The React client renders the strategy card with cost estimates, SLA countdown, and verified policy citations.

---

## 37. Technical Interview Preparation & Defense Guide

### 30-Second Elevator Pitch
"RetentionAI is an enterprise SaaS platform that predicts employee turnover and generates personalized, policy-compliant retention strategies. It combines calibrated machine learning (PR-AUC 0.6847, 89.12% recall) for risk scoring, SHAP for feature attribution, hybrid RAG (dense vector + BM25) for company policy retrieval, and an 8-node LangGraph autonomous agent that synthesizes actionable HR retention plans with cost and SLA tracking."

### 1-Minute Technical Summary
"RetentionAI is a multi-tenant platform featuring a React 18 SPA, a Node.js/Express REST gateway, and a Python FastAPI AI microservice backed by MongoDB 7 and ChromaDB. The Node gateway handles authentication via HS256 JWTs and hashed refresh tokens, RBAC across 9 roles, and query scoping across 45 collections. When retention actions are requested, the gateway delegates to the FastAPI microservice. FastAPI runs inference through a calibrated Logistic Regression model, extracts local SHAP feature attributions, and executes an 8-node LangGraph workflow that retrieves tenant-isolated HR policies and leverages Groq's Llama 3.1 8B LLM to generate actionable, policy-grounded intervention strategies."

### Key Technical Challenges & Engineered Solutions
- **Startup Hanging in Asynchronous Workers**: PyTorch and HuggingFace startup routines blocked the async event loop checking remote revisions. *Solution*: Enforced `AI_MODELS_OFFLINE=true` / `HF_HUB_OFFLINE=1` and wrapped model loading in `asyncio.to_thread` with explicit 60-second timeouts.
- **Cross-Tenant Vector Data Leaks**: Multi-tenant vector retrieval risked leaking policies across organizations. *Solution*: Applied strict metadata filtering in ChromaDB (`organizationId == req.auth.organizationId`) paired with an in-code assertion asserting document ownership before prompt construction.
- **LLM Hallucinations in HR Policies**: LLMs generating fabricated compensation or leave policies could create legal liability. *Solution*: Implemented a hard relevance gate ($0.15$). If no retrieved policy chunks exceed this threshold, the LLM is bypassed, returning a deterministic standard message.
- **Data Leakage in Attrition Modeling**: Median imputation and feature scaling applied before splitting causes data leakage. *Solution*: Implemented strict 3-way stratified splitting (Train 70%, Val 15%, Test 15%) where imputers and scalers are fitted exclusively on training partitions, verified by 9 dedicated automated leakage tests.

---

## 38. Definitive Architectural Q&A Reference

- **Q: How does RetentionAI enforce multi-tenant isolation?**
  *A*: Tenant identity (`organizationId`) is bound strictly by the server from verified JWT access tokens. Every database query, ChromaDB vector filter, and LangGraph agent node enforces this boundary. Cross-tenant access attempts fail closed with HTTP 404 (see [Figure 7](#figure-7-multi-tenant-security--isolation-model)).
- **Q: Why was Logistic Regression selected over CatBoost as the champion model?**
  *A*: After benchmarking 5 candidate model families, Calibrated Logistic Regression achieved the highest cross-validated PR-AUC (0.6847 vs 0.1960 baseline, +48.87% lift) with superior calibration (Brier score: 0.0980) and 89.12% recall at threshold 0.15, while offering instant sub-millisecond inference and broad platform portability.
- **Q: What are the 8 nodes of the LangGraph agent?**
  *A*: 1. `context_validation`, 2. `ml_risk`, 3. `explainability`, 4. `employee_context`, 5. `rag_policy`, 6. `retention_strategy`, 7. `decision_validation`, 8. `final_decision` (see [Figure 6](#figure-6-8-node-langgraph-retention-decision-workflow)).
- **Q: How does the hybrid RAG retrieval pipeline work?**
  *A*: Queries are executed concurrently against ChromaDB using dense SentenceTransformers (`all-MiniLM-L6-v2`) and sparse BM25, fused via Reciprocal Rank Fusion ($k=60$), filtered by `organizationId`, and gated at a minimum relevance score of $0.15$ before LLM prompt construction (see [Figure 5](#figure-5-hybrid-rag-policy-retrieval-architecture)).
- **Q: How are refresh tokens protected against replay attacks?**
  *A*: Refresh tokens are opaque 384-bit CSPRNG strings stored only as HMAC-SHA-256 hashes with a `familyId`. When a token is refreshed, it is revoked and rotated. If a revoked token is ever presented again, the system invalidates the entire token family, forcing re-authentication (see [Figure 8](#figure-8-authentication-token-rotation--replay-protection)).

---

## 39. Source-of-Truth Verification Rules

1. **Repository Source Code Primacy**: The actual implementation in code is the primary source of truth. Documentation reflects implementation, not aspirations.
2. **Metric Integrity**: Every metric cited in this document is derived from source code analysis, live database inspection, model reports (`models/active/manifest.json`), or automated test runner execution (`pytest`, `node --test`, `vitest`). Numbers are never fabricated.
3. **Clear Distinction of Status**:
   - **Verified Live Numbers**: Code-inspected counts (256 API endpoints, 45 Mongoose schemas, 9 RBAC roles, 8 LangGraph nodes, 28 page views, 167 PyTest passing tests, 172 req/s peak benchmark).
   - **Synthetic Dataset**: The 1,470 employee records are generated via `dataset-generator/` for demonstration, not real corporate employee PII.
   - **Optional Features**: Redis caching is an optional enhancement; in-memory fallback is active by default.
   - **Phase 2 Scope**: Stripe billing integration fields exist in database models, but full billing webhooks are scheduled for Phase 2.
4. **Secret Confidentiality**: Real secrets, API keys, and credentials are never stored in documentation; safe generic placeholders are used exclusively.

---

## 40. Document Metadata & Conclusion

RetentionAI is a production-engineered, multi-tenant enterprise retention intelligence platform. By uniting calibrated machine learning, SHAP explainable AI, transformer-based NLP, hybrid dense/sparse RAG policy retrieval, and an 8-node LangGraph decision engine, it delivers an end-to-end operational workflow from turnover risk detection to transparent, policy-grounded retention intervention.

- **Document Version**: `2.0.0`
- **Last Verified**: `2026-10-22`
- **Target Platform**: Node.js 18+ / Python 3.10+ / MongoDB 7.0 / React 18
