/**
 * @file importRoutes.js
 * @description Express router for employee data import governance.
 */

import { Router } from 'express';
import multer from 'multer';
import * as importAdminController from '../controllers/importAdminController.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

export const importRouter = Router();

importRouter.post('/preview', authenticate, authorize('ADMIN', 'HR_MANAGER'), upload.single('file'), importAdminController.previewImport);
importRouter.post('/:importId/commit', authenticate, authorize('ADMIN', 'HR_MANAGER'), importAdminController.commitImport);
importRouter.get('/history', authenticate, authorize('ADMIN', 'HR_MANAGER'), importAdminController.getImportHistory);
importRouter.get('/:importId/errors/export', authenticate, authorize('ADMIN', 'HR_MANAGER'), importAdminController.exportErrorsCSV);
