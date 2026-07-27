import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  predictSingle,
  predictBatch,
  getModelInfo,
  getModelMetrics,
  getDashboardAnalytics
} from '../controllers/aiController.js';

const router = express.Router();

router.use(authenticate);

// HR Manager & Admin only
router.use(authorize('HR_MANAGER', 'ADMIN'));

router.post('/predict/batch', predictBatch);
router.post('/predict/:id', predictSingle);
router.get('/model/info', getModelInfo);
router.get('/model/metrics', getModelMetrics);
router.get('/dashboard', getDashboardAnalytics);

export { router as aiRouter };
