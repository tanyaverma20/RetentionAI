# Database Design Document: RetentionAI

**Database:** MongoDB Atlas • **ODM:** Mongoose (implementation only; no models are defined here)  
**Scope:** Logical and physical data design for the RetentionAI MVP. This is a design guide, not code or an API specification.

## 1. Database Overview

MongoDB Atlas is selected because RetentionAI contains varied, evolving HR data: employee profiles, periodic attendance/performance snapshots, survey responses, semi-structured feedback/NLP results, AI outputs, document metadata, and audit trails. Its document model supports these records without forcing a large relational migration effort during an MVP.

Advantages include flexible evolution, natural storage of small embedded subdocuments, straightforward JSON integration with Express, managed backups/security in Atlas, and aggregation support for dashboards. Limitations are that cross-collection reporting and strict relational integrity require deliberate service-layer validation, joins use aggregation/lookups rather than SQL joins, and unbounded embedded arrays must be avoided.

Initial expected scale: 1,000–10,000 employees; 12–36 monthly attendance records per employee; 2–8 performance records per employee; up to 100,000 feedback/survey responses; 10,000–500,000 predictions/history records; and a modest knowledge base (100–2,000 documents, with chunks held separately). This is well within Atlas shared/dedicated tiers when supported by appropriate indexes, pagination, and archival. The design scales by referencing high-growth records, using tenant-ready identifiers, and separating large file/vector payloads from core documents.

## 2. Collections

| Collection | Purpose / relationships | Key and references | Embed/reference decision | Volume and lifecycle |
|---|---|---|---|---|
| roles | Permission templates. | `_id`; referenced by users. | Reference: shared/reused role definition. | 5–15; rare reads/writes; hard delete only when unused. |
| users | Login identities and role assignments. | `_id`; `roleId`, optional `employeeId`, `departmentId`. | Reference roles/employees to avoid duplication. | 10–500; frequent reads; soft deactivate; retain audit identity indefinitely. |
| departments | Organizational units. | `_id`; `managerEmployeeId`. | Reference manager/employee records. | 5–100; frequent reads; soft delete/inactivate. |
| employees | Core employee profile and current work attributes. | `_id`; `departmentId`, `managerEmployeeId`, optional `userId`. | Reference departments/manager; embed only small current preferences. | 1k–10k; frequent reads/updates; soft delete on exit; retain per HR policy. |
| attendanceRecords | Period summaries of attendance/absence. | `_id`; `employeeId`, `departmentId`. | Reference employee because records grow over time. | 12–36 per employee/year; batch writes; retain 3–7 years. |
| performanceReviews | Formal review snapshots. | `_id`; `employeeId`, reviewer user/employee IDs. | Reference employee/reviewer; embed small rating/goal summary. | 2–8 per employee/year; immutable after finalization except correction. |
| surveys | Survey definitions and availability. | `_id`; creator user ID. | Embed questions because they are bounded and versioned with survey. | 5–50; infrequent changes; archive, do not hard delete after responses. |
| surveyResponses | Employee answers and derived scores. | `_id`; `surveyId`, `employeeId`, `departmentId`. | Reference survey/employee; embed bounded answer array. | 1k–100k; write during campaigns; retain per consent policy. |
| employeeFeedback | Optional free-text feedback and NLP output. | `_id`; optional `employeeId`, `departmentId`, `nlpAnalysisId`. | Reference identity when non-anonymous; embed small NLP result if retained. | 1k–100k; append-heavy; access restricted; retention-limited. |
| importJobs | CSV import metadata and row-result summary. | `_id`; `initiatedBy`. | Embed aggregate counts/small error samples; externalize full rejected rows if large. | 10–1k; low; retain 1–2 years. |
| predictions | Current/latest authoritative prediction per employee/model context. | `_id`; `employeeId`, `modelId`, `latestHistoryId`. | Reference employee/model/history. | Up to active employee count per model; updates after runs; soft archive on model retirement. |
| predictionHistory | Immutable prediction run outcomes. | `_id`; `employeeId`, `modelId`, optional `explanationId`. | Reference due to unbounded history. | 10k–500k; append-only; archive after 2–3 years. |
| riskFactors | Normalized SHAP factor contributions. | `_id`; `predictionHistoryId`. | Reference to prevent growing prediction records; can be batch-read by history ID. | 5–20 per prediction; append-only; same retention as history. |
| interventions | Human retention action plans. | `_id`; `employeeId`, owner/creator IDs. | Reference employee/users; embed bounded activity timeline. | 1–5 per employee/year; frequent updates; retain 3–7 years. |
| knowledgeBases | Knowledge-base categories and access governance. | `_id`; owner user ID. | Reference documents; prevents duplicating governance. | 1–20; low change; archive only. |
| documents | Uploaded HR policy/source metadata and version status. | `_id`; `knowledgeBaseId`, uploader ID, `supersedesDocumentId`. | Store only metadata/file reference; content/chunks elsewhere. | 100–2k; occasional writes; soft delete/version archive. |
| documentChunks | Parsed chunk text and vector-store reference. | `_id`; `documentId`, `knowledgeBaseId`. | Reference because chunks are high-volume and independently retrieved. | 1k–200k; append/delete by document version; hard delete on permitted purge. |
| chatSessions | Conversation headers. | `_id`; `userId`, optional target employee/department. | Reference messages; avoid large conversation arrays. | 1k–50k; moderate; TTL/archive per policy. |
| chatMessages | Individual user/assistant messages and citations. | `_id`; `sessionId`, sender user ID. | Embed bounded citation array; reference session/documents. | 10k–500k; append-only; TTL/archive per policy. |
| aiRecommendations | Stored advisor outputs and user feedback. | `_id`; `employeeId`, `predictionHistoryId`, `sessionId`, requester ID. | References preserve evidence lineage; embed bounded evidence/citations. | 1k–100k; append/feedback update; retain 2–3 years. |
| reports | Generated report metadata and secure file reference. | `_id`; creator user ID. | Reference creator; do not embed report payload. | 100–10k; low; TTL for generated files/metadata. |
| notifications | In-app task/status notices. | `_id`; `recipientUserId`, source entity reference. | Reference source; small document. | 1k–100k; frequent read/update; TTL after 90–180 days. |
| auditLogs | Security and business-action trail. | `_id`; actor user ID, entity references. | Embed bounded before/after summary; never embed secrets. | 10k–1m; append-only; archive 3–7 years. |
| systemSettings | Organization-wide configurable values. | `_id`; updatedBy. | Single bounded document per tenant/organization. | 1–10; rare; versioned audit, no hard delete. |
| modelMetadata | Approved ML model registry. | `_id`; created/approved user IDs. | Reference predictions; embed metrics/features snapshot. | 5–100; low; never delete active/history-referenced versions. |

**Primary key convention:** MongoDB ObjectId `_id` for every collection. All foreign references are ObjectId values unless an external immutable identifier is explicitly added. MVP records include an optional future-ready `organizationId` in every tenant-scoped collection, even if only one organization is enabled initially.

## 3. Detailed Field Design

Legend: **R** required; **O** optional. Validation shown is logical validation enforced by application/data rules.

### 3.1 Identity and Organization Collections

#### roles

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id` | ObjectId / R | generated | Primary key. |
| `name` | string / R | unique; `HR_MANAGER` | Stable role name. |
| `permissions` | array<string> / R / `[]` | allow-listed capabilities | RBAC capabilities. |
| `isSystem` | boolean / R / false | true/false | Protect built-in roles. |
| `createdAt`, `updatedAt` | date / R | automatic | Lifecycle traceability. |

#### users

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId` | ObjectId / R | generated | Identity and future tenant boundary. |
| `name` | string / R | 2–100 chars; `Asha Sharma` | Display identity. |
| `email` | string / R | normalized; unique per organization; `asha@acme.com` | Login/contact. |
| `passwordHash` | string / R | bcrypt hash only | Credential protection. |
| `roleId` | ObjectId / R | existing role | RBAC link. |
| `employeeId`, `departmentId` | ObjectId / O | existing records | Scope/self-service mapping. |
| `status` | enum / R / `ACTIVE` | ACTIVE, INACTIVE, LOCKED | Account lifecycle. |
| `lastLoginAt` | date / O | valid date | Security/usage visibility. |
| `createdAt`, `updatedAt`, `deletedAt` | date / R/O | automatic | Audit/soft-delete state. |

#### departments

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId` | ObjectId / R | generated | Identity/tenant boundary. |
| `code` | string / R | unique per organization; `ENG` | Stable reporting key. |
| `name` | string / R | 2–120 chars; `Engineering` | Department label. |
| `managerEmployeeId` | ObjectId / O | active employee | Department ownership. |
| `location`, `costCenter` | string / O | bounded text | Organizational context. |
| `status` | enum / R / `ACTIVE` | ACTIVE, INACTIVE | Lifecycle. |

#### employees

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId` | ObjectId / R | generated | Identity/tenant boundary. |
| `employeeCode` | string / R | unique per organization; `EMP-1042` | External HR identifier. |
| `firstName`, `lastName` | string / R | 1–80 chars | Employee identity. |
| `workEmail` | string / R | normalized unique per organization | Business contact. |
| `departmentId`, `managerEmployeeId` | ObjectId / R/O | valid active references | Organization hierarchy. |
| `jobRole`, `jobLevel`, `employmentType` | string, integer, enum / R | level 1–10; FULL_TIME etc. | Role context/ML features. |
| `hireDate`, `status` | date, enum / R | ACTIVE, EXITED, INACTIVE | Employment lifecycle. |
| `location`, `workMode` | string, enum / O | ONSITE/HYBRID/REMOTE | Work context. |
| `salaryBand`, `overtimeFrequency` | enum / O | configured values | Approved model inputs. |
| `profileUpdatedAt`, `deletedAt` | date / O | automatic | Data maintenance/soft delete. |

### 3.2 HR Operational Collections

#### attendanceRecords

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `employeeId`, `departmentId` | ObjectId / R | valid refs | Ownership/scope. |
| `periodStart`, `periodEnd` | date / R | start <= end; `2026-06-01` | Reporting period. |
| `workingDays`, `presentDays`, `absenceCount` | integer / R | >=0; present <= working | Attendance summary. |
| `leaveDays`, `lateArrivalCount`, `overtimeHours` | number / O / 0 | >=0 | Work-pattern features. |
| `source`, `createdAt` | enum, date / R | IMPORT/MANUAL | Data lineage. |

#### performanceReviews

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `employeeId` | ObjectId / R | valid refs | Review ownership. |
| `reviewerEmployeeId`, `reviewerUserId` | ObjectId / O | valid ref | Reviewer traceability. |
| `reviewPeriodStart`, `reviewPeriodEnd`, `reviewDate` | date / R | valid sequence | Review timing. |
| `performanceRating`, `managerRating` | number / R/O | 1–5 | ML/analysis signal. |
| `goalCompletionRate` | number / O | 0–100 | Development performance. |
| `summary`, `status` | string, enum / O/R | DRAFT/FINAL | Review context/lifecycle. |

#### surveys

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `createdBy` | ObjectId / R | valid refs | Ownership. |
| `title`, `description` | string / R/O | title 3–160 chars | Survey identity. |
| `questions` | array<object> / R | 1–30 bounded questions | Versioned survey content. |
| `audienceDepartmentIds` | array<ObjectId> / O | valid refs | Targeting. |
| `opensAt`, `closesAt`, `status` | date/date/enum / R | DRAFT/OPEN/CLOSED/ARCHIVED | Campaign lifecycle. |
| `version` | integer / R / 1 | >=1 | Preserve definition history. |

#### surveyResponses

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `surveyId`, `employeeId`, `departmentId` | ObjectId / R | valid refs | Response scope. |
| `answers` | array<object> / R | bounded by survey questions | Employee response values. |
| `submittedAt` | date / R | campaign date range | Submission trace. |
| `aggregateScores` | object / O | values 0–5/0–100 | Engagement/work-life metrics. |
| `textAnalysis` | object / O | sentiment/concerns/confidence | NLP summary, not raw model internals. |
| `isAnonymous` | boolean / R / false | policy-controlled | Confidentiality handling. |

#### employeeFeedback

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId` | ObjectId / R | generated | Identity/tenant. |
| `employeeId`, `departmentId` | ObjectId / O | omit employee when anonymous | Source/scope. |
| `category` | enum / R | WORKLOAD, MANAGER, PAY, GROWTH, OTHER | Feedback classification. |
| `message` | string / R | 1–5000 chars; encrypted if required | Submitted feedback. |
| `submittedAt`, `isAnonymous` | date, boolean / R | automatic | Privacy/lifecycle. |
| `nlpAnalysis` | object / O | sentiment, concerns, confidence | Derived advisory signal. |
| `status` | enum / R / `NEW` | NEW, REVIEWED, CLOSED | HR handling. |

#### importJobs

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `initiatedBy` | ObjectId / R | valid user | Import ownership. |
| `entityType`, `fileName` | enum, string / R | EMPLOYEES/ATTENDANCE etc. | Import target/trace. |
| `status` | enum / R | VALIDATING/COMPLETED/FAILED | Processing lifecycle. |
| `totalRows`, `acceptedRows`, `rejectedRows` | integer / R / 0 | >=0 | Result summary. |
| `errorSamples` | array<object> / O | max 100 | User-correctable examples. |
| `startedAt`, `completedAt` | date / R/O | automatic | Operational trace. |

### 3.3 ML, Intervention, and Knowledge Collections

#### predictions and predictionHistory

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `employeeId`, `modelId` | ObjectId / R | valid refs | Prediction lineage. |
| `riskScore` | number / R | 0–1; `0.72` | Probability. |
| `riskLevel` | enum / R | LOW/MEDIUM/HIGH | Human-readable category. |
| `confidence` | number / O | 0–1 | Model confidence/calibration output. |
| `predictedAt`, `featureSnapshotAt` | date / R | automatic | Timing/data lineage. |
| `status` | enum / R | SUCCESS/FAILED/SUPERSEDED | Result lifecycle. |
| `latestHistoryId` | ObjectId / O | predictions only | Latest immutable run. |
| `inputSnapshotHash` | string / O | SHA-256-like identifier | Reproducibility without duplicating PII. |

`predictions` contains one current record per employee/model context; `predictionHistory` has the same core fields plus immutable `runId`, `requestedBy`, `batchId`, and `explanationStatus`.

#### riskFactors

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `predictionHistoryId` | ObjectId / R | valid history | Explanation parent. |
| `featureKey`, `displayName` | string / R | allow-listed feature; `yearsSincePromotion` | Explainability identity. |
| `shapValue`, `rank` | number, integer / R | finite; rank >=1 | Contribution magnitude/order. |
| `direction` | enum / R | INCREASES_RISK/REDUCES_RISK | Readable effect. |
| `featureValue`, `description` | mixed/string / O | safe display value | Human-readable rationale. |

#### interventions

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `employeeId` | ObjectId / R | valid active ref | Action target. |
| `createdBy`, `ownerUserId` | ObjectId / R | valid authorized users | Accountability. |
| `type`, `priority`, `status` | enums / R | CAREER_DISCUSSION, HIGH, PLANNED | Workflow categorization. |
| `title`, `description` | string / R/O | 3–200 / bounded text | Action definition. |
| `dueDate`, `completedAt` | date / O | valid chronology | Deadline/outcome. |
| `activity` | array<object> / O | bounded entries | Timeline of status/note changes. |
| `outcome` | enum / O | POSITIVE/NO_CHANGE/NOT_APPLICABLE | Outcome analysis. |

#### knowledgeBases, documents, documentChunks

| Collection / fields | Type / validation | Business purpose |
|---|---|---|
| `knowledgeBases`: `_id`, `organizationId`, `name`, `description`, `allowedRoleIds`, `status`, `ownerUserId` | ObjectId/string/array/enum; name unique per organization | Governed document grouping. |
| `documents`: `_id`, `organizationId`, `knowledgeBaseId`, `title`, `fileName`, `mimeType`, `storageKey`, `version`, `status`, `uploadedBy`, `supersedesDocumentId`, `processedAt`, `deletedAt` | ObjectId/string/integer/enum; supported types and versions >=1 | Source file metadata/lifecycle. |
| `documentChunks`: `_id`, `organizationId`, `documentId`, `knowledgeBaseId`, `chunkIndex`, `content`, `sourceLocator`, `vectorId`, `metadata`, `createdAt` | ObjectId/integer/string/object; chunk index unique per document | Retrieval content and vector link. |

### 3.4 Conversation, Governance, and Output Collections

#### chatSessions and chatMessages

| Collection / fields | Type / validation | Business purpose |
|---|---|---|
| `chatSessions`: `_id`, `organizationId`, `userId`, `title`, `targetEmployeeId`, `targetDepartmentId`, `status`, `lastMessageAt`, `expiresAt` | ObjectId/string/enum/date; one target scope optional | Conversation header and retention control. |
| `chatMessages`: `_id`, `organizationId`, `sessionId`, `senderType`, `content`, `citations`, `modelId`, `createdAt`, `safetyFlags` | enum USER/ASSISTANT/SYSTEM; content <=10k; bounded citations | Individual conversation/audit evidence. |

#### aiRecommendations

| Field | Type / R/O / default | Validation / example | Business purpose |
|---|---|---|---|
| `_id`, `organizationId`, `employeeId`, `requestedBy` | ObjectId / R | valid scoped refs | Request lineage. |
| `predictionHistoryId`, `sessionId` | ObjectId / O | valid refs | Evidence linkage. |
| `summary`, `actions` | string, array<object> / R | bounded text/actions | Human-reviewed advice. |
| `citations`, `evidenceRefs` | array / O | bounded valid refs | Grounding evidence. |
| `reviewRequired`, `feedbackRating`, `feedbackComment` | boolean/number/string | rating 1–5 | Governance/usability feedback. |
| `createdAt` | date / R | automatic | History. |

#### reports, notifications, auditLogs, systemSettings, modelMetadata

| Collection / fields | Type / validation | Business purpose |
|---|---|---|
| `reports`: `_id`, `organizationId`, `createdBy`, `type`, `criteria`, `status`, `storageKey`, `expiresAt`, `createdAt` | enum; bounded criteria; TTL expiry | Generated-report lifecycle. |
| `notifications`: `_id`, `organizationId`, `recipientUserId`, `type`, `title`, `body`, `sourceType`, `sourceId`, `readAt`, `expiresAt` | enum; bounded strings; TTL expiry | In-app task/status notification. |
| `auditLogs`: `_id`, `organizationId`, `actorUserId`, `action`, `entityType`, `entityId`, `oldValue`, `newValue`, `reason`, `ipHash`, `createdAt` | allow-listed action; redacted snapshots | Trace sensitive activity. |
| `systemSettings`: `_id`, `organizationId`, `riskThresholds`, `retentionPolicies`, `notificationPreferences`, `updatedBy`, `updatedAt`, `version` | one active settings record/tenant; thresholds 0–1 | Configurable product rules. |
| `modelMetadata`: `_id`, `organizationId`, `version`, `algorithm`, `featureKeys`, `metrics`, `artifactUri`, `status`, `trainedAt`, `approvedBy` | unique version/tenant; status DRAFT/APPROVED/RETIRED | Model registry/reproducibility. |

## 4. Relationships

- **Role → Users:** one-to-many. A role is referenced because it is shared and permission changes must take effect consistently.
- **Department → Employees:** one-to-many. Employees reference their department; the department does not embed an unbounded employee list.
- **Employee → Attendance, Performance, SurveyResponse, Feedback, PredictionHistory, Intervention:** one-to-many. High-growth time-series/workflow data references the employee.
- **Employee → Manager (Employee):** many-to-one self-reference. This supports a simple hierarchy without duplicating manager details.
- **Survey → SurveyResponse:** one-to-many. Responses reference a versioned survey; answer arrays are embedded because they are bounded by the survey definition.
- **PredictionHistory → RiskFactors:** one-to-many. Factor contributions are referenced for bounded main prediction documents and efficient details loading.
- **ModelMetadata → Predictions/PredictionHistory:** one-to-many. Model versions are immutable references for reproducibility.
- **KnowledgeBase → Documents → DocumentChunks:** one-to-many chains. Documents/chunks grow independently and require lifecycle cleanup/versioning.
- **ChatSession → ChatMessages:** one-to-many. Messages are referenced to avoid unlimited session growth.
- **AIRecommendation → PredictionHistory/ChatSession/Documents:** many-to-one evidence references. Citation arrays are embedded only as small snapshots for fast display.
- **User → AuditLogs/Reports/Notifications/Interventions:** one-to-many references retain actor/recipient accountability.

## 5. ER Diagram

```text
Roles 1 -------- * Users * -------- 0..1 Employees
                    |                    |
                    |                    | managerEmployeeId
                    |                    +----- Employees (self hierarchy)
                    |
Departments 1 ---- * Employees
                    |
                    +---- * AttendanceRecords
                    +---- * PerformanceReviews
                    +---- * SurveyResponses * ---- 1 Surveys
                    +---- * EmployeeFeedback
                    +---- 1 Predictions ---- 1 ModelMetadata
                    +---- * PredictionHistory ---- 1 ModelMetadata
                                      |
                                      +---- * RiskFactors
                    +---- * Interventions ---- 1 Users (owner)
                    +---- * AIRecommendations ---- 0..1 PredictionHistory

KnowledgeBases 1 ---- * Documents 1 ---- * DocumentChunks --> ChromaDB vectorId
                             |
                             +---- 0..1 Documents (supersedes)

Users 1 ---- * ChatSessions 1 ---- * ChatMessages
ChatMessages / AIRecommendations ---- * citation references ---- Documents
Users 1 ---- * Reports / Notifications / AuditLogs / ImportJobs
SystemSettings 1 per organization
```

## 6. Embedding vs Referencing

Embed only bounded data that is read with its parent: survey question definitions; survey answer arrays; small NLP summaries; intervention activity timeline; recommendation action/citation snapshots; import error samples; configuration thresholds; and audit before/after summaries after PII redaction. Reference independently growing or independently queried records: employees, HR periods, prediction history, risk factors, documents/chunks, chat messages, reports, and audit logs.

Original documents and generated report binaries are never embedded in MongoDB documents. Store only a secure storage key, metadata, and integrity/version details. ChromaDB holds vector representations; MongoDB retains chunk text/metadata/vector identifier so retrieval can be traced and purged.

## 7. Indexes

| Collection | Recommended indexes and rationale |
|---|---|
| roles | Unique `{organizationId, name}` for stable role lookup. |
| users | Unique `{organizationId, email}`; `{organizationId, roleId, status}` for administration; sparse `{employeeId}` for employee-linked account lookup. |
| departments | Unique `{organizationId, code}`; `{organizationId, status}` for active dropdowns. |
| employees | Unique `{organizationId, employeeCode}` and `{organizationId, workEmail}`; compound `{organizationId, departmentId, status}`; `{organizationId, managerEmployeeId, status}`; text index on permitted name/code fields only if directory search needs it. |
| attendanceRecords | Unique `{organizationId, employeeId, periodStart, periodEnd}`; `{organizationId, departmentId, periodStart}` for analytics. |
| performanceReviews | `{organizationId, employeeId, reviewDate:-1}`; `{organizationId, departmentId, reviewDate:-1}` if department copied for analytics. |
| surveys | `{organizationId, status, opensAt}`; unique `{organizationId, title, version}`. |
| surveyResponses | Unique `{organizationId, surveyId, employeeId}` when non-anonymous; `{organizationId, departmentId, submittedAt}`; sparse anonymous-survey index as required. |
| employeeFeedback | `{organizationId, departmentId, submittedAt:-1}`; `{organizationId, status, submittedAt}`; text index only on approved, non-sensitive search surface. |
| importJobs | `{organizationId, entityType, startedAt:-1}`, `{initiatedBy, startedAt:-1}`. |
| predictions | Unique `{organizationId, employeeId, modelId}`; `{organizationId, riskLevel, updatedAt:-1}` for high-risk views. |
| predictionHistory | `{organizationId, employeeId, predictedAt:-1}`; `{organizationId, modelId, predictedAt:-1}`; `{organizationId, riskLevel, predictedAt:-1}`. |
| riskFactors | `{predictionHistoryId, rank}` unique/compound for explanation display. |
| interventions | `{organizationId, employeeId, status}`; `{ownerUserId, status, dueDate}`; `{organizationId, dueDate, status}` for overdue jobs. |
| knowledgeBases | Unique `{organizationId, name}`; `{organizationId, status}`. |
| documents | `{organizationId, knowledgeBaseId, status}`; unique `{knowledgeBaseId, title, version}`; text index on title/tags, not file contents. |
| documentChunks | Unique `{documentId, chunkIndex}`; `{knowledgeBaseId, documentId}`; vector search remains ChromaDB responsibility. |
| chatSessions | `{organizationId, userId, lastMessageAt:-1}`; TTL `{expiresAt:1}`. |
| chatMessages | `{sessionId, createdAt}`; TTL only if all messages share expiry policy. |
| aiRecommendations | `{organizationId, employeeId, createdAt:-1}`; `{requestedBy, createdAt:-1}`. |
| reports | `{organizationId, createdBy, createdAt:-1}`; TTL `{expiresAt:1}`. |
| notifications | `{recipientUserId, readAt, createdAt:-1}`; TTL `{expiresAt:1}`. |
| auditLogs | `{organizationId, entityType, entityId, createdAt:-1}`; `{actorUserId, createdAt:-1}`; archive rather than TTL if compliance requires retention. |
| systemSettings | Unique `{organizationId}`. |
| modelMetadata | Unique `{organizationId, version}`; `{organizationId, status, trainedAt:-1}`. |

Use sparse indexes only for genuinely optional referenced fields such as `employeeId` on users or anonymous feedback identity links. Use TTL only for disposable notifications, reports, or chat data with an explicit approved expiry; never TTL core HR, prediction, or audit data by accident.

## 8. Data Validation Rules

- Required identifiers must reference active, same-organization parent records unless a historical/archived relationship explicitly allows inactive parents.
- Emails are normalized and unique per organization. Employee code and department code are unique per organization.
- Dates obey chronology: hire date precedes exit date; attendance start precedes end; survey open precedes close; intervention completion cannot precede creation.
- Numeric ranges: probability/confidence 0–1; ratings 1–5; percentages 0–100; counts/hours non-negative; job level 1–10.
- Enumerations are allow-listed for role, account/employee status, employment type, risk level, prediction status, intervention status/priority/type, document status, notification type, and model status.
- An employee cannot be their own manager; a department manager must be an active employee of the organization.
- A prediction requires a complete approved feature set and active approved model; failed inputs create a failed job/result state, not a fake score.
- Document chunks may exist only for successfully parsed document versions. Chat citations must refer to accessible documents/chunks.
- Audit values are redacted/minimized and must never contain passwords, tokens, raw secret keys, or protected free text without explicit policy approval.

## 9. Document Size Strategy

MongoDB documents have a 16 MB limit; the design targets ordinary operational documents below 100 KB, with most below 20 KB. Time-series data, messages, risk factors, and chunks use separate collections rather than ever-growing arrays. Survey answers, intervention activity, citations, and import errors are bounded; overflow data is referenced or stored as a generated artifact.

Original PDFs/DOCX/CSV files and generated report files are stored in managed file/object storage, not MongoDB documents. MongoDB holds a storage key, size, MIME type, checksum, version, and status. Document chunk text is size-bounded during parsing; vector embeddings live in ChromaDB rather than BSON.

## 10. Versioning Strategy

- **Prediction versions:** each `predictionHistory` record is immutable, identifies the input snapshot/time, model version, and explanation status. `predictions` points to the current/latest result.
- **Model versions:** `modelMetadata.version` is immutable and unique per organization. Models move through DRAFT, APPROVED, RETIRED; old versions remain readable for historical explanation.
- **Document versions:** each replacement creates a new `documents` version linked through `supersedesDocumentId`; old documents are archived/inactive and their chunks are retained or purged according to policy.
- **Survey/settings versions:** bounded embedded definitions include a version number; important changes produce audit records rather than silently replacing historical context.

## 11. Audit Strategy

Audit logs are append-only and cover login/auth events, user/role changes, sensitive employee changes, imports, predictions, model activation, document lifecycle, chat/advisor requests, interventions, report exports, and settings changes. Each event records actor user, organization, action, target entity/type, timestamp, request/correlation identifier, reason where supplied, and safe old/new summaries. Before/after values are redacted and minimized; raw credentials, tokens, and large sensitive text are excluded. Audit records are immutable to normal users and retained/archived under HR and legal policy.

## 12. Sample Documents

The following illustrative BSON/JSON-like documents are data examples, not Mongoose code.

```json
{ "_id":"role_hr_manager", "organizationId":"org_1", "name":"HR_MANAGER", "permissions":["employee.read","prediction.read","intervention.write"], "isSystem":true }
{ "_id":"usr_1", "organizationId":"org_1", "name":"Asha Sharma", "email":"asha@acme.example", "passwordHash":"$2b$...", "roleId":"role_hr_manager", "departmentId":"dep_hr", "status":"ACTIVE" }
{ "_id":"dep_eng", "organizationId":"org_1", "code":"ENG", "name":"Engineering", "managerEmployeeId":"emp_10", "status":"ACTIVE" }
{ "_id":"emp_1042", "organizationId":"org_1", "employeeCode":"EMP-1042", "firstName":"Ravi", "lastName":"Kumar", "workEmail":"ravi@acme.example", "departmentId":"dep_eng", "managerEmployeeId":"emp_10", "jobRole":"Software Engineer", "jobLevel":2, "employmentType":"FULL_TIME", "hireDate":"2022-06-14", "status":"ACTIVE", "salaryBand":"B2", "overtimeFrequency":"FREQUENT" }
{ "_id":"att_1", "organizationId":"org_1", "employeeId":"emp_1042", "departmentId":"dep_eng", "periodStart":"2026-06-01", "periodEnd":"2026-06-30", "workingDays":22, "presentDays":19, "absenceCount":3, "leaveDays":2, "overtimeHours":18, "source":"IMPORT" }
{ "_id":"perf_1", "organizationId":"org_1", "employeeId":"emp_1042", "reviewerEmployeeId":"emp_10", "reviewPeriodStart":"2026-01-01", "reviewPeriodEnd":"2026-06-30", "reviewDate":"2026-07-05", "performanceRating":3.4, "managerRating":3.0, "goalCompletionRate":72, "status":"FINAL" }
{ "_id":"survey_1", "organizationId":"org_1", "title":"Q2 Engagement Pulse", "questions":[{"key":"satisfaction","type":"SCALE_1_5","text":"I am satisfied with my role."}], "opensAt":"2026-06-01", "closesAt":"2026-06-15", "status":"CLOSED", "version":1 }
{ "_id":"sr_1", "organizationId":"org_1", "surveyId":"survey_1", "employeeId":"emp_1042", "departmentId":"dep_eng", "answers":[{"questionKey":"satisfaction","value":2}], "submittedAt":"2026-06-08", "aggregateScores":{"jobSatisfaction":2,"workLifeBalance":2}, "textAnalysis":{"sentiment":"NEGATIVE","confidence":0.82}, "isAnonymous":false }
{ "_id":"fb_1", "organizationId":"org_1", "employeeId":"emp_1042", "departmentId":"dep_eng", "category":"WORKLOAD", "message":"The release schedule has been difficult to sustain.", "submittedAt":"2026-06-10", "isAnonymous":false, "nlpAnalysis":{"sentiment":"NEGATIVE","concerns":["workload","burnout"],"confidence":0.79}, "status":"REVIEWED" }
{ "_id":"imp_1", "organizationId":"org_1", "initiatedBy":"usr_1", "entityType":"EMPLOYEES", "fileName":"employees-july.csv", "status":"COMPLETED", "totalRows":200, "acceptedRows":196, "rejectedRows":4, "errorSamples":[{"row":14,"field":"workEmail","reason":"Duplicate"}] }
{ "_id":"model_12", "organizationId":"org_1", "version":"v1.2", "algorithm":"XGBoost", "featureKeys":["tenureMonths","overtimeFrequency","jobSatisfaction"], "metrics":{"f1":0.76,"recall":0.81,"rocAuc":0.84}, "artifactUri":"models/attrition-v1.2.joblib", "status":"APPROVED", "trainedAt":"2026-07-01" }
{ "_id":"ph_1", "organizationId":"org_1", "employeeId":"emp_1042", "modelId":"model_12", "riskScore":0.72, "riskLevel":"HIGH", "confidence":0.79, "predictedAt":"2026-07-12", "runId":"batch_20260712", "status":"SUCCESS", "explanationStatus":"READY" }
{ "_id":"pred_1", "organizationId":"org_1", "employeeId":"emp_1042", "modelId":"model_12", "latestHistoryId":"ph_1", "riskScore":0.72, "riskLevel":"HIGH", "predictedAt":"2026-07-12", "status":"SUCCESS" }
{ "_id":"rf_1", "predictionHistoryId":"ph_1", "featureKey":"yearsSincePromotion", "displayName":"Time since last promotion", "shapValue":0.19, "rank":1, "direction":"INCREASES_RISK", "featureValue":4, "description":"No promotion recorded in four years." }
{ "_id":"int_1", "organizationId":"org_1", "employeeId":"emp_1042", "createdBy":"usr_1", "ownerUserId":"usr_1", "type":"CAREER_DISCUSSION", "priority":"HIGH", "status":"PLANNED", "title":"Career-growth conversation", "dueDate":"2026-07-20", "activity":[{"at":"2026-07-12","by":"usr_1","note":"Created from reviewed risk profile."}] }
{ "_id":"kb_1", "organizationId":"org_1", "name":"HR Policies", "allowedRoleIds":["role_hr_manager"], "status":"ACTIVE", "ownerUserId":"usr_1" }
{ "_id":"doc_1", "organizationId":"org_1", "knowledgeBaseId":"kb_1", "title":"Career Development Policy", "fileName":"career-policy.pdf", "mimeType":"application/pdf", "storageKey":"kb/doc_1/v1.pdf", "version":1, "status":"PROCESSED", "uploadedBy":"usr_1", "processedAt":"2026-07-10" }
{ "_id":"chunk_1", "organizationId":"org_1", "documentId":"doc_1", "knowledgeBaseId":"kb_1", "chunkIndex":0, "content":"Employees may request a career-development discussion...", "sourceLocator":"page 2", "vectorId":"chromadb:doc_1:0" }
{ "_id":"chat_1", "organizationId":"org_1", "userId":"usr_1", "title":"Retention options for Ravi", "targetEmployeeId":"emp_1042", "status":"ACTIVE", "lastMessageAt":"2026-07-12" }
{ "_id":"msg_1", "organizationId":"org_1", "sessionId":"chat_1", "senderType":"ASSISTANT", "content":"Consider a voluntary career discussion and workload review.", "citations":[{"documentId":"doc_1","sourceLocator":"page 2"}], "modelId":"llama", "createdAt":"2026-07-12", "safetyFlags":["HUMAN_REVIEW_REQUIRED"] }
{ "_id":"rec_1", "organizationId":"org_1", "employeeId":"emp_1042", "requestedBy":"usr_1", "predictionHistoryId":"ph_1", "sessionId":"chat_1", "summary":"Prioritize a career and workload discussion.", "actions":[{"type":"CAREER_DISCUSSION","priority":"HIGH"}], "citations":[{"documentId":"doc_1","sourceLocator":"page 2"}], "reviewRequired":true, "feedbackRating":4, "createdAt":"2026-07-12" }
{ "_id":"rep_1", "organizationId":"org_1", "createdBy":"usr_1", "type":"DEPARTMENT_RISK", "criteria":{"departmentId":"dep_eng","period":"2026-Q2"}, "status":"READY", "storageKey":"reports/rep_1.pdf", "expiresAt":"2026-08-12", "createdAt":"2026-07-12" }
{ "_id":"note_1", "organizationId":"org_1", "recipientUserId":"usr_1", "type":"INTERVENTION_DUE", "title":"Intervention due soon", "sourceType":"INTERVENTION", "sourceId":"int_1", "expiresAt":"2026-12-31" }
{ "_id":"audit_1", "organizationId":"org_1", "actorUserId":"usr_1", "action":"PREDICTION_CREATED", "entityType":"PREDICTION_HISTORY", "entityId":"ph_1", "reason":"Scheduled batch run", "createdAt":"2026-07-12" }
{ "_id":"settings_1", "organizationId":"org_1", "riskThresholds":{"lowMax":0.34,"mediumMax":0.64}, "retentionPolicies":{"chatDays":180,"reportDays":30}, "updatedBy":"usr_1", "version":3 }
```

## 13. Database Transactions

Use MongoDB multi-document transactions only where multiple collections must change atomically and the operation cannot safely be reconciled through a status workflow:

- **User creation:** create a user and any mandatory employee-account link together when both must succeed; role existence is checked first.
- **Prediction generation:** create `predictionHistory`, upsert current `predictions`, create risk factors, and record the audit event in one transaction after Python returns a validated result.
- **Document upload:** create document metadata and processing job/status atomically; parsing/chunking is asynchronous and changes status in a later transaction. File storage needs compensating cleanup if database write fails.
- **Intervention creation:** create intervention, notification(s), and audit record atomically.
- **CSV import:** validate before commit; batch writes may use staged import state. Do not hold a transaction open while parsing a large file or calling an external AI service.

## 14. Backup Strategy

Use MongoDB Atlas automated backups with point-in-time recovery on the selected tier, scheduled snapshot retention aligned to the organization’s HR policy, and regular restore verification in a non-production environment. Recovery runbooks must cover restoring Atlas data, reconnecting model/document storage references, rebuilding ChromaDB from approved document sources if necessary, and validating indexes/settings after restore. Archive long-lived audit/prediction history to lower-cost storage according to policy; never archive without preserving retrieval/audit metadata and tested restore access.

## 15. Performance Optimization

- Use the indexes in Section 7 and review query plans with realistic dashboard workloads.
- Build dashboard aggregates using date/department/risk filters, projection, grouping, and pagination; avoid unbounded lookups across employee histories.
- Always paginate directories, predictions, chats, audits, reports, and feedback; use deterministic sort keys.
- Use projections to omit password hashes, raw feedback, full chunks, audit snapshots, and unnecessary PII from routine reads.
- Cache only safe aggregate dashboard values, document retrieval artifacts, and model metadata with short expiry and organization/scope-aware keys.
- Process large imports, batch predictions, and ingestion as tracked jobs; avoid holding web requests open for long-running work.

## 16. Security

Passwords are stored only as bcrypt hashes. Never store plaintext credentials, JWTs, Groq keys, database URIs, or service tokens in collections. Encrypt sensitive PII/free text at rest using Atlas encryption capabilities and, where policy requires, application-level field encryption for selected values such as personal contact fields or raw employee feedback. TLS protects data in transit.

Access restrictions are enforced in Express through JWT, RBAC, organization/department scope, field projection, and audit logging. Department Managers receive only their scope; employees cannot read risk scores, recommendations, other employees, or HR audit records. Limit raw feedback visibility, prefer aggregate/NLP results when possible, and treat protected characteristics as fairness-analysis data rather than recommendation inputs. Database users use least-privilege roles; production access is restricted by Atlas network controls and secret management.

## 17. Future Expansion

- **Multi-tenancy:** `organizationId` on every tenant-scoped collection and unique indexes prefixed by it permit multiple companies without restructuring. Enforce it on every query.
- **HRMS integration:** add external-system identifiers, sync cursor/status, source metadata, and immutable import/sync history; core employee and period collections remain stable.
- **Payroll integration:** add a restricted compensation/payroll summary collection or secure reference, keeping raw payroll details isolated from general analytics.
- **Employee hierarchy:** the existing `managerEmployeeId` supports a basic tree; add hierarchy snapshots/path fields only if large recursive reporting needs demand it.
- **Real-time analytics:** add event/outbox records or managed queue/cache later while preserving current collections as system of record; derived aggregates can be introduced without changing core identifiers.

**Data governance principle:** RetentionAI stores HR data to support authorized, human-reviewed decision making. Prediction, NLP, RAG, and recommendation records require strict access controls, explainability lineage, retention rules, and auditable use.
