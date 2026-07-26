# Backend API Design Document (BADD): RetentionAI

**Scope:** REST API contract for RetentionAI. No Express code, controllers, database schemas, or implementation structure is defined here.  
**Version:** v1 • **Content type:** `application/json` except multipart document/import uploads.

## 1. API Architecture

### REST Principles

The API is resource-oriented, stateless, JSON-first, and served over HTTPS. Resources use plural lowercase kebab-case nouns; actions that begin a long-running operation use explicit subresources such as `batch-runs` or `generate`. All times are ISO-8601 UTC; identifiers are opaque strings/ObjectIds. The backend is the only public API; it coordinates the private Python AI service.

**Base URL:** `https://api.retentionai.example/api/v1`  
**Versioning:** URI major versioning (`/v1`). Breaking changes require `/v2`; additive optional fields do not. Deprecated fields/endpoints are announced before removal.

### Authentication and Authorization Flow

Login returns a short-lived access token and refresh token. Clients send `Authorization: Bearer <accessToken>` for protected calls. Express validates the token, account state, role permissions, organization scope, and—where relevant—department/resource ownership. A client-side protected route is not authorization; every API call is checked.

```text
Client -> HTTPS request + JWT -> authentication -> RBAC -> organization/department scope
       -> Zod/input validation -> domain operation -> data/AI dependency -> audit (when needed)
       -> standard success envelope OR standard error envelope
```

### Resource Contract Defaults

Unless an endpoint overrides them, all protected endpoints use the following contract.

| Item | Standard |
|---|---|
| Headers | `Authorization: Bearer <token>`, `Content-Type: application/json`, optional `X-Request-Id`. |
| Success response | `{ "success": true, "data": { ... }, "meta": { "requestId": "..." } }` |
| Error response | `{ "success": false, "error": { "code": "...", "message": "...", "details": [] }, "meta": { "requestId": "..." } }` |
| Common errors | `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CONFLICT`, `422 BUSINESS_RULE_VIOLATION`, `429 RATE_LIMITED`, `500 INTERNAL_ERROR`, `503 DEPENDENCY_UNAVAILABLE`. |
| Rate limits | General authenticated: 120 requests/min/user; list/search: 60/min; write: 30/min. Stricter endpoints are listed below. |
| Roles | SA=System Administrator, HRA=HR Administrator, HRM=HR Manager, DM=Department Manager, HRAna=HR Analyst, EMP=Employee. DM access is always department-scoped. |

## 2. Authentication APIs

| Method / URL | Purpose, auth, roles, rate | Request / validation | Success / errors | Example |
|---|---|---|---|---|
| `POST /auth/login` | Create token session. Public; 5/min/IP+email. | `{email,password}`; normalized email, password 8–128 chars. | `200` token/user; `401 INVALID_CREDENTIALS`, `423 ACCOUNT_LOCKED`. | Request `{"email":"asha@acme.example","password":"••••••••"}` → `{"success":true,"data":{"accessToken":"jwt","refreshToken":"opaque","user":{"id":"usr_1","role":"HR_MANAGER"}}}` |
| `POST /auth/logout` | Revoke current refresh token/session. Bearer; all; 20/min. | Optional `{refreshToken}`; token must belong to caller. | `204`; `401`. | `POST .../logout` → no body. |
| `POST /auth/refresh` | Exchange valid refresh token for new access token. Public-with-refresh; 20/min/IP. | `{refreshToken}` non-empty/active. | `200` tokens; `401 INVALID_REFRESH_TOKEN`. | `{"refreshToken":"opaque"}` → `{"success":true,"data":{"accessToken":"jwt"}}` |
| `POST /auth/forgot-password` | Start reset flow without revealing account existence. Public; 3/hour/email. | `{email}` valid email. | `202`; always generic result. | `{"email":"asha@acme.example"}` → `{"success":true,"data":{"message":"If eligible, reset instructions were sent."}}` |
| `POST /auth/reset-password` | Reset using one-time token. Public; 5/hour/token. | `{token,newPassword}`; token valid/unexpired, password policy. | `204`; `400 INVALID_RESET_TOKEN`, `422 WEAK_PASSWORD`. | `{"token":"reset...","newPassword":"StrongPass#2026"}` |
| `POST /auth/change-password` | Change authenticated user password. Bearer; all; 5/hour. | `{currentPassword,newPassword}`; verify old and policy. | `204`; `401 INVALID_CREDENTIALS`, `422 WEAK_PASSWORD`. | `{"currentPassword":"Old#12345","newPassword":"New#2026!"}` |
| `GET /auth/me` | Return current permitted profile/permissions. Bearer; all; 60/min. | No body. | `200`; `401`. | `GET .../me` → `{"success":true,"data":{"id":"usr_1","name":"Asha","role":"HR_MANAGER","permissions":["employee.read"]}}` |

## 3. User APIs

All use standard JSON headers and SA role unless stated. Users are soft-deactivated; deletion never removes audit identity.

| Method / URL | Purpose, roles, rate | Path/query/body and validation | Success / errors | Example |
|---|---|---|---|---|
| `POST /users` | Create account; SA; 20/min. | Body `{name,email,roleId,departmentId?,employeeId?}`; unique normalized email, valid role/scope. | `201`; `409 EMAIL_EXISTS`, `422 INVALID_ROLE_SCOPE`. | `{"name":"Asha Sharma","email":"asha@acme.example","roleId":"role_hrm"}` → user object. |
| `GET /users` | List/search users; SA; 60/min. | Query pagination/filter/sort/search standards. Filters: `roleId,status,departmentId`. | `200`; `400`. | `?page=1&pageSize=25&status=ACTIVE&sort=-createdAt` → paged users. |
| `GET /users/{userId}` | Read user; SA; 60/min. | `userId` valid ID. | `200`; `404`. | `/users/usr_1` → permitted user object. |
| `PATCH /users/{userId}` | Update non-credential profile/admin fields; SA; 30/min. | `{name,departmentId,employeeId}` at least one; valid refs. | `200`; `404`, `422`. | `{"departmentId":"dep_hr"}` → updated user. |
| `DELETE /users/{userId}` | Soft-deactivate/retire user; SA; 10/min. | `userId`; cannot delete self/last active SA. | `204`; `409 LAST_ADMIN`. | `DELETE /users/usr_8` → no body. |
| `POST /users/{userId}/deactivate` | Explicit deactivate; SA; 20/min. | Optional `{reason}` max 500 chars. | `200`; `409 LAST_ADMIN`. | `{"reason":"Role transition"}` → `{status:"INACTIVE"}` |
| `POST /users/{userId}/role` | Assign role; SA; 20/min. | `{roleId}` existing active role. | `200`; `422 INVALID_ROLE_SCOPE`. | `{"roleId":"role_analyst"}` → user with role. |

## 4. Role APIs

SA only; standard headers; 30/min writes and 60/min reads. Permission strings must come from the platform allow-list.

| Method / URL | Purpose / request / validation | Success / errors | Example |
|---|---|---|---|
| `POST /roles` | Create custom role; `{name,permissions}`; unique name, non-empty allowed permissions. | `201`; `409 ROLE_EXISTS`, `422 INVALID_PERMISSION`. | `{"name":"HR_VIEWER","permissions":["dashboard.read"]}` → role. |
| `GET /roles` | List roles and permissions. | `200`. | `GET /roles` → role array. |
| `GET /roles/{roleId}` | Get role detail. | `200`; `404`. | `/roles/role_hrm` → role object. |
| `PATCH /roles/{roleId}` | Update name/permissions; system roles may restrict changes. | `200`; `409 SYSTEM_ROLE_PROTECTED`. | `{"permissions":["dashboard.read","report.read"]}` |
| `DELETE /roles/{roleId}` | Delete unused custom role. | `204`; `409 ROLE_IN_USE`. | `DELETE /roles/role_viewer` |

## 5. Department APIs

SA/HRA manage; HRM/HRAna can list/read; DM reads own department only. General rate limits apply.

| Method / URL | Purpose / request / validation | Success / errors | Example |
|---|---|---|---|
| `POST /departments` | Create `{code,name,location?,costCenter?,managerEmployeeId?}`; unique code. | `201`; `409 DUPLICATE_CODE`. | `{"code":"ENG","name":"Engineering"}` |
| `GET /departments` | List departments with optional `status,managerEmployeeId,include=employeeCount`. | `200`; scope filtered. | `?status=ACTIVE&include=employeeCount` |
| `GET /departments/{departmentId}` | Read detail including permitted employee count. | `200`; `404`. | `/departments/dep_eng` |
| `PATCH /departments/{departmentId}` | Update allowed fields; valid manager in same organization. | `200`; `422 INVALID_MANAGER`. | `{"managerEmployeeId":"emp_10"}` |
| `DELETE /departments/{departmentId}` | Inactivate empty/reassigned department. | `204`; `409 EMPLOYEES_ASSIGNED`. | `DELETE /departments/dep_old` |
| `GET /departments/{departmentId}/employee-count` | Count active employees. SA/HRA/HRM; DM own only. | `200`; `403`. | → `{"count":42}` |
| `POST /departments/{departmentId}/manager` | Assign manager `{managerEmployeeId}`. SA/HRA. | `200`; `422`. | `{"managerEmployeeId":"emp_10"}` |

## 6. Employee APIs

SA/HRA/HRM/HRAna access as permitted; DM only assigned department; EMP only self profile. CSV route uses `multipart/form-data` and header `Authorization` only.

| Method / URL | Purpose / request / validation | Success / errors | Example |
|---|---|---|---|
| `POST /employees` | Create employee; SA/HRA; `{employeeCode,firstName,lastName,workEmail,departmentId,jobRole,jobLevel,employmentType,hireDate,...}`; code/email unique, dates/ranges valid. | `201`; `409 DUPLICATE_EMPLOYEE`, `422`. | `{"employeeCode":"EMP-1042","firstName":"Ravi","lastName":"Kumar","workEmail":"ravi@acme.example","departmentId":"dep_eng","jobRole":"Engineer","jobLevel":2,"employmentType":"FULL_TIME","hireDate":"2022-06-14"}` |
| `GET /employees` | Directory/search; HR roles/DM scoped. Query: `departmentId,jobRole,status,managerEmployeeId,riskLevel`, paging/sort/search. | `200`; `400`. | `?departmentId=dep_eng&riskLevel=HIGH&page=1&pageSize=25` |
| `GET /employees/{employeeId}` | Read permitted profile. | `200`; `403`, `404`. | `/employees/emp_1042` |
| `PATCH /employees/{employeeId}` | Update authorized fields; SA/HRA, HRM where granted. | `200`; `422`, `409`. | `{"jobLevel":3,"salaryBand":"B3"}` |
| `DELETE /employees/{employeeId}` | Soft-delete/inactivate employee; SA/HRA. | `204`; `409 ACTIVE_USER_LINKED`. | `DELETE /employees/emp_1042` |
| `GET /employees/{employeeId}/profile` | Consolidated permitted profile/risk/intervention summary. | `200`; scope checked. | `/employees/emp_1042/profile` |
| `GET /employees/{employeeId}/employment-history` | Read authorized employment-change timeline. | `200`; `403`. | `?page=1&pageSize=20` |
| `POST /employees/bulk-upload` | Upload CSV; SA/HRA/HRAna; multipart field `file`; CSV/max-size/template validation. 5/hour/user. | `202` import job; `400 INVALID_FILE`, `413 FILE_TOO_LARGE`. | form-data `file=employees.csv` → `{"data":{"importJobId":"imp_1","status":"VALIDATING"}}` |
| `GET /employees/bulk-upload/{importJobId}` | Read upload validation/progress; initiator or HR admin. | `200`; `403`, `404`. | → counts/error samples. |

## 7. Attendance APIs

SA/HRA/HRAna manage; HRM/DM read scoped summaries. All writes validate same-organization employee, date range, non-negative counts, and `presentDays <= workingDays`.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /attendance` | Create `{employeeId,periodStart,periodEnd,workingDays,presentDays,absenceCount,leaveDays?,lateArrivalCount?,overtimeHours?}`. | `201`; `409 DUPLICATE_PERIOD`, `422`. | `{"employeeId":"emp_1042","periodStart":"2026-06-01","periodEnd":"2026-06-30","workingDays":22,"presentDays":19,"absenceCount":3}` |
| `GET /attendance` | List with `employeeId,departmentId,from,to`; paged/scoped. | `200`. | `?employeeId=emp_1042&from=2026-01-01` |
| `GET /attendance/{attendanceId}` | Read period record. | `200`; `404`. | `/attendance/att_1` |
| `PATCH /attendance/{attendanceId}` | Correct permitted fields with reason in `{...,changeReason}`. | `200`; `422`. | `{"leaveDays":3,"changeReason":"Approved correction"}` |
| `DELETE /attendance/{attendanceId}` | Remove erroneous import/manual record; audit reason header/body required. | `204`; `409 LOCKED_PERIOD`. | `DELETE /attendance/att_1` |

## 8. Performance APIs

SA/HRA/HRAna write; HRM/DM read within scope. Write limit 30/min; standard headers.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /performance-reviews` | Create review with employee/reviewer/period/ratings; rating 1–5; end >= start. | `201`; `422`. | `{"employeeId":"emp_1042","reviewPeriodStart":"2026-01-01","reviewPeriodEnd":"2026-06-30","performanceRating":3.4,"status":"FINAL"}` |
| `GET /performance-reviews` | Paged/scoped list; filters `employeeId,departmentId,status,from,to`. | `200`. | `?departmentId=dep_eng&status=FINAL` |
| `GET /performance-reviews/{reviewId}` | Read review. | `200`; `404`. | `/performance-reviews/perf_1` |
| `PATCH /performance-reviews/{reviewId}` | Update draft or approved correction with reason. | `200`; `409 FINALIZED`. | `{"managerRating":3.5,"changeReason":"Calibration"}` |
| `DELETE /performance-reviews/{reviewId}` | Void draft/erroneous record. | `204`; `409 FINALIZED`. | `DELETE /performance-reviews/perf_1` |

## 9. Survey APIs

SA/HRA/HRM create/manage; EMP can list eligible surveys and submit own response; HR roles read aggregate/scoped responses.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /surveys` | Create `{title,description?,questions,audienceDepartmentIds?,opensAt,closesAt}`; 1–30 bounded questions; valid dates. | `201`; `422`. | `{"title":"Q3 Pulse","questions":[{"key":"satisfaction","type":"SCALE_1_5","text":"I am satisfied."}],"opensAt":"2026-08-01","closesAt":"2026-08-15"}` |
| `GET /surveys` | List eligible/manageable surveys; filters `status,departmentId`. | `200`. | `?status=OPEN` |
| `GET /surveys/{surveyId}` | Read permitted definition. | `200`; `403`. | `/surveys/survey_1` |
| `PATCH /surveys/{surveyId}` | Update draft/open allowed metadata; immutable versioning after responses. | `200`; `409 RESPONSES_EXIST`. | `{"closesAt":"2026-08-20"}` |
| `DELETE /surveys/{surveyId}` | Archive/delete empty draft. | `204`; `409 RESPONSES_EXIST`. | `DELETE /surveys/survey_1` |
| `POST /surveys/{surveyId}/responses` | EMP submits own answers; `{answers,isAnonymous?}`; one response/employee/survey unless allowed; answers match question keys/types. 10/min. | `201`; `409 ALREADY_RESPONDED`, `422`. | `{"answers":[{"questionKey":"satisfaction","value":2}],"isAnonymous":false}` |
| `GET /surveys/{surveyId}/responses` | HR aggregate or permitted response list; query `aggregate=true`, paging. | `200`; `403`. | `?aggregate=true` → scores/counts. |

## 10. Prediction APIs

SA/HRA/HRAna may run batch; HRM may request permitted individual prediction; DM views scope only. Prediction creation is 20/min/user; batch 5/hour/user; AI dependency timeouts return `503` or async status.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /predictions` | Predict one employee `{employeeId}`; checks feature readiness and scope. | `202` job/result reference; `422 INCOMPLETE_FEATURES`, `503 AI_UNAVAILABLE`. | `{"employeeId":"emp_1042"}` → `{"data":{"predictionJobId":"pj_1","status":"PENDING"}}` |
| `POST /predictions/batch-runs` | Start scoped batch `{departmentId?,employeeIds?,reason?}`; max configured population. | `202`; `422`, `429`. | `{"departmentId":"dep_eng","reason":"Monthly refresh"}` |
| `GET /predictions/batch-runs/{runId}` | Batch status/counts/errors. | `200`; `403`, `404`. | → `{status:"COMPLETED",successCount:42,failedCount:1}` |
| `GET /predictions` | List current predictions; filters `employeeId,departmentId,riskLevel,modelId,from,to`; paged/scoped. | `200`. | `?departmentId=dep_eng&riskLevel=HIGH` |
| `GET /predictions/{predictionId}` | Read current prediction detail. | `200`; `403`, `404`. | `/predictions/pred_1` |
| `GET /employees/{employeeId}/prediction-history` | Read versioned prediction history. | `200`; paging/scope. | `?page=1&pageSize=20&sort=-predictedAt` |
| `GET /prediction-history/{historyId}/explanation` | Get SHAP/risk factors for authorized history. | `200`; `409 EXPLANATION_PENDING`. | → `{riskFactors:[...]}` |
| `GET /predictions/{predictionId}/status` | Get prediction/job state. | `200`; `404`. | → `{status:"SUCCESS",modelVersion:"v1.2"}` |

## 11. Intervention APIs

HRM/HRA create; assigned owner updates; DM only employees/actions in own scope. All changes create audit entries. Write limit 30/min.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /interventions` | Create `{employeeId,type,priority,title,description?,ownerUserId,dueDate?}`; owner authorized/same scope. | `201`; `422`, `403`. | `{"employeeId":"emp_1042","type":"CAREER_DISCUSSION","priority":"HIGH","title":"Career discussion","ownerUserId":"usr_1","dueDate":"2026-07-20"}` |
| `GET /interventions` | Paged list filters `employeeId,ownerUserId,status,priority,dueBefore`; scoped. | `200`. | `?status=PLANNED&dueBefore=2026-08-01` |
| `GET /interventions/{interventionId}` | Read action/timeline. | `200`; `403`. | `/interventions/int_1` |
| `PATCH /interventions/{interventionId}` | Update permitted non-status fields. | `200`; `409 CLOSED`. | `{"dueDate":"2026-07-25"}` |
| `POST /interventions/{interventionId}/owner` | Assign owner `{ownerUserId}`. | `200`; `422 INVALID_OWNER`. | `{"ownerUserId":"usr_7"}` |
| `POST /interventions/{interventionId}/status` | Transition `{status,outcome?,note?}`; allowed state transition enforced. | `200`; `422 INVALID_TRANSITION`. | `{"status":"IN_PROGRESS","note":"Meeting scheduled"}` |
| `POST /interventions/{interventionId}/notes` | Append `{note}` 1–2000 chars. | `201`; `422`. | `{"note":"Employee requested mentorship options."}` |
| `GET /interventions/{interventionId}/history` | Read activity timeline. | `200`; scope enforced. | `?page=1&pageSize=50` |

## 12. Dashboard APIs

SA/HRA/HRM/HRAna; DM receives own-department aggregates only. Read limit 60/min. All queries accept date ranges and respond with role-scoped aggregate data, never unrestricted employee detail.

| Method / URL | Purpose / query / success | Example |
|---|---|---|
| `GET /dashboard/kpis` | KPI cards; query `departmentId?,from?,to?`; `200` total employees, high risk, average risk, intervention counts. | `?departmentId=dep_eng&from=2026-01-01&to=2026-06-30` |
| `GET /dashboard/risk-distribution` | Low/medium/high distribution; filters `departmentId,jobRole`. | → `{low:30,medium:9,high:3}` |
| `GET /dashboard/department-analytics` | Department comparisons, optional `departmentId`. | → aggregate rows/chart series. |
| `GET /dashboard/monthly-trends` | Monthly risk/intervention trend; query `from,to,departmentId`. | → `{series:[{month:"2026-06",highRisk:3}]}` |
| `GET /dashboard/risk-heatmap` | Department/job-role heatmap; query `dimension=department|jobRole`. | → matrix data. |

Errors: `400 INVALID_DATE_RANGE`, `403`, `429`; all use standard headers/auth and no body.

## 13. Reports APIs

SA/HRA/HRM/HRAna; DM only scoped reports. Generate limit 10/hour/user. Report content is asynchronous where needed and has a time-limited download.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /reports` | Generate `{type,format,criteria}`; type allow-list, format PDF/CSV, scope checked. | `202`; `422`, `403`. | `{"type":"DEPARTMENT_RISK","format":"PDF","criteria":{"departmentId":"dep_eng","from":"2026-01-01","to":"2026-06-30"}}` |
| `GET /reports` | List requester/permitted reports; paging/filter `status,type`. | `200`. | `?status=READY` |
| `GET /reports/{reportId}` | Metadata/status. | `200`; `403`, `404`. | → `{status:"READY",expiresAt:"..."}` |
| `GET /reports/{reportId}/download` | Redirect/stream approved PDF/CSV file. | `200` file/`302`; `409 NOT_READY`, `410 EXPIRED`. | `Accept: application/pdf` |
| `DELETE /reports/{reportId}` | Delete own/permitted generated artifact early. | `204`; `403`. | `DELETE /reports/rep_1` |

## 14. Knowledge Base APIs

SA/HRA manage documents; HRM may list/read metadata only where permitted. Upload uses multipart. Upload limit 20/day/user, allowed type/size configured.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /knowledge-bases` | Create `{name,description?,allowedRoleIds}`. | `201`; `409`. | `{"name":"HR Policies","allowedRoleIds":["role_hrm"]}` |
| `GET /knowledge-bases` | List permitted bases. | `200`. | `GET /knowledge-bases` |
| `POST /knowledge-bases/{knowledgeBaseId}/documents` | Upload `multipart/form-data`: `file`, `title?`, `category?`; validate type/size. | `202`; `400`, `413`, `422`. | form-data `file=policy.pdf` → `{documentId:"doc_1",status:"PROCESSING"}` |
| `GET /documents` | List permitted metadata; filters `knowledgeBaseId,status,category`, paging/search. | `200`. | `?knowledgeBaseId=kb_1&status=PROCESSED` |
| `GET /documents/{documentId}` | Read permitted document metadata/status. | `200`; `403`. | `/documents/doc_1` |
| `GET /documents/{documentId}/status` | Processing state/errors (admin/uploader). | `200`; `403`. | → `{status:"PROCESSED",chunkCount:18}` |
| `DELETE /documents/{documentId}` | Soft delete / schedule vector cleanup; SA/HRA. | `202`; `409 PROCESSING`. | `DELETE /documents/doc_1` |

## 15. Chat APIs

HRM/HRA/HRAna and scoped DM; no employee access to attrition advisor. Chat limit 20/min/user, 200/day/user; all responses carry citations or explicit insufficient-evidence status.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /chat-sessions` | Start `{title?,targetEmployeeId?,targetDepartmentId?}`; scope checked. | `201`; `403`, `422`. | `{"title":"Retention options","targetEmployeeId":"emp_1042"}` |
| `GET /chat-sessions` | List own/permitted sessions; paging/status. | `200`. | `?status=ACTIVE&page=1` |
| `GET /chat-sessions/{sessionId}` | Read header and permitted messages. | `200`; `403`. | `/chat-sessions/chat_1` |
| `POST /chat-sessions/{sessionId}/messages` | Continue chat `{message}`; 1–4000 chars, prompt-injection/unsafe input controls. | `202`/`200`; `422`, `503`, `429`. | `{"message":"What policy-backed options should HR review?"}` → cited assistant message. |
| `GET /chat-sessions/{sessionId}/messages` | Paginated history. | `200`. | `?page=1&pageSize=50&sort=createdAt` |
| `GET /chat-messages/{messageId}/sources` | Citation details visible only if source is permitted. | `200`; `403`. | → source title/locator/snippet. |

## 16. Recommendation APIs

HRM/HRA/HRAna and scoped DM. Generate limit 10/hour/user; output is advisory and requires human review.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `POST /recommendations/generate` | Generate `{employeeId,question?,predictionHistoryId?}`; scope/evidence readiness checked. | `202`/`200`; `422`, `503`, `429`. | `{"employeeId":"emp_1042","question":"Suggest policy-grounded retention options."}` |
| `GET /recommendations` | List permitted history; filters `employeeId,requestedBy,from,to`; paged. | `200`. | `?employeeId=emp_1042` |
| `GET /recommendations/{recommendationId}` | Read recommendation, evidence, citations, review flag. | `200`; `403`. | `/recommendations/rec_1` |
| `POST /recommendations/{recommendationId}/feedback` | Submit `{rating,comment?}`; rating 1–5. | `200`; `422`. | `{"rating":4,"comment":"Useful starting point."}` |

## 17. Notification APIs

All authenticated users read only their own notifications. Standard read rate; write/delete 30/min.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `GET /notifications` | Paged list; filters `read,type`. | `200`. | `?read=false&page=1&pageSize=25` |
| `POST /notifications/{notificationId}/read` | Mark own notification read. | `200`; `404`. | → `{readAt:"2026-07-26T...Z"}` |
| `POST /notifications/read-all` | Mark all current user notifications read. | `200`. | `{}` |
| `DELETE /notifications/{notificationId}` | Delete/hide own notification. | `204`; `404`. | `DELETE /notifications/note_1` |

## 18. Audit APIs

SA only; 30/min; sensitive response fields are always redacted. Audit records are append-only.

| Method / URL | Purpose / query | Success / errors | Example |
|---|---|---|---|
| `GET /audit-logs` | Paged log search; filters `actorUserId,action,entityType,entityId,from,to`; sorting restricted to `createdAt`. | `200`; `400`, `403`. | `?entityType=EMPLOYEE&from=2026-07-01&sort=-createdAt` |
| `GET /audit-logs/{auditLogId}` | Read one redacted event. | `200`; `404`. | `/audit-logs/audit_1` |

## 19. Model APIs

SA reads/administers model registry; HRM/HRA/HRAna may read currently active metadata/metrics. General read limits; state changes 10/hour.

| Method / URL | Purpose / request | Success / errors | Example |
|---|---|---|---|
| `GET /models` | List visible model metadata; filters `status,algorithm`. | `200`. | `?status=APPROVED` |
| `GET /models/current` | Return current approved model summary/metrics. | `200`; `404 NO_ACTIVE_MODEL`. | → `{version:"v1.2",metrics:{f1:0.76,recall:0.81}}` |
| `GET /models/{modelId}` | Detail, features, metrics, governance metadata. | `200`; `403`. | `/models/model_12` |
| `GET /models/{modelId}/metrics` | Evaluation metrics, fairness/calibration summary where available. | `200`. | `/models/model_12/metrics` |
| `POST /models/{modelId}/activate` | SA activates approved model `{reason}`; cannot activate unapproved model. | `200`; `409 NOT_APPROVED`. | `{"reason":"Approved evaluation run"}` |

## 20. Endpoint Contract Checklist

Every operation above inherits the standard headers, success/error envelopes, general errors, and general rate limits in Section 1. Each row explicitly supplies method, URL, purpose, authentication/roles, request inputs, validation, success/error status, rate-limit override, and an example. Path values are opaque IDs (`{userId}`, `{employeeId}`, etc.); absent query/body cells mean none. Multipart upload endpoints replace JSON `Content-Type` with browser-generated multipart content type. All request/response bodies must reject unknown critical fields or safely ignore them according to documented compatibility policy.

## 21. Error Response Standard

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "workEmail", "rule": "email", "message": "Provide a valid work email." }
    ]
  },
  "meta": { "requestId": "req_01H...", "timestamp": "2026-07-26T12:00:00Z" }
}
```

`message` is safe for end users. `code` is stable for clients. `details` is present only for correctable validation/business errors. Authentication/authorization errors never disclose protected resource existence. Dependency errors may include a retryable flag but never provider secrets or stack traces.

## 22. Success Response Standard

Single resource:

```json
{ "success": true, "data": { "id": "emp_1042", "status": "ACTIVE" }, "meta": { "requestId": "req_01H..." } }
```

Asynchronous creation returns `202` with `{id,status,submittedAt}`. `204 No Content` is used for successful logout/deactivate/delete operations that need no response body. File downloads return the approved file stream/redirect rather than JSON.

## 23. Pagination Standard

Offset pagination is used for MVP list APIs:

```text
GET /employees?page=1&pageSize=25
```

Allowed values: `page` integer ≥1, default 1; `pageSize` integer 1–100, default 25. Response:

```json
{
  "success": true,
  "data": { "items": [] },
  "meta": { "page": 1, "pageSize": 25, "totalItems": 240, "totalPages": 10, "requestId": "req_01H..." }
}
```

High-volume future event streams may introduce cursor pagination in a later major-compatible extension.

## 24. Filtering Standard

Filtering uses allow-listed query parameters, never arbitrary field/query expressions. Repeated values use comma-separated OR values where explicitly supported: `riskLevel=HIGH,MEDIUM`. Date filters use `from`/`to` in ISO-8601 format; numeric ranges use documented fields such as `minRiskScore`/`maxRiskScore`. Example:

```text
GET /predictions?departmentId=dep_eng&riskLevel=HIGH&from=2026-01-01&to=2026-06-30
```

Unknown, disallowed, malformed, or cross-scope filters return `400 INVALID_FILTER` or are ignored only when explicitly documented as optional UI-only parameters.

## 25. Sorting Standard

`sort` accepts one allow-listed field; prefix `-` means descending, otherwise ascending. Default sorts are resource-specific—typically `-createdAt`, `-predictedAt`, or `name`. Examples: `sort=-predictedAt`, `sort=name`. Sorting by sensitive, unindexed, or non-deterministic fields is rejected with `400 INVALID_SORT`.

## 26. Search Standard

`q` is a 2–100-character normalized text term. Directory search matches permitted employee name, employee code, and work email; user search matches name/email; document search matches title/tags/allowed metadata. Raw feedback and chunk text are not globally searchable through generic APIs. Example: `GET /employees?q=ravi&page=1&pageSize=25`. Search is rate-limited as a list operation and scoped before results are returned.

## 27. Security

- **JWT:** signed, short-lived access tokens; refresh tokens are rotated/revocable and never logged.
- **RBAC and scope:** every operation validates role permission plus organization/department/ownership constraints.
- **Input validation:** Zod validates shape, type, enum, length, date/order, numeric range, IDs, and business rules before processing.
- **Rate limiting:** per-IP limits for public auth; per-user and per-operation limits for write, prediction, upload, chat, recommendation, and report generation.
- **CORS:** allow only configured trusted frontend origins, required methods/headers, and no broad wildcard credentials policy.
- **Helmet/security headers:** set common HTTP security headers; force HTTPS in production.
- **Sanitization:** normalize strings/emails, reject operator injection/suspicious query keys, sanitize file names/metadata, escape UI-rendered content, and isolate prompt input from system instructions.
- **Data minimization:** projections omit password hashes, tokens, hidden PII, raw confidential feedback, and unsafe model internals unless explicitly permitted.

## 28. API Flow Diagrams

### Login

```text
React -> POST /auth/login -> Express credential validation -> user store
      -> password/status check -> JWT/refresh issuance -> standard success -> React session
```

### Prediction

```text
React -> POST /predictions -> JWT/RBAC/scope/feature check -> Python AI service
      -> model + SHAP -> Express validates result -> prediction/audit persistence
      -> 202 job or 200 result -> React risk view
```

### Dashboard

```text
React -> GET /dashboard/kpis?filters -> JWT/RBAC/scope -> aggregate/query MongoDB
      -> role-safe KPI/chart envelope -> React/Recharts
```

### Chat

```text
React -> POST /chat-sessions/{id}/messages -> scope/limit check -> Python agent/RAG
      -> ChromaDB retrieval -> Groq generation -> citation/guardrail check
      -> persisted permitted history/audit -> standard message response -> React
```

### Document Upload

```text
React -> multipart POST /knowledge-bases/{id}/documents -> role/type/size validation
      -> document storage + processing record -> Python ingestion/chunk/embed -> ChromaDB
      -> status update -> document-status response / UI polling
```

## 29. Future APIs

Future versions may add tenant administration (`/organizations`), HRMS connector configuration/sync status, payroll-summary integration, webhooks for completed imports/predictions, scheduled report subscriptions, SSO/SCIM, model-retraining workflow, fairness review dashboards, advanced consent/deletion workflows, and cursor-based analytics exports. These should preserve the v1 envelope, versioning, security, scope, and audit conventions rather than bypassing them.

**Governance requirement:** No endpoint may expose an AI output as an automated employee decision. Prediction, NLP, RAG, and recommendation operations must communicate uncertainty, preserve evidence lineage where available, and require authorized human review.
