# Software Requirements Specification (SRS)

## RetentionAI

**Document purpose:** Define the product requirements, boundaries, AI behaviour, and high-level architecture for a final-year engineering MVP. This document is implementation-neutral: it does not prescribe database schemas, endpoints, or code.

## 1. Executive Summary

### Problem

Employee attrition is costly and difficult to identify early. HR teams commonly work with disconnected employee, attendance, performance, survey, and feedback data. They lack a consolidated, explainable way to identify employees who may need support and to connect retention actions with company policies.

### Solution

RetentionAI is a role-based Human Resource Analytics platform that predicts employee attrition risk from historical and current HR data. It combines supervised machine learning, SHAP explanations, NLP analysis of employee feedback, a policy-grounded RAG assistant, and a controlled AI advisor that recommends retention actions for human review.

### Target Users

System Administrators, HR Administrators, HR Managers, Department Managers, HR Analysts, and Employees with limited self-service access.

### Business Value

The platform provides earlier visibility into attrition risk, enables structured intervention tracking, reduces manual analysis effort, and makes HR policies easier to consult. It supports—not replaces—HR judgment.

### Project Vision

Deliver a credible, privacy-aware MVP that one student team can build and demonstrate in 6–8 weeks using React, Express, MongoDB, and a Python AI service. The application is a modular system, not a microservices platform.

## 2. Objectives

### 2.1 Functional Objectives

- Maintain employee, department, attendance, performance, survey, and feedback information.
- Import employee data through validated CSV uploads.
- Predict individual and batch attrition risk.
- Explain each prediction and track follow-up interventions.
- Provide dashboards, reports, an HR knowledge base, and a policy-grounded assistant.

### 2.2 Business Objectives

- Help HR prioritize high-risk employees for supportive outreach.
- Provide consistent, auditable retention planning.
- Demonstrate a portfolio-quality HR analytics product with measurable outcomes.

### 2.3 Technical Objectives

- Deliver a responsive React UI, Express API, MongoDB data store, and Python AI service.
- Enforce JWT authentication, RBAC, input validation, and audit logging.
- Deploy the frontend and backend/AI services with Vercel, Render, and MongoDB Atlas.

### 2.4 AI Objectives

- Produce calibrated attrition-risk categories using an evaluated classification model.
- Provide SHAP-based local and global explanations.
- Analyze employee feedback sentiment and concerns.
- Ground generative responses in uploaded HR documents and controlled tool outputs.

### 2.5 Learning Objectives

- Demonstrate full-stack development, model training, explainable AI, NLP, RAG, agent tool calling, secure API design, and cloud deployment.

## 3. Scope

### 3.1 Included Features

- Role-based authentication and administration.
- Employee, department, attendance, performance, survey, and feedback management.
- CSV import with validation and import summary.
- Attrition prediction, risk history, SHAP explanations, and retention recommendations.
- Intervention tracking, dashboards, reports, notifications, audit logs, profile, and settings.
- Knowledge-base document upload, semantic search, RAG chatbot, and controlled retention advisor.

### 3.2 Excluded Features

- Payroll execution, recruiting, benefits administration, and workforce scheduling.
- Direct HRIS/payroll integrations or real-time event streams.
- Automated hiring, firing, promotion, or compensation decisions.
- Mobile native apps, multi-tenant billing, SSO, microservices, Kubernetes, Kafka, RabbitMQ, Elasticsearch, or complex enterprise DevOps.

### 3.3 Future Scope

- HRIS integrations, scheduled data synchronization, multilingual documents, configurable model training, calendar/email integrations, anonymized benchmarking, advanced fairness monitoring, and mobile access.

## 4. User Roles

| Role | Responsibilities and permissions | Allowed pages / modules | Restrictions |
|---|---|---|---|
| System Administrator | Manages accounts, roles, global settings, model status, audit logs, and document governance. | Admin, users, roles, settings, model status, audit logs, all dashboards. | Cannot use AI output as an automated employment decision. |
| HR Administrator | Maintains HR data, departments, policies, and authorized HR users. | Employees, departments, imports, knowledge base, reports, dashboard. | Cannot change system-level roles or platform security settings. |
| HR Manager | Reviews organization risk, employee profiles, interventions, reports, chatbot, and AI advice. | Dashboard, employees, predictions, interventions, reports, assistant. | Cannot manage system users or view raw password/security information. |
| Department Manager | Reviews only assigned department data and owns assigned interventions. | Department dashboard, permitted employee profiles, interventions, assistant. | Cannot see other departments, model settings, or organization-wide sensitive reports. |
| HR Analyst | Imports data, performs analysis, runs authorized predictions, creates reports, and records insights. | Imports, analytics, predictions, reports, permitted employee data. | Cannot manage roles, security settings, or finalize sensitive actions. |
| Employee | Maintains limited profile data, completes surveys, submits feedback, and accesses approved resources. | My profile, surveys, feedback, resources. | Cannot view attrition scores, other employees, interventions, analytics, or model output. |

All API modules shall enforce the same scope as the UI. Page visibility alone is not authorization.

## 5. Complete User Stories

1. As a System Administrator, I want to create and deactivate user accounts so that access remains controlled.
2. As a System Administrator, I want to assign roles so that users have only the permissions they require.
3. As an HR Administrator, I want to create departments and assign managers so that employee ownership is clear.
4. As an HR Analyst, I want to upload a CSV file and see row-level validation issues so that bad data is corrected before import.
5. As an HR Analyst, I want to view the import summary so that I know how many records were created, updated, or rejected.
6. As an HR Manager, I want to view an organization risk overview so that I can prioritize retention work.
7. As an HR Manager, I want to filter risk data by department, role, and period so that I can investigate patterns.
8. As an HR Manager, I want to open an employee risk profile so that I can understand the current risk and supporting factors.
9. As an HR Manager, I want to see SHAP explanations so that predictions are interpretable.
10. As an HR Manager, I want to create a retention intervention so that follow-up actions are tracked.
11. As a Department Manager, I want to view only my department's at-risk employees so that confidentiality boundaries are respected.
12. As a Department Manager, I want to update assigned intervention status so that HR can monitor progress.
13. As an HR Analyst, I want to run a batch prediction after a data import so that dashboards use current data.
14. As an HR Analyst, I want to compare prediction history so that I can identify improving or worsening risk.
15. As an HR Administrator, I want to upload a policy document so that the assistant can use approved internal guidance.
16. As an HR Manager, I want to ask the knowledge assistant a policy question so that I can get a cited answer quickly.
17. As an HR Manager, I want AI-generated retention options for an employee so that I can prepare a human-reviewed action plan.
18. As an HR Manager, I want to rate an AI recommendation so that the team can assess its usefulness.
19. As an HR Analyst, I want to analyze feedback sentiment and concerns so that soft signals contribute to insight.
20. As an Employee, I want to complete a pulse survey so that the organization can collect engagement information.
21. As an Employee, I want to submit confidential feedback so that I can raise concerns through an approved channel.
22. As an HR Manager, I want to download a department report so that I can discuss trends with leadership.
23. As a System Administrator, I want to view audit logs so that sensitive actions can be reviewed.
24. As a user, I want to update my profile and password so that my account remains accurate and secure.
25. As an HR Manager, I want overdue interventions surfaced in notifications so that no agreed action is missed.
26. As an HR Administrator, I want to review document processing status so that only usable documents are available to the RAG assistant.
27. As a System Administrator, I want to view active model metadata and metrics so that prediction quality is transparent.
28. As an HR Analyst, I want to search employees and documents so that I can find information without manual browsing.

## 6. Functional Requirements

### 6.1 Authentication, Authorization, and Role Management

- Users shall authenticate with email and password; passwords shall be securely hashed.
- The system shall issue time-limited JWT access tokens and require authentication for protected features.
- The system shall apply RBAC at both page and API-module level.
- Administrators shall create, activate, deactivate, and assign roles to users.
- Users shall be able to reset a forgotten password through a secure token-based flow.
- Unauthorized and forbidden requests shall receive clear, non-sensitive responses.

### 6.2 Employee and Department Management

- Authorized HR users shall create, view, update, search, filter, and deactivate employee records.
- The application shall maintain department information, department manager assignments, and employee-to-department association.
- Department Managers shall see employees only in their assigned department.
- Employee records shall retain relevant employment, compensation band, engagement, and work-pattern attributes needed for the MVP.

### 6.3 Attendance, Performance, Surveys, and Feedback

- Authorized HR users shall record or import attendance summaries, leave frequency, and absence counts.
- Authorized HR users shall record performance-review summaries, ratings, goals, and review dates.
- Employees shall complete configured pulse surveys; HR users shall analyze aggregate responses.
- Employees shall submit feedback; access to raw feedback shall be limited to authorized HR roles.
- The NLP module shall analyze permitted feedback and survey text for sentiment, burnout signals, and concerns.

### 6.4 Bulk CSV Upload

- The system shall accept documented CSV templates for supported entities.
- It shall validate headers, data types, required values, duplicates, and referential values before committing records.
- It shall present accepted, rejected, and warning rows in an import summary.
- It shall retain an audit record of the uploader, time, file name, and result.

### 6.5 Prediction Engine and History

- Authorized users shall request an individual prediction or a batch prediction.
- The system shall return risk probability, risk category, prediction confidence, model version, and date.
- Prediction results shall be stored as history and shall not overwrite prior runs.
- Batch predictions shall provide status and error visibility.
- A user shall not be able to use the prediction as an automatic personnel decision.

### 6.6 SHAP Explanations and Retention Recommendation Engine

- Each prediction shall expose ranked contributing factors in understandable language.
- The system shall provide global model-insight views for authorized users.
- The recommendation engine shall combine selected employee data, approved risk factors, intervention history, and retrieved policies.
- AI recommendations shall contain rationale, evidence references where available, suggested actions, and a human-review notice.
- Users shall be able to rate or comment on recommendations.

### 6.7 Intervention Tracking, Analytics, Reports, and Notifications

- HR Managers shall create interventions with action type, owner, due date, status, and outcome notes.
- Assigned owners shall update their intervention progress.
- Dashboards shall show organizational and department risk distribution, trend summaries, top factors, intervention status, and key KPIs.
- Authorized users shall generate filtered CSV/PDF reports.
- The system shall notify users in-app about overdue or newly assigned interventions and important import/prediction completion states.

### 6.8 Knowledge Base, RAG Chatbot, Search, Profile, and Settings

- Authorized administrators shall upload, categorize, list, replace, and remove approved HR documents.
- The system shall parse supported documents, display processing status, and prevent failed documents from being used as trusted context.
- The chatbot shall retrieve relevant approved content and return citations with grounded answers.
- Search shall support employee directory search and knowledge-base document search.
- Users shall update their own permitted profile settings and password.
- Administrators shall configure permitted risk thresholds, supported document categories, and notification preferences without changing source code.

### 6.9 Audit Logs

- The system shall audit authentication events, data imports, sensitive record changes, predictions, document actions, interventions, and administrative changes.
- Audit entries shall identify actor, action, affected module/entity, timestamp, and non-sensitive context.

## 7. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Typical dashboards should load within 3 seconds; single predictions within 5 seconds; AI responses within 10 seconds under normal MVP load. |
| Security | HTTPS in production, JWT, bcrypt password hashing, RBAC, Zod validation, rate limiting, input sanitization, and protected secrets. |
| Availability | Target 99% monthly availability for the deployed MVP, excluding planned maintenance and third-party outages. |
| Maintainability | Use clear modular boundaries between React UI, Express business APIs, MongoDB persistence, and Python AI processing. |
| Reliability | Invalid imports and failed AI calls shall not corrupt stored data; retries/errors shall be visible to the user. |
| Scalability | Support a pilot organization dataset (approximately 1,000–10,000 employees) using pagination, filtered queries, and asynchronous batch jobs where needed. |
| Accessibility | Keyboard navigation, sufficient contrast, labels for controls, meaningful errors, and charts not distinguished by color alone. |
| Usability | Responsive desktop/tablet UI, consistent navigation, concise terminology, and actionable empty/error states. |
| Privacy | Minimize data collection, restrict individual risk data, and avoid showing protected attributes in recommendations. |
| Compliance | Support configurable retention/deletion practices; present AI as decision support with human review. Legal compliance requires organization-specific review. |
| Logging | Log application errors and auditable events without storing passwords, tokens, or raw secret values. |
| Error handling | Return validated, user-friendly errors; keep detailed diagnostic context in protected logs. |
| Backup | Use MongoDB Atlas backups or scheduled exports appropriate to the selected deployment tier. |
| Recovery | Document restoration of data, model artifact, environment configuration, and knowledge-base source documents. |

## 8. Complete Machine Learning Pipeline

### 8.1 Pipeline Requirements

1. **Data collection:** collect authorized historical HR, attendance, performance, survey, and attrition-outcome data.
2. **Data cleaning:** resolve duplicates, missing values, inconsistent categories, invalid dates, and outliers using documented rules.
3. **Feature engineering:** calculate tenure, promotion gap, leave frequency, satisfaction aggregates, and other approved derived measures.
4. **Feature selection:** remove leakage, redundant fields, and fields that are not ethically or operationally appropriate.
5. **Train/test split:** use stratified splitting; prevent post-attrition information from entering training inputs.
6. **Training:** compare baseline Logistic Regression with tree-based candidates such as Random Forest or XGBoost.
7. **Evaluation:** calculate precision, recall, F1, ROC-AUC, confusion matrix, and calibration review.
8. **Hyperparameter tuning:** use a bounded cross-validation search on training data only.
9. **Serialization:** save the approved preprocessing pipeline, trained model, metadata, and evaluation metrics with Joblib.
10. **Prediction:** transform current inputs through the same approved pipeline and store a versioned result.
11. **Monitoring:** monitor prediction distribution, missingness, data drift indicators, service errors, and feedback quality.
12. **Retraining:** retrain only with approved, sufficiently complete newer labelled data; compare candidate metrics before activation.

```text
Historical HR Data
        |
        v
Validation and Cleaning --> Feature Engineering --> Feature Selection
        |                                              |
        +----------------------------------------------+
                                                       v
                                             Stratified Train/Test Split
                                                       |
                                                       v
                                      Train + Tune Candidate Classifiers
                                                       |
                                                       v
                              Evaluate, Review Bias/Leakage, Approve Model
                                                       |
                                                       v
                         Serialize Model + Preprocessor + Metadata + Metrics
                                                       |
                                                       v
Current Employee Data --> Same Preprocessing --> Prediction + SHAP Explanation
                                                       |
                                                       v
                                    Monitoring and Approved Retraining Cycle
```

## 9. Input Features

The final feature set shall be approved after data-quality and fairness review. Protected characteristics must not be used to make recommendations; if collected for fairness analysis, they shall be separated from decision features.

| Feature | Purpose | Datatype | Source |
|---|---|---|---|
| Age band | Workforce stage context | Categorical | Employee record |
| Gender (fairness-only) | Bias monitoring, not recommendation | Categorical | Employee record |
| Marital status (optional/fairness review) | Context only if permitted | Categorical | Employee record |
| Education level | Career context | Categorical | Employee record |
| Department | Organizational context | Categorical | Department record |
| Job role | Role-specific patterns | Categorical | Employee record |
| Job level | Seniority context | Integer | Employee record |
| Employment type | Contract context | Categorical | Employee record |
| Location | Workplace context | Categorical | Employee record |
| Tenure months | Length of service | Numeric | Derived from hire date |
| Years in current role | Role stability | Numeric | Employee history |
| Years with current manager | Manager continuity | Numeric | Employee history |
| Years since last promotion | Career progression gap | Numeric | Promotion history |
| Promotion count | Advancement history | Integer | Promotion history |
| Salary band | Compensation context | Categorical | Compensation data |
| Recent salary change | Compensation movement | Numeric | Compensation history |
| Stock/benefit eligibility | Benefits context | Boolean | HR record |
| Overtime frequency | Workload signal | Numeric/Categorical | Attendance/work records |
| Average weekly hours | Workload signal | Numeric | Attendance/work records |
| Remote/hybrid status | Work arrangement | Categorical | Employee record |
| Commute distance | Travel burden | Numeric | Employee record |
| Business travel frequency | Travel burden | Categorical | Employee record |
| Absence count | Attendance signal | Integer | Attendance record |
| Leave frequency | Workload/wellbeing signal | Numeric | Attendance record |
| Late-arrival frequency | Attendance pattern | Numeric | Attendance record |
| Performance rating | Performance context | Numeric | Performance review |
| Performance trend | Change in performance | Numeric | Derived from reviews |
| Manager rating | Manager assessment | Numeric | Performance review |
| Training hours | Development opportunity | Numeric | Learning record |
| Training completion rate | Learning engagement | Numeric | Learning record |
| Job satisfaction score | Engagement signal | Numeric | Survey |
| Work-life balance score | Wellbeing signal | Numeric | Survey |
| Engagement survey score | Commitment signal | Numeric | Survey |
| Manager relationship score | Relationship signal | Numeric | Survey |
| Career growth concern | Development concern | Boolean/score | Survey/NLP |
| Compensation concern | Pay concern | Boolean/score | Survey/NLP |
| Burnout score | Wellbeing concern | Numeric | Survey/NLP |
| Feedback sentiment score | Text sentiment | Numeric | NLP module |
| Negative feedback count | Concern frequency | Integer | NLP module |
| Intervention history | Existing support context | Categorical | Intervention tracker |

## 10. Explainable AI

SHAP shall be used to explain how approved features influence model output.

- **Global explanation:** display overall feature importance across the evaluated population, restricted to authorized users.
- **Local explanation:** display the factors that raised or lowered one employee's predicted risk.
- **Top features:** show a ranked, human-readable list and avoid exposing raw internal model values as the only explanation.
- **Prediction confidence:** show model confidence or probability with a reminder that confidence is not certainty.
- **Risk categories:** Low (0–0.34), Medium (0.35–0.64), High (0.65–1.00) are initial configurable thresholds; calibration review may revise them.

Example output:

```text
Risk: High (0.72 probability; model v1.2)
Primary contributors increasing risk:
  - Long period since last promotion
  - Frequent overtime
  - Declining job-satisfaction score
Factors reducing risk:
  - Recent training participation
Suggested next step: HR manager review and voluntary career discussion.
```

## 11. NLP Module

The NLP module processes permitted free-text survey responses and employee feedback. It shall not infer sensitive traits or make employment decisions.

- **Text cleaning:** remove malformed text, normalize whitespace, detect unsupported content, and minimize stored raw text where policy requires.
- **VADER sentiment:** generate fast positive/neutral/negative sentiment scores for short feedback.
- **DistilBERT:** classify richer text for configurable concerns such as burnout, career-growth concern, compensation concern, manager relationship concern, or workload concern.
- **Burnout detection:** produce a non-clinical concern indicator; it is not a medical diagnosis.
- **Concern extraction:** identify approved concern categories and keywords/phrases for HR review.

Example output contract:

```json
{
  "sentiment": "negative",
  "sentimentScore": -0.63,
  "burnoutRisk": "medium",
  "concerns": ["workload", "career_growth"],
  "confidence": 0.81,
  "requiresHumanReview": true
}
```

## 12. RAG Module

The RAG module answers authorized HR questions using approved policy documents rather than unsupported model memory.

1. An authorized user uploads a supported HR document and category.
2. The system parses the file, extracts text, and records processing status.
3. Recursive document chunking creates context-preserving segments with source metadata.
4. Sentence Transformer embeddings are stored in ChromaDB.
5. Semantic retrieval selects the most relevant approved chunks for a user question.
6. Prompt construction supplies retrieved text, user role, and answer rules to the Llama model through Groq.
7. The response includes source citations and indicates when evidence is insufficient.

```text
Approved Document Upload
          |
          v
Parse and Validate --> Chunk with Metadata --> Generate Embeddings --> ChromaDB
                                                                    |
User Question + Role ----------------------------------------------+
          |                                                         v
          +----------------------------------------------> Semantic Retrieval
                                                                    |
                                                                    v
                                  Grounded Prompt + Retrieved Context + Guardrails
                                                                    |
                                                                    v
                                           LLM Answer + Citations / Insufficient-Evidence Notice
```

Hallucination prevention requirements: only approved and role-permitted documents may be retrieved; answers shall cite source titles/chunks; the assistant shall say it cannot find support when retrieval is weak; it shall never claim an uncited policy as fact.

## 13. Agentic AI

The controlled retention advisor is a LangChain agent that chooses only from allow-listed tools. It produces an advisory briefing, not autonomous action.

### Available Tools

- Retrieve permitted employee risk summary.
- Retrieve SHAP explanation.
- Retrieve department aggregate trends.
- Retrieve intervention history.
- Search approved HR knowledge-base documents.
- Draft retention recommendations from retrieved evidence.

### Agent Behaviour and Guardrails

- Agent state shall retain the current authorized user, employee/dept scope, task, tool outputs, citations, and review status.
- Dynamic tool selection shall be limited to the allow-listed tools above.
- The agent shall verify authorization before requesting data and minimize retrieved personal data.
- It shall not perform write actions, change data, send messages, or make final employment decisions.
- It shall flag uncertainty, cite evidence, recommend human review, and refuse discriminatory or unsupported instructions.

```text
User Request
    |
    v
Authenticate + Check Scope --> Initialize Agent State
    |                                  |
    v                                  v
Choose Allowed Tool <--- Evaluate Missing Evidence ---> Retrieve Data / Policy Context
    |                                                               |
    +---------------------------------------------------------------+
                                    |
                                    v
                  Construct Evidence-Based Recommendation Draft
                                    |
                                    v
                    Guardrail Check + Citations + Human Review Notice
                                    |
                                    v
                              Display to Authorized User
```

## 14. Complete Dashboard

| Page | Purpose and components | Actions, APIs, and access |
|---|---|---|
| Login / password recovery | Login form, password reset, error states. | Auth module; all unauthenticated users. |
| Overview dashboard | KPI cards, risk distribution, trend chart, high-risk list, department comparison. | Filter, drill down, export; Dashboard/Report modules; Admin, HR roles, scoped Department Manager. |
| Employee directory | Paginated table: employee, department, role, risk, status; search and filters. | Search, filter, open profile; Employee/Prediction modules; authorized HR roles. |
| Employee risk profile | Employee summary, risk score, SHAP factors, history chart, feedback insights, intervention timeline. | Request prediction, view explanation, create intervention, request advisor briefing; Employee, Prediction, Intervention, AI modules; scoped access. |
| Departments | Department table, manager, employee count, risk metrics, comparative charts. | Create/edit where permitted; Department/Dashboard modules; Admin and HR Administrator. |
| Attendance and performance | Attendance summaries, performance-review tables, period filters, trend charts. | Add/edit/import permitted data; Attendance/Performance modules; HR roles. |
| Surveys and feedback | Survey management, response metrics, sentiment/concern charts, feedback review queue. | Create survey, review aggregate insights; Survey/Feedback/NLP modules; HR roles; Employee submission only. |
| Data imports | CSV template guidance, upload control, validation table, import history. | Upload, review errors, commit allowed records; Import module; Admin/HR Admin/Analyst. |
| Predictions center | Prediction run history, batch status, risk distribution, model version. | Run permitted prediction, view failure/status; Prediction/Model modules; HR Analyst and authorized HR users. |
| Interventions | Kanban/table views, owner, due date, status, outcome, overdue indicators. | Create, assign, update, close; Intervention/Notification modules; HR Manager and assigned Department Manager. |
| AI retention advisor | Chat area, evidence panel, citations, disclaimer, feedback control. | Ask scoped question, rate answer; Agent/RAG/Recommendation modules; authorized HR roles. |
| Knowledge base | Document table, category, uploader, processing status, search, source preview. | Upload, reprocess, remove, search; Document/RAG modules; Admin/HR Administrator. |
| Reports | Report templates, filter controls, preview, download history. | Generate/download CSV/PDF; Report module; authorized HR users. |
| Notifications | Assigned/overdue intervention and job-status list. | Read, acknowledge; Notification module; authenticated users within scope. |
| Profile and settings | Personal profile, password change, preferences; admin configuration area. | Update permitted preferences; Profile/Settings modules; all users, with admin-only configuration. |
| Users, roles, audit logs | User table, role assignment, audit-event table and filters. | Manage users/roles, view logs; User/Role/Audit modules; System Administrator. |

## 15. Database Overview

The database shall use MongoDB collections with responsibilities as follows; schema design is intentionally outside this SRS.

| Collection | Responsibility |
|---|---|
| Users | Authentication identity, role association, active status, and permitted scope. |
| Roles | Role names and permission definitions. |
| Departments | Department identity, manager association, and organizational context. |
| Employees | Core employee profile and employment attributes. |
| AttendanceRecords | Periodic attendance, leave, absence, and work-pattern summaries. |
| PerformanceReviews | Review ratings, summaries, goal information, and review dates. |
| Surveys | Survey definitions, availability, and question metadata. |
| SurveyResponses | Employee responses and derived aggregate/NLP indicators. |
| EmployeeFeedback | Authorized feedback submissions and protected NLP results. |
| ImportJobs | CSV upload metadata, validation outcomes, and processing status. |
| Predictions | Versioned risk results, probabilities, categories, and timestamps. |
| ExplanationResults | SHAP-derived explanation data associated with a prediction. |
| Interventions | Retention action plans, ownership, due dates, status, and outcomes. |
| Documents | Knowledge-base file metadata, classification, ownership, and processing state. |
| DocumentChunks | Chunk text/metadata and vector-store reference information. |
| ChatSessions and ChatMessages | Conversation history, citations, and user feedback, subject to retention policy. |
| Notifications | In-app notification state and recipient scope. |
| ModelMetadata | Model version, metrics, feature list, approval state, and artifact reference. |
| AuditLogs | Security and business-action traceability. |
| Settings | Approved configurable product thresholds and preferences. |

## 16. API Overview

No endpoint definitions are prescribed. The Express backend shall expose these API modules:

| API module | Responsibility |
|---|---|
| Authentication | Login, token/session lifecycle, password recovery, and logout. |
| Users and Roles | User lifecycle, RBAC, profile, and administrative access management. |
| Employees and Departments | Employee directory/profile and organizational data management. |
| Attendance, Performance, Surveys, Feedback | HR input records, response capture, and permitted analysis retrieval. |
| Imports | Template validation, upload processing, status, and result review. |
| Predictions and Explanations | Prediction requests, historical results, SHAP summaries, and model version details. |
| Interventions and Notifications | Retention action plans, ownership workflow, deadlines, and alerts. |
| Dashboard and Reports | Aggregated, role-scoped analytics and export generation. |
| Documents and Knowledge Base | Secure document lifecycle, parsing status, and search. |
| RAG, Agent, and Recommendations | Authorized assistant conversations, citations, scoped tool orchestration, and feedback. |
| Model Administration | Metadata, metrics, training/retraining job status, and active model selection. |
| Audit and Settings | Auditable activity and approved system configuration. |

## 17. High-Level Architecture

RetentionAI uses a modular architecture. React communicates with Express for product workflows. Express owns authorization and persistence. The Python service performs ML, SHAP, NLP, retrieval, and controlled agent work. MongoDB Atlas stores application data; ChromaDB stores document embeddings; Groq hosts Llama inference.

```text
Users
  |
  v
React Frontend (Vercel)
  | HTTPS + JWT
  v
Express Backend (Render) <-------------------------> MongoDB Atlas
  |                                                     (application data)
  | authenticated internal requests
  v
Python AI Service (Render)
  |              |                 |                 |
  v              v                 v                 v
ML Model       SHAP             NLP Module       ChromaDB
  |                                                  |
  +--------------------- Agent / RAG ---------------+
                              |
                              v
                       Groq API / Llama Model
```

```text
React UI --> Express API --> Python AI Service --> ML / SHAP / NLP
   |             |                  |
   |             +--> MongoDB <-----+
   |
   +<--- scoped results, charts, explanations, citations, recommendations
```

## 18. Data Flow

### 18.1 Employee Upload to Dashboard

```text
CSV Upload --> Validation --> Import Job Result --> MongoDB Employee Data
                                                  |
                                                  v
                                        Authorized Batch Prediction
                                                  |
                                                  v
                                    ML Probability + SHAP Explanation
                                                  |
                                                  v
                              Versioned Prediction / Explanation Storage
                                                  |
                                                  v
                                Role-Scoped Dashboard and Risk Profile
```

### 18.2 Advisor Recommendation Flow

```text
Authorized HR Request
        |
        v
Employee Risk + SHAP + Intervention History + Department Aggregates
        |                         |                         |
        +-------------------------+-------------------------+
                                  |
                                  v
                    Agent retrieves relevant approved policies
                                  |
                                  v
                      LLM drafts cited retention options
                                  |
                                  v
                 Guardrail / human-review notice / user feedback
                                  |
                                  v
                            Employee Risk Profile Dashboard
```

## 19. Security

- **JWT:** short-lived authentication tokens protect product APIs; authenticated context carries role and scope.
- **RBAC:** permissions are enforced server-side for every sensitive module, query, export, and agent tool call.
- **Password hashing:** bcrypt or equivalent secure hashing prevents plaintext-password storage.
- **Validation:** Zod validates request shape and business constraints before processing.
- **Rate limiting:** login, reset, upload, chatbot, and prediction operations shall use practical rate limits.
- **Input sanitization:** user text, CSV cells, query parameters, and document metadata are treated as untrusted input.
- **Environment variables:** database URLs, JWT secrets, API keys, and storage credentials are never committed to source control or returned to the client.
- **Sensitive-data protection:** use HTTPS, least privilege, role-scoped queries, minimized exports, audit logs, and defined retention rules. Do not include protected characteristics in recommendation prompts except where approved for separate fairness analysis.

## 20. Success Metrics

| Area | Initial MVP target |
|---|---|
| Model evaluation | Track accuracy, precision, recall, F1, ROC-AUC, and calibration; prioritize recall/F1 appropriate to HR review capacity. |
| Prediction latency | Single employee prediction under 5 seconds. |
| Dashboard latency | Typical filtered dashboard under 3 seconds. |
| AI response latency | Grounded RAG/agent response under 10 seconds in normal conditions. |
| Data quality | At least 95% of required import fields valid for approved demo datasets. |
| Explainability | 100% of displayed predictions include ranked contributing factors. |
| Grounding | 100% of policy-answer responses display citations or an explicit insufficient-evidence response. |
| Workflow adoption | Demonstrate creation and completion tracking of an intervention for every selected high-risk demo case. |

## 21. Risks and Mitigations

| Risk type | Risk | Mitigation |
|---|---|---|
| Technical | Sparse, noisy, or inconsistent HR data reduces model quality. | Validate imports, document assumptions, use baseline models, and show data quality indicators. |
| Technical | Third-party LLM/API outage affects assistant availability. | Show graceful unavailable state; keep core dashboards and predictions independent. |
| Business | Users may interpret a risk score as a final personnel decision. | Persistent human-review notices, training/demo guidance, and no automated actions. |
| AI | Hallucinated policy answers or unsupported recommendations. | Retrieval grounding, citations, weak-retrieval fallback, tool allow lists, and human review. |
| Privacy | Sensitive employee information is exposed to the wrong role. | RBAC, department scope checks, export control, audit logs, and least-privilege access. |
| Bias | Historical data can encode unfair patterns. | Feature review, fairness-only handling of protected data, subgroup evaluation where permitted, and human review. |
| Ethical | Burnout/sentiment analytics may be perceived as surveillance. | Restrict use, disclose purpose, minimize collection, aggregate where possible, and avoid clinical claims. |
| Scope | An overly ambitious feature set threatens delivery. | Prioritize core prediction, explanations, dashboard, intervention tracking, and minimal RAG before optional features. |

## 22. Assumptions

- A lawful and authorized demo or anonymized employee dataset is available, including an attrition outcome for model training.
- The institution/project sponsor approves use of de-identified employee information.
- Initial deployment supports one organization rather than multi-tenant SaaS.
- MongoDB Atlas, Render, Vercel, and Groq account limits are sufficient for the demonstration workload.
- HR documents uploaded to the knowledge base are approved for the intended user roles.
- Predictions are periodic and batch-oriented; real-time event processing is not required.
- HR personnel remain responsible for all sensitive employment decisions.
- The team can use English-language documents and feedback for the initial NLP/RAG release.

## 23. Final Deliverables

- React frontend with responsive role-based dashboards.
- Express backend with authentication, RBAC, validated product modules, and audit logging.
- MongoDB Atlas collections and documented data setup.
- Python ML service with preprocessing, trained attrition model, evaluation results, and Joblib artifact.
- SHAP explanation capability and readable prediction views.
- NLP analysis for authorized feedback/survey text.
- RAG knowledge base using document processing, embeddings, ChromaDB, and citations.
- Controlled agentic retention advisor with tool restrictions and guardrails.
- Deployment configuration and environment-variable guide for Vercel, Render, and MongoDB Atlas.
- README, SRS, architecture diagrams, API-module documentation, demo dataset guide, test evidence, presentation, and recorded/live demonstration plan.

## 24. Development Roadmap

| Phase | Main outcome |
|---|---|
| 1. Architecture and planning | Finalize requirements, roles, data dictionary, user flows, wireframes, and demo dataset. |
| 2. Backend foundation | Authentication, RBAC, core data modules, validation, audit logging, and import workflow. |
| 3. Frontend foundation | Navigation, protected routes, forms, employee directory, and basic dashboards. |
| 4. ML pipeline | Data preparation, baseline/trained model, evaluation, serialization, and prediction integration. |
| 5. Explainability and analytics | SHAP outputs, prediction history, risk profile, charts, and reports. |
| 6. HR workflow | Interventions, notifications, surveys, feedback, and NLP insights. |
| 7. RAG and agent | Document lifecycle, ChromaDB retrieval, cited chatbot, controlled advisor, and guardrail tests. |
| 8. Testing and security | Unit/integration testing, permission testing, import edge cases, AI fallback testing, and accessibility review. |
| 9. Deployment and documentation | Deploy to Vercel/Render/Atlas, prepare recovery notes, README, SRS, presentation, and demo narrative. |

## Approval Principle

RetentionAI is an HR decision-support product. Risk scores, NLP indicators, RAG answers, and AI recommendations are evidence aids for authorized human reviewers. They must never independently determine an employee's employment outcome.
