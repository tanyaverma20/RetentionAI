import express from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import * as governanceController from '../controllers/governanceController.js';

const router = express.Router();

router.use(authenticate);

// Restricted to authorized governance roles only
const ALLOWED_GOVERNANCE_ROLES = ['ADMIN', 'EXECUTIVE', 'HR_DIRECTOR', 'CHRO', 'CEO', 'COMPLIANCE_OFFICER'];

router.get('/summary', authorize(...ALLOWED_GOVERNANCE_ROLES), governanceController.getGovernanceSummary);
router.get('/guardrails', authorize(...ALLOWED_GOVERNANCE_ROLES), governanceController.getGuardrailLogs);
router.post('/bias-audit', authorize(...ALLOWED_GOVERNANCE_ROLES), governanceController.calculateBiasAudit);
router.get('/bias-history', authorize(...ALLOWED_GOVERNANCE_ROLES), governanceController.getBiasHistory);
router.put('/policies', authorize('ADMIN', 'CHRO', 'COMPLIANCE_OFFICER'), governanceController.updatePolicy);
router.get('/hitl-queue', authorize(...ALLOWED_GOVERNANCE_ROLES), governanceController.getHitlQueue);
router.post('/hitl-review/:decisionId', authorize('ADMIN', 'CHRO', 'COMPLIANCE_OFFICER'), governanceController.submitHitlReview);
router.post('/redteam/run', authorize('ADMIN', 'COMPLIANCE_OFFICER'), governanceController.runRedTeamEval);
router.get('/export/evidence', authorize(...ALLOWED_GOVERNANCE_ROLES), governanceController.exportGovernanceEvidence);

export default router;
