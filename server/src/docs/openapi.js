/**
 * @file openapi.js
 * @description Hand-authored OpenAPI 3.0 specification for the entire Express API
 * — Sprint 10, Part 3. Not generated from JSDoc comments (swagger-jsdoc) because
 * annotating 90+ route handlers individually would scatter documentation across
 * 25 route files; a single source of truth here is easier to keep accurate as
 * routes change. Served at GET /api-docs (Swagger UI) and GET /api-docs.json
 * (raw spec) — see app.js.
 */

const ENVELOPE = {
  SuccessEnvelope: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { type: 'object' },
      meta: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  ErrorEnvelope: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      error: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'One or more fields are invalid.' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                rule: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      meta: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

const STANDARD_RESPONSES = {
  200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } } },
  201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } } },
  400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  401: { description: 'Not authenticated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  403: { description: 'Not authorized (RBAC)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
  404: { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } } },
};

/** Declarative route table — [method, path, tag, summary, needsAuth, extraResponseCodes]. */
const ROUTE_TABLE = [
  // Health / Monitoring
  ['get', '/health', 'Monitoring', 'Fast liveness probe (no external calls)', false],
  ['get', '/health/deep', 'Monitoring', 'Deep health check — Mongo, AI service, memory/CPU, pipeline latency', false],

  // Auth
  ['post', '/auth/login', 'Auth', 'Log in with email + password', false],
  ['post', '/auth/logout', 'Auth', 'Revoke the current refresh token', true],
  ['post', '/auth/refresh', 'Auth', 'Exchange a refresh token for a new access token', false],
  ['get', '/auth/me', 'Auth', 'Get the current authenticated user profile', true],

  // Users
  ['post', '/users', 'Users', 'Create a user account', true],
  ['get', '/users', 'Users', 'List user accounts', true],
  ['get', '/users/{userId}', 'Users', 'Get one user account', true],

  // Departments
  ['get', '/departments', 'Departments', 'List departments', true],
  ['get', '/departments/{departmentId}', 'Departments', 'Get one department', true],

  // Employees
  ['get', '/employees', 'Employees', 'List/search employees (paginated)', true],
  ['get', '/employees/{employeeId}', 'Employees', 'Get one employee profile', true],
  ['get', '/employees/{employeeId}/360', 'Employees', 'Get the full 360° employee view (HR + AI + decisions)', true],
  ['get', '/employees/{employeeId}/explain', 'Employees', "Get the employee's latest SHAP explanation", true],
  ['get', '/employees/{employeeId}/ai-insights', 'Employees', "Get the employee's merged AI insight summary", true],

  // HR operational data (attendance/performance/training/promotions/survey/feedback/notes — generic collection router)
  ['get', '/hr/{collection}', 'HR Records', 'List records in an HR collection (attendance, performance, training, promotions, ...)', true],
  ['get', '/hr/{collection}/{id}', 'HR Records', 'Get one HR record', true],
  ['post', '/hr/{collection}', 'HR Records', 'Create one HR record', true],
  ['post', '/hr/{collection}/bulk-import', 'HR Records', 'Bulk-import HR records from CSV', true],
  ['put', '/hr/{collection}/{id}', 'HR Records', 'Update one HR record', true],
  ['delete', '/hr/{collection}/{id}', 'HR Records', 'Delete one HR record', true],

  // Analytics
  ['get', '/analytics/dashboard-summary', 'Analytics', 'Workforce dashboard summary (KPIs, distributions)', true],
  ['get', '/analytics/kpis', 'Analytics', 'Headline KPI cards', true],
  ['get', '/analytics/departments', 'Analytics', 'Per-department analytics', true],
  ['get', '/analytics/monthly-trends', 'Analytics', 'Monthly hiring/attrition trend series', true],
  ['get', '/analytics/demographics', 'Analytics', 'Workforce demographic breakdowns', true],
  ['get', '/analytics/employees', 'Analytics', 'Employee-level insight aggregation', true],
  ['get', '/analytics/hr-metrics', 'Analytics', 'HR operational metrics', true],
  ['get', '/analytics/performance', 'Analytics', 'Performance analytics', true],
  ['get', '/analytics/attendance', 'Analytics', 'Attendance analytics', true],
  ['get', '/analytics/training', 'Analytics', 'Training analytics', true],
  ['get', '/analytics/ai/feature-importance', 'Analytics', 'Global SHAP feature importance', true],
  ['get', '/analytics/ai/plots/{plotType}', 'Analytics', 'Global SHAP plot image', true],

  // Reports (CSV export)
  ['get', '/reports/employees/csv', 'Reports', 'Export employee summary as CSV', true],
  ['get', '/reports/departments/csv', 'Reports', 'Export department summary as CSV', true],
  ['get', '/reports/attendance/csv', 'Reports', 'Export attendance report as CSV', true],
  ['get', '/reports/performance/csv', 'Reports', 'Export performance report as CSV', true],
  ['get', '/reports/training/csv', 'Reports', 'Export training report as CSV', true],
  ['get', '/reports/promotions/csv', 'Reports', 'Export promotion report as CSV', true],

  // Search
  ['get', '/search', 'Search', 'Categorized global search across employees, departments, recommendations, tasks, interventions, comments, knowledge', true],

  // AI (prediction pipeline)
  ['post', '/ai/train', 'AI — Prediction', 'Trigger model (re)training', true],
  ['post', '/ai/predict/batch', 'AI — Prediction', 'Generate predictions for many employees', true],
  ['get', '/ai/predict/{id}', 'AI — Prediction', 'Get the stored prediction for one employee', true],
  ['post', '/ai/predict/{id}', 'AI — Prediction', 'Generate a fresh prediction for one employee', true],
  ['get', '/ai/model/info', 'AI — Prediction', 'Active model metadata', true],
  ['get', '/ai/model/metrics', 'AI — Prediction', 'Active model evaluation metrics', true],
  ['get', '/ai/dashboard', 'AI — Prediction', 'Risk-count dashboard widget data', true],

  // Explainability (SHAP)
  ['get', '/explain/{id}', 'AI — Explainability', 'Get the cached SHAP explanation for one employee', true],
  ['post', '/explain/{id}', 'AI — Explainability', 'Generate a fresh SHAP explanation for one employee', true],
  ['post', '/explain/batch', 'AI — Explainability', 'Generate SHAP explanations for many employees', true],
  ['get', '/explain/global/feature-importance', 'AI — Explainability', 'Global SHAP feature importance ranking', true],
  ['get', '/explain/global/department-drivers', 'AI — Explainability', 'Top attrition driver per department', true],

  // Employee Intelligence (NLP)
  ['get', '/employee-intelligence/{id}', 'AI — Employee Intelligence', 'Get the cached Employee Intelligence profile', true],
  ['post', '/employee-intelligence/{id}', 'AI — Employee Intelligence', 'Generate a fresh Employee Intelligence profile', true],
  ['post', '/employee-intelligence/batch', 'AI — Employee Intelligence', 'Generate profiles for many employees', true],
  ['get', '/employee-intelligence/dashboard/summary', 'AI — Employee Intelligence', 'Workforce sentiment/burnout/emotion aggregation', true],

  // Knowledge (RAG)
  ['get', '/knowledge/documents', 'AI — Knowledge (RAG)', 'List knowledge base documents', true],
  ['get', '/knowledge/documents/{id}', 'AI — Knowledge (RAG)', 'Get one knowledge document', true],
  ['post', '/knowledge/query', 'AI — Knowledge (RAG)', 'Ask a natural-language question against the knowledge base', true],
  ['get', '/knowledge/search', 'AI — Knowledge (RAG)', 'Keyword/semantic search over the knowledge base', true],
  ['get', '/knowledge/statistics', 'AI — Knowledge (RAG)', 'Knowledge base statistics', true],
  ['get', '/knowledge/employees/{employeeId}/insights', 'AI — Knowledge (RAG)', 'Policy references relevant to one employee', true],
  ['post', '/knowledge/documents/{id}/reindex', 'AI — Knowledge (RAG)', 'Re-index one document', true],
  ['post', '/knowledge/reindex-all', 'AI — Knowledge (RAG)', 'Re-index the entire knowledge base', true],
  ['delete', '/knowledge/documents/{id}', 'AI — Knowledge (RAG)', 'Delete one knowledge document', true],

  // Decisions (Decision Intelligence)
  ['get', '/decisions/dashboard/summary', 'AI — Decisions', 'Org-wide recommendation dashboard', true],
  ['get', '/decisions/dashboard/manager', 'AI — Decisions', "Manager's team recommendation dashboard", true],
  ['get', '/decisions/{employeeId}', 'AI — Decisions', "Get the employee's latest AI recommendation", true],
  ['get', '/decisions/{employeeId}/history', 'AI — Decisions', 'Full recommendation history for one employee', true],
  ['post', '/decisions/batch', 'AI — Decisions', 'Generate recommendations for many employees', true],
  ['post', '/decisions/{employeeId}/generate', 'AI — Decisions', 'Generate a fresh recommendation for one employee', true],
  ['patch', '/decisions/status/{id}', 'AI — Decisions', 'Accept/dismiss/review a recommendation', true],

  // Executive
  ['get', '/executive/dashboard', 'Executive', 'Executive Workforce Intelligence dashboard', true],
  ['get', '/executive/insights', 'Executive', 'Generated executive insights', true],
  ['get', '/executive/intervention-analytics', 'Executive', 'Intervention analytics rollup', true],
  ['get', '/executive/roi', 'Executive', 'ROI analytics rollup', true],
  ['get', '/executive/forecast', 'Executive', '30/60/90-day risk forecast', true],
  ['get', '/executive/reports/{format}', 'Executive', 'Download an executive report (pdf, docx, or csv)', true],
  ['get', '/executive/alerts', 'Executive', 'List executive alerts', true],
  ['post', '/executive/alerts/generate', 'Executive', 'Scan for new executive alerts', true],
  ['patch', '/executive/alerts/{id}/dismiss', 'Executive', 'Dismiss an alert', true],
  ['patch', '/executive/alerts/{id}/review', 'Executive', 'Mark an alert reviewed', true],
  ['patch', '/executive/alerts/{id}/assign', 'Executive', 'Assign an alert to an owner', true],

  // Workflow — Interventions
  ['get', '/interventions', 'Workflow — Interventions', 'List interventions', true],
  ['get', '/interventions/overdue', 'Workflow — Interventions', 'List overdue interventions', true],
  ['get', '/interventions/{id}', 'Workflow — Interventions', 'Get one intervention (incl. approval chain)', true],
  ['post', '/interventions', 'Workflow — Interventions', 'Create an intervention', true],
  ['post', '/interventions/from-decision', 'Workflow — Interventions', "Create an intervention from an employee's AI recommendation", true],
  ['patch', '/interventions/{id}/status', 'Workflow — Interventions', 'Transition an intervention to its next lifecycle status', true],

  // Workflow — Tasks
  ['get', '/tasks', 'Workflow — Tasks', 'List tasks', true],
  ['get', '/tasks/overdue', 'Workflow — Tasks', 'List overdue tasks', true],
  ['get', '/tasks/due-today', 'Workflow — Tasks', 'List tasks due today', true],
  ['get', '/tasks/{id}', 'Workflow — Tasks', 'Get one task', true],
  ['post', '/tasks', 'Workflow — Tasks', 'Create a task', true],
  ['patch', '/tasks/{id}/assign', 'Workflow — Tasks', 'Assign/reassign a task', true],
  ['patch', '/tasks/{id}/complete', 'Workflow — Tasks', 'Mark a task complete', true],
  ['patch', '/tasks/{id}/cancel', 'Workflow — Tasks', 'Cancel a task', true],
  ['patch', '/tasks/{id}/escalate', 'Workflow — Tasks', 'Escalate a task', true],

  // Workflow — Approvals
  ['get', '/approvals', 'Workflow — Approvals', 'Get the approval chain for an entity', true],
  ['patch', '/approvals/{id}/decide', 'Workflow — Approvals', 'Record an approve/reject decision at the current chain level', true],

  // Workflow — Notifications
  ['get', '/notifications', 'Workflow — Notifications', "List the caller's notifications", true],
  ['patch', '/notifications/read-all', 'Workflow — Notifications', 'Mark all notifications read', true],
  ['patch', '/notifications/{id}/read', 'Workflow — Notifications', 'Mark one notification read', true],
  ['patch', '/notifications/{id}/archive', 'Workflow — Notifications', 'Archive one notification', true],
  ['patch', '/notifications/{id}/dismiss', 'Workflow — Notifications', 'Dismiss one notification', true],
  ['get', '/notifications/preferences', 'Workflow — Notifications', "Get the caller's notification channel preferences", true],
  ['patch', '/notifications/preferences', 'Workflow — Notifications', 'Update notification channel preferences', true],

  // Workflow — Comments
  ['get', '/comments', 'Workflow — Comments', 'List threaded comments for an entity', true],
  ['post', '/comments', 'Workflow — Comments', 'Post a comment (optionally a threaded reply)', true],
  ['delete', '/comments/{id}', 'Workflow — Comments', 'Soft-delete a comment', true],

  // Workflow — Attachments
  ['get', '/attachments', 'Workflow — Attachments', 'List attachments for an entity', true],
  ['get', '/attachments/{id}/download', 'Workflow — Attachments', 'Download an attachment', true],
  ['post', '/attachments', 'Workflow — Attachments', 'Upload an attachment (multipart/form-data)', true],

  // Workflow — Dashboard / Automation / Audit
  ['get', '/workflow/dashboard', 'Workflow — HR Operations', 'HR Operations Dashboard rollup', true],
  ['get', '/automation/jobs', 'Workflow — Automation', 'List automation jobs and their last run', true],
  ['post', '/automation/jobs/{jobName}/run', 'Workflow — Automation', 'Manually trigger an automation job', true],
  ['get', '/audit', 'Compliance — Audit', 'List audit log entries (filterable)', true],
  ['get', '/audit/export', 'Compliance — Audit', 'Export the audit log as CSV', true],
  ['get', '/audit/timeline', 'Compliance — Audit', 'Unified activity timeline', true],
];

function pathToOpenApiTemplate(path) {
  return path.replace(/\{([^}]+)\}/g, '{$1}');
}

function extractParams(path) {
  const matches = [...path.matchAll(/\{([^}]+)\}/g)];
  return matches.map((m) => ({
    name: m[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

function buildPaths() {
  const paths = {};
  for (const [method, path, tag, summary, needsAuth] of ROUTE_TABLE) {
    const key = pathToOpenApiTemplate(path);
    if (!paths[key]) paths[key] = {};
    paths[key][method] = {
      tags: [tag],
      summary,
      security: needsAuth ? [{ bearerAuth: [] }] : [],
      parameters: extractParams(path),
      responses: needsAuth
        ? { 200: STANDARD_RESPONSES[200], 400: STANDARD_RESPONSES[400], 401: STANDARD_RESPONSES[401], 403: STANDARD_RESPONSES[403], 404: STANDARD_RESPONSES[404] }
        : { 200: STANDARD_RESPONSES[200], 400: STANDARD_RESPONSES[400] },
    };
  }
  return paths;
}

const paths = buildPaths();

// /health and /health/deep are mounted at the application root, not under
// /api/v1 like every other route (see app.js) — override the server for
// just these two operations rather than the whole document.
const rootServers = [
  { url: 'http://localhost:5000', description: 'Local development (root, no /api/v1 prefix)' },
  { url: 'https://api.retentionai.example.com', description: 'Production (root, no /api/v1 prefix)' },
];
paths['/health'].get.servers = rootServers;
paths['/health/deep'].get.servers = rootServers;

// ── Hand-enriched examples for the highest-traffic / most illustrative endpoints ──

paths['/auth/login'].post.requestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } },
      },
      example: { email: 'admin@example.test', password: 'Admin#12345' },
    },
  },
};
paths['/auth/login'].post.responses[200] = {
  description: 'Session issued',
  content: {
    'application/json': {
      example: {
        success: true,
        data: {
          accessToken: 'eyJhbGciOi...',
          refreshToken: 'a1b2c3...',
          user: { id: '6a6b...', name: 'System Admin', email: 'admin@example.test', role: 'ADMIN' },
        },
        meta: { requestId: '7305a675-...', timestamp: '2026-07-30T13:33:05.403Z' },
      },
    },
  },
};

paths['/employees'].get.parameters.push(
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
  { name: 'departmentId', in: 'query', schema: { type: 'string' } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
);

paths['/ai/predict/{id}'].post.responses[200] = {
  description: 'Prediction generated',
  content: {
    'application/json': {
      example: {
        success: true,
        data: { employeeId: '6a6b...', riskScore: 0.069, riskLevel: 'LOW', confidence: 0.931, predictedAt: '2026-07-30T14:39:45Z', modelVersion: 'v2.0', status: 'SUCCESS' },
      },
    },
  },
};

paths['/decisions/{employeeId}/generate'].post.responses[200] = {
  description: 'AI recommendation generated',
  content: {
    'application/json': {
      example: {
        success: true,
        data: { _id: '6a6b...', recommendationType: 'WELLBEING_SUPPORT', priority: 'HIGH', confidence: 0.82, status: 'PENDING', recommendedActions: [{ category: 'Wellbeing', description: 'Schedule a 1:1 check-in', priority: 'HIGH' }] },
      },
    },
  },
};

paths['/interventions'].post.requestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['employeeId', 'title', 'priority'],
        properties: {
          employeeId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
          dueDate: { type: 'string', format: 'date' },
        },
      },
      example: { employeeId: '6a6b61bd88bd95a656e0ac6e', title: 'Retention conversation with manager', priority: 'HIGH', dueDate: '2026-08-15' },
    },
  },
};

paths['/interventions/{id}/status'].patch.requestBody = {
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'] },
          note: { type: 'string' },
          assignedToUserId: { type: 'string' },
        },
      },
      example: { status: 'PENDING_APPROVAL' },
    },
  },
};
paths['/interventions/{id}/status'].patch.responses[409] = {
  description: 'Invalid lifecycle transition',
  content: { 'application/json': { example: { success: false, error: { code: 'INVALID_TRANSITION', message: 'Cannot move an intervention from PENDING_APPROVAL to ASSIGNED.' } } } },
};

paths['/approvals/{id}/decide'].patch.requestBody = {
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['APPROVED', 'REJECTED'] }, reason: { type: 'string' } } },
      example: { decision: 'APPROVED', reason: 'Looks reasonable' },
    },
  },
};
paths['/approvals/{id}/decide'].patch.responses[403] = {
  description: 'Caller does not hold the role required at the chain\'s current level',
  content: { 'application/json': { example: { success: false, error: { code: 'WRONG_APPROVAL_LEVEL', message: 'This approval currently requires a decision from HR_MANAGER.' } } } },
};

paths['/knowledge/query'].post.requestBody = {
  required: true,
  content: {
    'application/json': {
      schema: { type: 'object', required: ['question'], properties: { question: { type: 'string' }, topK: { type: 'integer', default: 5 }, documentType: { type: 'string' } } },
      example: { question: 'What is the company policy on parental leave?' },
    },
  },
};

paths['/executive/dashboard'].get.parameters.push(
  { name: 'departmentId', in: 'query', schema: { type: 'string' } },
  { name: 'riskLevel', in: 'query', schema: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] } },
  { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
  { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
);

paths['/attachments'].post.requestBody = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: ['entityType', 'entityId', 'file'],
        properties: {
          entityType: { type: 'string', enum: ['TASK', 'INTERVENTION', 'REPORT', 'COMMENT'] },
          entityId: { type: 'string' },
          file: { type: 'string', format: 'binary' },
        },
      },
    },
  },
};
paths['/attachments'].post.responses[400] = {
  description: 'Disallowed MIME type or extension',
  content: { 'application/json': { example: { success: false, error: { code: 'INVALID_FILE_TYPE', message: 'Only PDF, DOCX, CSV, and image files are allowed.' } } } },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'RetentionAI API',
    version: '1.0.0',
    description:
      'REST API for the RetentionAI enterprise employee-retention platform: HR records, ' +
      'ML attrition prediction, SHAP explainability, employee intelligence (NLP), a RAG ' +
      'knowledge base, AI decision recommendations, the Executive dashboard, and the ' +
      'HR workflow-automation suite (interventions, tasks, approvals, notifications). ' +
      'All responses use the envelope `{ success, data|error, meta }`.',
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:5000/api/v1', description: 'Local development' },
    { url: 'https://api.retentionai.example.com/api/v1', description: 'Production (replace with your deployed host)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access token from POST /auth/login, sent as `Authorization: Bearer <token>`.' },
    },
    schemas: ENVELOPE,
  },
  paths,
};

export default openApiSpec;
