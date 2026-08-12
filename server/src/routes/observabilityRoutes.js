import express from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  getTelemetryStats,
  getDriftMetrics,
  calculateDrift,
  getAgentTrace,
  runEvalBench,
  exportTelemetryCsv,
} from '../controllers/observabilityController.js';

const router = express.Router();

// Require JWT authentication for all observability routes
router.use(authenticate);

// Telemetry overview metrics (ADMIN, EXECUTIVE, HR_DIRECTOR, CHRO, CEO)
router.get('/telemetry', authorize('ADMIN', 'EXECUTIVE', 'HR_DIRECTOR', 'CHRO', 'CEO'), getTelemetryStats);

// Model drift metrics (ADMIN, EXECUTIVE, HR_DIRECTOR, CHRO, CEO)
router.get('/drift', authorize('ADMIN', 'EXECUTIVE', 'HR_DIRECTOR', 'CHRO', 'CEO'), getDriftMetrics);

// Trigger model drift calculation (ADMIN)
router.post('/drift/calculate', authorize('ADMIN'), calculateDrift);

// Inspect LangGraph agent execution trace (ADMIN, EXECUTIVE, HR_DIRECTOR, CHRO, CEO, HR_MANAGER)
router.get('/agent-traces/:decisionId', authorize('ADMIN', 'EXECUTIVE', 'HR_DIRECTOR', 'CHRO', 'CEO', 'HR_MANAGER'), getAgentTrace);

// Trigger continuous evaluation bench run (ADMIN)
router.post('/eval/run', authorize('ADMIN'), runEvalBench);

// Export telemetry dataset CSV (ADMIN, EXECUTIVE, HR_DIRECTOR, CHRO, CEO)
router.get('/export/csv', authorize('ADMIN', 'EXECUTIVE', 'HR_DIRECTOR', 'CHRO', 'CEO'), exportTelemetryCsv);

export default router;
