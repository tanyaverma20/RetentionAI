import { parse } from 'csv-parse/sync';
import { hrService } from '../services/hrService.js';
import { hrQuerySchema } from '../validators/hrValidators.js';
import { AppError } from '../errors/AppError.js';

export async function createRecord(req, res, next) {
  try {
    const orgId = req.auth.organizationId;
    const result = await hrService.createRecord(req.params.collection, orgId, req.auth, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getRecord(req, res, next) {
  try {
    const orgId = req.auth.organizationId;
    const result = await hrService.getRecord(req.params.collection, orgId, req.auth, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateRecord(req, res, next) {
  try {
    const orgId = req.auth.organizationId;
    const result = await hrService.updateRecord(req.params.collection, orgId, req.auth, req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteRecord(req, res, next) {
  try {
    const orgId = req.auth.organizationId;
    await hrService.deleteRecord(req.params.collection, orgId, req.auth, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listRecords(req, res, next) {
  try {
    const orgId = req.auth.organizationId;
    const { page, limit, sort, employeeId, managerId, startDate, endDate } = hrQuerySchema.parse(req.query);

    const queryParams = {};
    if (employeeId) queryParams.employeeId = employeeId;
    if (managerId) queryParams.managerId = managerId;
    
    // date filtering
    if (startDate || endDate) {
      const dateField = req.params.collection === 'attendance' ? 'attendanceDate' : 
                        req.params.collection === 'surveys' ? 'surveyDate' :
                        req.params.collection === 'feedback' ? 'feedbackDate' :
                        req.params.collection === 'notes' ? 'noteDate' : 
                        req.params.collection === 'training' ? 'completionDate' :
                        req.params.collection === 'promotions' ? 'promotionDate' : 'createdAt';
      
      queryParams[dateField] = {};
      if (startDate) queryParams[dateField].$gte = new Date(startDate);
      if (endDate) queryParams[dateField].$lte = new Date(endDate);
    }

    const result = await hrService.listRecords(req.params.collection, orgId, req.auth, queryParams, { page, limit, sort });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
}

export async function bulkImportRecords(req, res, next) {
  try {
    const orgId = req.auth.organizationId;
    const { csvText } = req.body;
    if (!csvText) throw new AppError(400, 'BAD_REQUEST', 'csvText is required for bulk import');

    // A hand-rolled `split(',')`/`split('\n')` parser here previously broke
    // on any quoted field containing a comma or embedded newline (e.g. a
    // feedback/note column) — reusing the same csv-parse/sync library
    // already relied on elsewhere (departmentService.js, seedDemoData.js)
    // handles RFC 4180 quoting correctly instead of silently misaligning columns.
    let rawRecords;
    try {
      rawRecords = parse(csvText, { columns: true, skip_empty_lines: true, trim: true });
    } catch (err) {
      throw new AppError(400, 'BAD_REQUEST', `Invalid CSV: ${err.message}`);
    }
    if (rawRecords.length === 0) throw new AppError(400, 'BAD_REQUEST', 'CSV must have at least a header and one data row');

    const records = rawRecords.map((row) => {
      const record = {};
      for (const [key, value] of Object.entries(row)) {
        if (value === '') continue;
        record[key] = value === 'true' ? true : value === 'false' ? false : value;
      }
      return record;
    });

    let importedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (let i = 0; i < records.length; i++) {
      try {
        await hrService.createRecord(req.params.collection, orgId, req.auth, records[i]);
        importedCount++;
      } catch (err) {
        failedCount++;
        errors.push({ row: i + 2, error: err.message });
      }
    }

    res.json({ success: true, data: { importedCount, failedCount, errors } });
  } catch (error) {
    next(error);
  }
}
