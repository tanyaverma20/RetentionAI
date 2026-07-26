# System Design Document (SDD): RetentionAI

**Purpose.** This document defines the pre-implementation architecture for RetentionAI, a startup-quality HR analytics MVP. It is aligned to the approved SRS. It intentionally contains no source code, API endpoint definitions, database schemas, or implementation-level folder tree.

## 1. Overall Architecture

RetentionAI uses a modular monolith for product workflows and one separate Python AI service for specialised computation. React delivers the user experience; Express is the trusted business and authorization layer; MongoDB Atlas stores application records; Python provides ML, SHAP, NLP, RAG, and controlled agent functionality. Groq/Llama is called only by the Python service. ChromaDB is private to the Python RAG layer.

```text
                         Authorized Users
                                |
                                v
                 +-----------------------------+
                 | React Frontend (Vercel)     |
                 | UI, state, charts, forms    |
                 +-------------+---------------+
                               | HTTPS + JWT
                               v
                 +-----------------------------+
                 | Express Backend (Render)    |
                 | modular monolith            |
                 +-------+-----------------+---+
                         |                 |
                         v                 v
              +----------------+  +--------------------------+
              | MongoDB Atlas  |  | Python AI Service        |
              | product data   |  | private internal service |
              +----------------+  +---+---------+--------+---+
                                     |         |        |
                                     v         v        v
                              ML + Joblib    SHAP/NLP  ChromaDB
                                                         |
                                                         v
                                                   Groq / Llama
```

```text
Business path:  React --> Express --> MongoDB --> React
AI path:        React --> Express --> Python AI --> Express --> React
Knowledge path: Document --> Express --> Python ingestion --> ChromaDB
Chat path:      React --> Express --> Python retrieval/agent --> Groq --> cited response
```

### Design Principles

- One Express application owns all product business capabilities; it is not split into microservices.
- The Python service has a narrow, private AI responsibility and is never directly callable from the browser.
- Express is the sole authority for identity, RBAC, department scope, audit events, and durable application state.
- AI functionality is advisory, evidence-based, and human-reviewed; it cannot make or execute employment decisions.
- The MVP uses managed deployment services and avoids Kubernetes, Kafka, distributed event systems, and complex operations.

## 2. Component Breakdown

| Component | Purpose | Responsibilities | Inputs / outputs | Dependencies | Failure scenarios |
|---|---|---|---|---|---|
| React frontend | Deliver responsive, role-aware product experience. | Pages, forms, charts, route guards, client state, feedback states. | Input: interactions and backend data. Output: authenticated requests and visual presentation. | React, Tailwind, Redux Toolkit, Router, Axios, Recharts, React Hook Form, Zod. | Network loss, expired session, malformed backend response, chart/data empty state. |
| Express backend | Trusted application gateway and modular monolith. | Authentication, RBAC, validation, business rules, persistence orchestration, reports, audit logs, AI coordination. | Input: HTTPS requests. Output: scoped data, status, exports, structured errors. | Express, JWT, bcrypt, Mongoose, Multer, dotenv, MongoDB, Python service. | Dependency timeout, validation error, DB failure, AI-service error, unauthorized request. |
| MongoDB Atlas | Persist application and workflow records. | Store HR records, prediction/intervention history, document metadata, settings, notifications, and audit records. | Input: scoped Mongoose operations. Output: persistent queried data. | Atlas, Mongoose, backups/access controls. | Unavailable cluster, slow query, connection exhaustion, backup/restore need. |
| Python AI service | Compute AI outputs behind Express. | ML prediction, SHAP, NLP, ingestion, embeddings, retrieval, prompts, agent execution. | Input: authorized internal request/context. Output: validated AI result/status. | Python, Pandas, NumPy, scikit-learn, XGBoost, Joblib, SHAP, LangChain, Groq, ChromaDB. | Invalid features, missing artifact, model error, vector/LLM outage, processing timeout. |
| ML service | Predict attrition risk. | Train/approve/load versioned model, preprocess data, infer probability/category. | Input: approved features. Output: risk, confidence, model version. | Model artifact, preprocessor, Joblib. | Feature mismatch, artifact missing/corrupt, low-quality input. |
| Explainability | Make risk outputs interpretable. | Generate local and global SHAP views and readable factor summaries. | Input: model, transformed feature values. Output: ranked contributors. | SHAP, model/preprocessor. | Unsupported model state, explanation computation failure. |
| NLP | Analyze permitted employee text. | Normalize text; score sentiment; classify approved concern signals. | Input: authorized feedback/survey text. Output: sentiment, concern labels, confidence, review flag. | VADER, DistilBERT. | Unsupported language/content, model unavailable, low-confidence classification. |
| RAG | Answer from approved internal documents. | Parse, clean, chunk, embed, retrieve, construct grounded context, cite sources. | Input: documents/questions/scope. Output: chunks, retrieved evidence, cited answer. | LangChain, Sentence Transformers, ChromaDB, Groq. | Parse failure, empty retrieval, vector store unavailable, LLM failure. |
| Agent | Produce controlled retention briefings. | Select only registered read-only tools, evaluate evidence, create guarded synthesis. | Input: scoped user request/tool outputs. Output: recommendations, rationale, citations, uncertainty. | LangChain Agent, RAG, ML/SHAP data, Groq. | Tool error, insufficient evidence, unsafe request, LLM failure. |
| Groq/Llama | Generate grounded natural-language text. | Generate only from bounded prompts/context. | Input: constructed prompt. Output: generated text. | Groq API, network/API key. | Rate limit, timeout, outage, unsafe/unusable response. |
| Document storage | Retain uploaded source files according to policy. | Store original documents and provide reference for controlled processing. | Input: validated upload. Output: secure file reference. | Multer, managed/object/local development storage. | Unsafe file, storage error, unavailable source file. |

## 3. Frontend Architecture

### Pages

The frontend includes login/password recovery; overview dashboard; employee directory and risk profile; department analytics; attendance/performance; surveys and feedback; import centre; predictions; interventions; AI retention advisor; knowledge base; reports; notifications; profile/settings; and administrator user/role/audit views. The navigation shown to each user is driven by their permitted role and scope.

### Shared and Reusable Components

The UI uses a common application shell, navigation, page header, filter bar, protected-page wrapper, data table, pagination control, status/risk badge, form inputs, upload control, modal/confirmation dialog, empty/loading/error state, chart container, citation panel, intervention card, and notification item. This produces consistent interaction, accessibility, and error handling across pages.

### Redux Store and State Management

Redux Toolkit stores session identity, role/permissions, route-level asynchronous status, notifications, user preferences, and reusable filter state. Server data remains authoritative in Express/MongoDB and is refreshed after mutating workflows. Form-local and display-only state remains in components to avoid global-state overuse.

### Routing, Authentication, and Protected Routes

React Router separates public, authenticated, and role-protected routes. The client route guard redirects unauthenticated users to login and prevents inaccessible navigation. It improves user experience only; Express independently verifies JWT, role, and data scope on every protected operation.

### Axios Layer, Charts, and Responsibilities

The Axios layer centralizes base URL configuration, JWT attachment, response normalization, token-expiry handling, and safe error conversion. Recharts renders KPI, trend, distribution, and comparison charts from backend aggregates. Frontend responsibilities are organised by business capability—authentication, employee data, analytics, prediction, intervention, knowledge base, reports, and administration—rather than by technical feature alone.

## 4. Backend Architecture

### Logical Modules and Responsibilities

| Backend responsibility | Design role |
|---|---|
| Routes | Associate approved application operations with controller entry points and appropriate middleware. |
| Controllers | Translate validated request context into service invocation and standardized success response. |
| Services | Enforce business lifecycle rules, ownership, scope, workflow sequencing, AI orchestration, and audit obligations. |
| Data access | Encapsulate Mongoose persistence and role-scoped queries. |
| Middleware | Apply request IDs, security settings, rate limits, authentication, authorization, upload controls, validation, logging, and errors. |
| Validation | Reject malformed requests/files and invalid business input before persistence or AI work. |
| Utilities | Configuration loading, response formatting, safe logging, reporting helpers, and shared date/status rules. |

### Authentication, Authorization, and Middleware Order

```text
Request
  -> request ID / safe logging / security headers / CORS / body handling
  -> rate limit
  -> JWT authentication (when protected)
  -> RBAC and department/resource scope check
  -> Zod request and file validation
  -> controller -> service -> data / AI dependency
  -> audit where required
  -> standardized response or centralized error handler
```

JWT confirms identity and session validity; RBAC confirms allowed capability; department/resource checks ensure a Department Manager cannot access another department. Services, not controllers, contain decisions such as who can assign an intervention, when a prediction may be run, and which fields may appear in an export.

### Configuration, Logging, and Error Handling

Configuration is supplied through environment variables and validated at startup. Logs include request/correlation IDs, safe diagnostic information, and audit events for sensitive user actions. Centralized error handling categorizes validation, authentication, authorization, not-found, conflict, dependency, timeout, and unexpected errors. It never returns secrets, stack traces, model internals, or protected-record details to the client.

## 5. Python AI Service

### Internal Responsibilities

| AI-service responsibility | Design role |
|---|---|
| Training | Prepare approved labelled historical data, compare candidates, evaluate, produce an approval-ready model artifact. |
| Preprocessing and feature engineering | Apply documented cleaning, encoding, scaling, and derived-feature logic consistently in training and inference. |
| Model loader/prediction | Load the active preprocessor/model pair, validate inputs, produce versioned risk output. |
| SHAP | Produce local employee-factor contributions and global aggregate feature importance. |
| NLP | Clean permitted text, use VADER sentiment and DistilBERT concern classification, return confidence/review signals. |
| Embeddings | Generate Sentence Transformer vectors for approved document chunks. |
| Retriever | Retrieve relevant ChromaDB chunks subject to category and authorization metadata passed by Express. |
| Prompt builder | Construct minimal context, citation metadata, role constraints, and grounding instructions. |
| Agent | Maintain scoped state, choose registered tools, compose evidence-based advisor outputs. |
| Utilities | Safe configuration, structured results, correlation logging, health status, timeout handling. |

### Model Lifecycle

The training module uses approved historical data, removes leakage, performs feature engineering/selection, uses a stratified train/test process, evaluates candidate models, and serializes the approved model plus matching preprocessor using Joblib. Model metadata identifies version, algorithm, feature list, training date, metrics, and approval status. Retraining is deliberate: sufficient new labelled data or evidence of drift creates a candidate model that must be evaluated and approved before activation.

### AI-Service Responsibility Boundaries

Python does not authenticate browser users, own business permissions, or make durable HR workflow decisions. Express provides an already-authorized, minimal request context. The AI service never writes directly to the product database; Express validates and persists any returned result.

## 6. Communication Between Services

### React ↔ Express

```text
User action -> React validation -> Axios HTTPS request with JWT
 -> Express identity/RBAC/scope/validation -> business service
 -> role-safe response/error -> Redux/page state -> UI feedback
```

### Express ↔ MongoDB

Express domain services use Mongoose for scoped reads/writes. Query filters contain the requester’s allowed organization/department/resource scope. MongoDB accepts no direct browser connections.

### Express ↔ Python AI Service

Express sends a private, authenticated internal request carrying a correlation ID, task type, and minimum permitted data. Python returns a structured result or dependency error. Express checks the response, persists allowed history/audit records, and returns the appropriate summary to React.

### Python ↔ ChromaDB and Groq

Python writes embeddings/chunk metadata during ingestion and reads scoped semantic matches during retrieval. It then builds a constrained prompt and calls Groq. Groq receives only the question and relevant context; it does not receive database credentials or direct access to MongoDB/ChromaDB.

### Agent ↔ Tools

The agent accesses a tool registry containing only employee risk summary, SHAP summary, department aggregates, intervention history, policy retrieval, and evidence formatting. Each tool is read-only and requires scope metadata. Tool selection is dynamic only among that registry.

## 7. Complete AI Workflow

```text
Authorized Employee Data
        |
        v
Feature completeness checks and preprocessing
        |
        v
ML model prediction --> probability, category, confidence, version
        |
        v
SHAP local explanation --> ranked increasing/reducing factors
        |
        +---- NLP on permitted feedback/survey text --> sentiment and concern signals
        |                                                |
        +------------------------------------------------+
                                                         v
                     Agent receives only approved evidence and user scope
                                                         |
                                                         v
                  RAG retrieves relevant approved policy/document context
                                                         |
                                                         v
                     Prompt builder sends grounded context to Groq/Llama
                                                         |
                                                         v
            Guarded retention recommendation + citations + human-review notice
                                                         |
                                                         v
                 Express stores permitted results --> role-scoped dashboard
```

1. Express retrieves authorized current employee data and checks readiness.
2. Python applies the same persisted feature transformations used in training.
3. The model returns risk information; SHAP exposes the major factor contributions.
4. Permitted textual feedback is separately analyzed for sentiment/concerns; NLP signals remain advisory and non-clinical.
5. For an advisor request, the agent retrieves relevant risk, explanation, intervention, department, and policy evidence.
6. RAG supplies grounded policy context; Groq/Llama creates a draft only from bounded instructions and evidence.
7. The final output includes citations, uncertainty where applicable, and a human-review warning. It never executes an HR decision.

## 8. RAG Architecture

```text
Approved document upload
          |
          v
Express validates role, type, size, category --> document storage + processing record
          |
          v
Python parsing -> text cleaning -> recursive chunking + source/page metadata
          |
          v
Sentence Transformer embeddings -> ChromaDB vector storage

Authorized user question -> Express role/scope check -> Python retriever
                                                        |
                                                        v
                                      relevant approved chunks + citations
                                                        |
                                                        v
                                  context builder + grounding instructions
                                                        |
                                                        v
                                             Groq / Llama response
                                                        |
                                                        v
                              cited answer / insufficient-evidence response
```

### RAG Design

- **Document upload:** only authorized administrators may add supported knowledge-base documents.
- **Parsing and cleaning:** extract usable text, normalize formatting, retain document/page/section provenance, and mark failed documents unavailable.
- **Chunking:** recursive splitting maintains semantic continuity, bounded context size, overlap, and traceable metadata.
- **Embeddings/vector storage:** Sentence Transformers represents chunks; ChromaDB stores vectors with source and authorization metadata.
- **Retrieval:** semantic retrieval is filtered by approved document category and scope; low-relevance results do not become authoritative context.
- **Prompt construction/grounding:** prompts require answers to use retrieved evidence, cite sources, avoid inventing policy, and acknowledge uncertainty.
- **Response/citation:** output exposes source title and relevant location where available.
- **Hallucination prevention:** use relevance thresholds, answer-with-insufficient-evidence fallback, citation requirement, input isolation, and no direct model-memory policy claims.

## 9. Agent Architecture

The Retention Advisor is a controlled LangChain agent for research and recommendation drafting. It has no general database/network access and performs no write action.

### Tool Registry

| Registered tool | Output |
|---|---|
| Employee risk summary | Current authorized risk status and safe employee context. |
| SHAP summary | Ranked contributing/reducing risk factors. |
| Department aggregate | Scope-safe trend and aggregate context, not unrelated employee data. |
| Intervention history | Existing action status and outcomes. |
| Policy retriever | Relevant approved RAG chunks and citation metadata. |
| Evidence formatter | Validates that recommendation claims map to tool evidence. |

```text
Authorized advisor request
          |
          v
Initialize state: user role, department scope, target, intent, correlation ID
          |
          v
Determine evidence gap --> dynamically select registered read-only tool
          |                                      |
          |                                      v
          |                          validate tool scope and retrieve result
          +<-------------------------------------+
          |
          v
Sufficient evidence? -- no --> transparent limitation / safe next step
          |
         yes
          |
          v
Grounded draft -> evidence/citation/guardrail check -> human-review output
```

Agent state retains only the active task, allowed scope, tool outputs, citations, uncertainty state, and review flags. Tool failure triggers a partial or unavailable-evidence response; it never causes invented information. Guardrails refuse discriminatory requests, unsupported policy claims, and requests to decide or execute termination/promotion/compensation outcomes.

## 10. Data Flow

### Login

```text
User -> React login form -> Express validation -> MongoDB user lookup
     -> password verification -> JWT + permitted profile -> protected dashboard
```

### Employee CRUD and CSV Upload

```text
Authorized HR request -> Express RBAC/scope/validation -> domain service
                     -> MongoDB update -> audit log -> refreshed role-scoped UI

CSV -> upload validation -> row/reference checks -> import result/status
    -> approved persistence -> audit log -> optional batch-prediction request
```

### Prediction and Dashboard

```text
Prediction request -> Express scope/data checks -> Python model + SHAP
                  -> validated result -> MongoDB prediction history -> risk profile

Dashboard filter -> Express role-scoped aggregation/query -> MongoDB -> chart/table payload -> React/Recharts
```

### AI Chat and Document Upload

```text
AI chat -> Express authorization -> Python agent/RAG -> ChromaDB -> Groq
        -> cited/guarded answer -> Express history/audit -> React

Document upload -> Express file checks/storage/status -> Python parse/chunk/embed
                -> ChromaDB -> status update -> knowledge-base UI
```

### Report Generation and Intervention Tracking

```text
Report criteria -> Express scope check -> permitted aggregation -> export result

Intervention create/update -> validation and ownership check -> MongoDB
                          -> audit + notification -> assigned-user work queue
```

## 11. Sequence Diagrams

### Login

```text
User -> React: submit credentials
React -> Express: authenticated login request
Express -> MongoDB: find user
MongoDB -> Express: account data
Express -> Express: verify password/status
Express -> React: JWT and allowed profile
React -> User: dashboard
```

### Prediction

```text
HR User -> React: request prediction
React -> Express: JWT request
Express -> MongoDB: retrieve scoped employee data
Express -> Python: approved feature request + correlation ID
Python -> Python: preprocess, infer, SHAP
Python -> Express: risk/explanation/model metadata
Express -> MongoDB: persist history and audit event
Express -> React: permitted result
```

### Chat

```text
HR User -> React: submit question
React -> Express: scoped chat request
Express -> Python: authorized agent/RAG request
Python -> ChromaDB: semantic retrieval
Python -> Groq: grounded prompt
Groq -> Python: generated draft
Python -> Express: cited guarded result
Express -> MongoDB: permitted conversation/audit record
Express -> React: response and citations
```

### Document Upload

```text
Admin -> React: select document
React -> Express: multipart upload
Express -> storage: save approved source
Express -> MongoDB: processing record
Express -> Python: ingestion job
Python -> ChromaDB: embed source chunks
Python -> Express: status
Express -> MongoDB: update status/audit
Express -> React: processing outcome
```

## 12. Failure Handling

| Scenario | Handling |
|---|---|
| Backend unavailable | Frontend shows service-unavailable state and retry guidance; no client-side bypass exists. |
| Database unavailable | Express returns a safe dependency error, blocks unsafe mutation, logs correlation ID, and preserves retryability. |
| Python service unavailable | Core directory/dashboard workflows remain available where possible; prediction/chat jobs report unavailable/failed without fabricated output. |
| Groq unavailable | RAG/agent output reports AI-generation unavailability; existing predictions and stored citations remain accessible. |
| Vector DB unavailable | Disable retrieval for the request and clearly state no policy evidence can be retrieved; do not answer policy questions from unsupported memory. |
| Prediction failure | Store failed job/status and diagnostics; do not overwrite historical prediction or show a risk result. |
| Invalid CSV | Reject invalid file/rows before commit; present row-level summary for correction. |
| Unauthorized user | Return generic unauthenticated/forbidden response; record safe audit/security event without exposing resource details. |
| Timeout | Apply bounded timeout and correlation ID to Python/Groq/storage calls; return pending/retry/error status according to whether operation is safely resumable. |

## 13. Deployment Architecture

```text
Internet users
   |
 HTTPS
   v
Vercel: React static frontend
   |
 HTTPS, CORS restricted to frontend origin
   v
Render: Express backend  <------ private authenticated traffic ------> Render: Python AI service
   |                                                                     |
 TLS                                                                 TLS/API key
   v                                                                     v
MongoDB Atlas                                                     ChromaDB + Groq
   |
backup/access policy
```

- **Frontend:** Vercel hosts the production React build and environment-specific backend base URL.
- **Backend:** Render hosts Express; it exposes only required public HTTPS operations, applies CORS to the frontend origin, and holds JWT/database/AI-service configuration.
- **Python service:** Render hosts the AI service separately; it should accept requests only from the Express backend using a service credential and network restrictions available to the deployment plan.
- **Database:** MongoDB Atlas uses restricted network access, database credentials with least privilege, backups, and monitored connection limits.
- **Vector database:** ChromaDB is treated as an internal AI dependency; access is not exposed to browsers.
- **Document storage:** store source documents outside public web paths, using a managed storage provider when production scale requires it.
- **Environment variables and secrets:** configure database URI, JWT secret, service-auth token, Groq key, storage credentials, allowed origins, and model/vector configuration through provider secret stores. Do not commit or render these values to clients.

## 14. Scalability Plan

The MVP starts small, but its boundaries allow incremental growth without redesign.

| Future capability | Evolution path |
|---|---|
| Docker | Package the Express and Python services as containers while preserving their private request contract; use Docker Compose for repeatable local environments. |
| Redis | Add for rate-limit counters, short-lived job status, cacheable dashboard aggregates, or queue coordination; MongoDB stays system of record. |
| CI/CD | Add automated lint/test/build, deployment, environment promotion, and health-check stages around the existing services. |
| Caching | Cache safe, aggregate dashboard data and repeated retrieval embeddings; never cache sensitive individual data without scoped keys and expiry. |
| Monitoring | Add health checks, latency/error metrics, structured logs, AI dependency status, and alert thresholds. |
| Cloud storage | Replace temporary/local document storage through the existing storage abstraction with S3/Azure Blob/Cloudinary-compatible managed storage. |
| Higher AI workload | Independently scale the Python service, use bounded background jobs for ingestion/batch prediction, and reuse loaded model/embedding resources. |

## 15. Architecture Decisions

| Decision | Why selected | Why alternatives are not the MVP choice |
|---|---|---|
| React + JavaScript | Fast, familiar UI development with rich charts/forms and broad portfolio relevance. | A heavier frontend framework adds little for the defined MVP. |
| Express over NestJS | Minimal learning/boilerplate, clear modularity, and fast delivery for one developer/team. | NestJS offers stronger convention but adds structure and learning cost beyond MVP needs. |
| MongoDB Atlas over PostgreSQL | Fits document-oriented HR records, flexible survey/feedback/document metadata, and simple managed deployment with Mongoose. | PostgreSQL is strong for relational reporting but needs more upfront schema/migration design than the MVP requires. |
| Separate Python AI service | Uses the native ecosystem for Pandas, scikit-learn, XGBoost, SHAP, and NLP without complicating Express. | Doing ML in Node reduces library maturity; multiple AI microservices add operational overhead. |
| XGBoost as leading candidate over Random Forest | Often provides strong tabular classification accuracy and handles nonlinear feature interaction effectively. | Random Forest remains a benchmark candidate but may be less performant/tunable for the chosen data; selection remains evidence-based after evaluation. |
| SHAP | Provides well-understood local and global explanations needed for transparent HR decision support. | Raw feature importance is insufficient for individual explanations; opaque explanations weaken trust. |
| LangChain | Provides pragmatic RAG, prompt, retriever, and controlled-agent composition for an educational MVP. | Fully custom orchestration increases build time; unconstrained autonomous agent frameworks conflict with safety needs. |
| ChromaDB | Simple local/deployable vector store for a modest document corpus and student project. | Managed vector services add cost/operational accounts before scale justifies them. |
| Groq + Llama | Fast hosted inference and accessible model integration suitable for an MVP demo. | Self-hosted LLMs require infrastructure; direct model memory without RAG is unsuitable for policy-grounded answers. |
| Vercel + Render + Atlas | Managed deployment minimizes DevOps while clearly separating frontend, backend, AI, and storage responsibilities. | Kubernetes/complex cloud infrastructure is disproportionate to project scale. |

## 16. Architecture Summary

RetentionAI is simple because it limits the product to a React client, one Express modular monolith, MongoDB Atlas, and one Python AI service. It is maintainable because business, data, and AI responsibilities have clear boundaries and communicate through narrow, validated contracts. It is modular because features are organised by product capability while shared authorization, validation, logging, and error handling remain centralized.

It is placement- and portfolio-worthy because it demonstrates secure full-stack architecture, practical ML, explainability, NLP, grounded RAG, and a responsibly constrained agent. It is hackathon-friendly because its core demo path is coherent: import data, predict risk, explain factors, retrieve policy, and produce a cited retention recommendation. It is suitable for one developer because it avoids infrastructure that does not directly improve the MVP. Finally, its service and abstraction boundaries leave room for Docker, Redis, CI/CD, monitoring, managed storage, and scale-up later without forcing a redesign.

**Governance principle:** Every risk score, NLP signal, retrieved policy answer, and AI recommendation is decision support for authorized human reviewers. RetentionAI must not autonomously determine or execute an employee outcome.
