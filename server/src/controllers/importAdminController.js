/**
 * @file importAdminController.js
 * @description Controllers for employee import preview, commit, history, and error export.
 */

import * as importGovernanceService from '../services/importGovernanceService.js';

export async function previewImport(req, res, next) {
  try {
    const buffer = req.file ? req.file.buffer : req.body.buffer ? Buffer.from(req.body.buffer, 'utf-8') : null;
    const filename = req.file ? req.file.originalname : req.body.filename || 'import.csv';
    const uploadId = req.body.uploadId;

    const result = await importGovernanceService.parseAndValidateImport({
      organizationId: req.auth.organizationId,
      userId: req.auth.userId,
      buffer,
      filename,
      uploadId,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function commitImport(req, res, next) {
  try {
    const result = await importGovernanceService.commitImport({
      organizationId: req.auth.organizationId,
      importId: req.params.importId,
      userId: req.auth.userId,
    });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getImportHistory(req, res, next) {
  try {
    const data = await importGovernanceService.getImportHistory(req.auth.organizationId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function exportErrorsCSV(req, res, next) {
  try {
    const csvContent = await importGovernanceService.exportImportErrorsCSV({
      organizationId: req.auth.organizationId,
      importId: req.params.importId,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="import_errors_${req.params.importId}.csv"`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}
