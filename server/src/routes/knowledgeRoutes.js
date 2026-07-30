import express from 'express';
import { ROLE_NAMES } from '../config/roles.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import {
  assignKnowledgeDocumentId,
  handleKnowledgeDocumentUpload,
} from '../middlewares/uploadMiddleware.js';
import * as knowledgeController from '../controllers/knowledgeController.js';

export const knowledgeRouter = express.Router();

// All routes require authentication
knowledgeRouter.use(authenticate);

// ── Read access — any authenticated user (Employee Profile, Dashboard, search) ──
knowledgeRouter.get('/documents', knowledgeController.listDocuments);
knowledgeRouter.get('/documents/:id', knowledgeController.getDocument);
knowledgeRouter.post('/query', knowledgeController.queryKnowledge);
knowledgeRouter.get('/search', knowledgeController.searchKnowledge);
knowledgeRouter.get('/statistics', knowledgeController.getStatistics);
knowledgeRouter.get('/employees/:employeeId/insights', knowledgeController.getEmployeeKnowledgeInsights);

// ── Write access — HR Manager & Admin only (document management) ──
knowledgeRouter.use(authorize(ROLE_NAMES.ADMIN, ROLE_NAMES.HR_MANAGER));

knowledgeRouter.post(
  '/documents',
  assignKnowledgeDocumentId,
  handleKnowledgeDocumentUpload,
  knowledgeController.uploadDocument,
);
knowledgeRouter.post('/documents/:id/reindex', knowledgeController.reindexDocument);
knowledgeRouter.post('/reindex-all', knowledgeController.reindexAll);
knowledgeRouter.delete('/documents/:id', knowledgeController.deleteDocument);
