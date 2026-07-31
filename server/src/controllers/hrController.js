import { hrService } from '../services/hrService.js';
import { hrQuerySchema } from '../validators/hrValidators.js';
import { AppError } from '../errors/AppError.js';

function extractOrgId(req) {
  // In a real multi-tenant app, this might come from the user's JWT or a domain context.
  // Assuming a single tenant or hardcoded for now based on existing implementation patterns.
  // Using a mock organizationId or the one from the admin. Let's look up a default one or assume it's passed or derived.
  // Actually, we can fetch it from the Employee record later, or pass a dummy one for now if not strictly multi-tenant in seeds.
  // RetentionAI seed scripts usually use a single org.
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

export async function createRecord(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    const result = await hrService.createRecord(req.params.collection, orgId, req.auth, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function getRecord(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    const result = await hrService.getRecord(req.params.collection, orgId, req.auth, req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateRecord(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    const result = await hrService.updateRecord(req.params.collection, orgId, req.auth, req.params.id, req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function deleteRecord(req, res, next) {
  try {
    const orgId = extractOrgId(req);
    await hrService.deleteRecord(req.params.collection, orgId, req.auth, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listRecords(req, res, next) {
  try {
    const orgId = extractOrgId(req);
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
    const orgId = extractOrgId(req);
    const { csvText } = req.body;
    if (!csvText) throw new AppError(400, 'BAD_REQUEST', 'csvText is required for bulk import');

    const lines = csvText.split('\n').filter(l => l.trim() !== '');
    if (lines.length < 2) throw new AppError(400, 'BAD_REQUEST', 'CSV must have at least a header and one data row');

    const headers = lines[0].split(',').map(h => h.trim());
    const records = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const record = {};
      headers.forEach((h, idx) => {
        let val = values[idx];
        if (val === 'true') val = true;
        if (val === 'false') val = false;
        if (val !== undefined && val !== '') {
           record[h] = val;
        }
      });
      records.push(record);
    }

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
