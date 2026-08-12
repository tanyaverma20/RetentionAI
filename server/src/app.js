import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';
import { openApiSpec } from './docs/openapi.js';
import { env } from './config/env.js';
import { createOriginMatcher } from './config/corsOrigins.js';
import { AppError } from './errors/AppError.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { requestId } from './middlewares/requestId.js';
import { metricsMiddleware } from './middlewares/metrics.js';
import { requestLoggingMiddleware } from './middlewares/requestLogging.js';
import { sanitizeInput } from './middlewares/sanitizeInput.js';
import { analyticsRouter } from './routes/analyticsRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { organizationRouter } from './routes/organizationRoutes.js';
import { departmentRouter } from './routes/departmentRoutes.js';
import { employeeRouter } from './routes/employeeRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import hrRouter from './routes/hrRoutes.js';
import { reportingRouter } from './routes/reportingRoutes.js';
import { searchRouter } from './routes/searchRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { explainRouter } from './routes/explainRoutes.js';
import { employeeIntelligenceRouter } from './routes/employeeIntelligenceRoutes.js';
import { knowledgeRouter } from './routes/knowledgeRoutes.js';
import { decisionRouter } from './routes/decisionRoutes.js';
import { executiveRouter } from './routes/executiveRoutes.js';
import { interventionRouter } from './routes/interventionRoutes.js';
import { taskRouter } from './routes/taskRoutes.js';
import { approvalRouter } from './routes/approvalRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { commentRouter } from './routes/commentRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { workflowRouter } from './routes/workflowRoutes.js';
import { attachmentRouter } from './routes/attachmentRoutes.js';
import { automationRouter } from './routes/automationRoutes.js';
import observabilityRouter from './routes/observabilityRoutes.js';

export const app = express();

app.use(requestId);
app.use(metricsMiddleware);
app.use(requestLoggingMiddleware);
const strictHelmet = helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } });
// Swagger UI injects inline <style>/<script> tags at render time, which the
// default CSP's style-src/script-src 'self' blocks — the page still returns
// 200 but renders blank in a real browser. Scoped to /api-docs only; every
// other route keeps the strict default policy.
const relaxedHelmetForDocs = helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });
app.use((request, response, next) => {
  const middleware = request.path.startsWith('/api-docs') ? relaxedHelmetForDocs : strictHelmet;
  return middleware(request, response, next);
});
const isAllowedOrigin = createOriginMatcher(env.corsOrigins);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) return callback(null, true);
      // A plain Error here would fall through to the generic 500 handler,
      // which reports a misconfigured allowlist as "an unexpected error
      // occurred" — indistinguishable from a real server fault, and the
      // browser hides the body from the page anyway. An AppError gives the
      // operator a 403 with a searchable code the moment they curl it.
      return callback(
        new AppError(403, 'CORS_ORIGIN_NOT_ALLOWED', 'Origin is not allowed by CORS.'),
      );
    },
    // PUT is required for /api/v1/hr/:collection/:id updates — omitting it
    // silently breaks that endpoint for cross-origin browser clients only
    // (the CORS preflight rejects PUT before the request body is even
    // sent), which is why it wasn't caught by same-origin/curl testing.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  }),
);
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeInput);

// Static file serving for uploads (profile pictures, etc.)
// Must match UPLOADS_ROOT in middlewares/uploadMiddleware.js — <server-root>/uploads.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.get('/api-docs.json', (_req, res) => res.json(openApiSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'RetentionAI API Docs' }));

app.use(healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/organizations', organizationRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/departments', departmentRouter);
app.use('/api/v1/employees', employeeRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/dashboard', analyticsRouter);
app.use('/api/v1/hr', hrRouter);
app.use('/api/v1/reports', reportingRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/explain', explainRouter);
app.use('/api/v1/employee-intelligence', employeeIntelligenceRouter);
app.use('/api/v1/knowledge', knowledgeRouter);
app.use('/api/v1/decisions', decisionRouter);
app.use('/api/v1/executive', executiveRouter);
app.use('/api/v1/interventions', interventionRouter);
app.use('/api/v1/tasks', taskRouter);
app.use('/api/v1/approvals', approvalRouter);
app.use('/api/v1/notifications', notificationRouter);
app.use('/api/v1/comments', commentRouter);
app.use('/api/v1/audit', auditRouter);
app.use('/api/v1/workflow', workflowRouter);
app.use('/api/v1/attachments', attachmentRouter);
app.use('/api/v1/automation', automationRouter);
app.use('/api/v1/observability', observabilityRouter);
app.use(notFoundHandler);
app.use(errorHandler);
