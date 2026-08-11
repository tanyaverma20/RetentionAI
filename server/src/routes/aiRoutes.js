import express from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  trainModel,
  predictSingle,
  predictBatch,
  getPrediction,
  getModelInfo,
  getModelMetrics,
  getDashboardAnalytics,
  executeAgentDecision,
} from '../controllers/aiController.js';

const router = express.Router();

router.use(authenticate);

// HR Manager & Admin only
router.use(authorize('HR_MANAGER', 'ADMIN'));

router.post('/train', trainModel);
router.post('/predict/batch', predictBatch);
router.get('/predict/:id', getPrediction);
router.post('/predict/:id', predictSingle);
router.get('/model/info', getModelInfo);
router.get('/model/metrics', getModelMetrics);
router.get('/dashboard', getDashboardAnalytics);
router.post('/employee-decision', executeAgentDecision);

export { router as aiRouter };
