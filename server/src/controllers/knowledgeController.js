import { knowledgeService } from '../services/knowledgeService.js';
import { AppError } from '../errors/AppError.js';
import { sendSuccess } from '../utils/response.js';
import { recordAudit } from '../services/auditService.js';

// Mirrors hrController.js's extractOrgId — req.auth (set by authenticate.js)
// does not carry organizationId in this single-tenant MVP.
function extractOrgId(req) {
  return req.headers['x-organization-id'] || '60d5ec388832a828f8000000';
}

function parseTags(rawTags) {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.map((t) => String(t).trim()).filter(Boolean);
  return String(rawTags).split(',').map((t) => t.trim()).filter(Boolean);
}

export async function uploadDocument(request, response, next) {
  try {
    if (!request.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'A document file is required.');
    }
    const doc = await knowledgeService.uploadDocument({
      documentId: request.knowledgeDocumentId,
      file: request.file,
      documentType: request.body.documentType,
      tags: parseTags(request.body.tags),
      uploadedByUserId: request.auth.userId,
      organizationId: extractOrgId(request),
    });
    return sendSuccess(response, 201, doc, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function reindexDocument(request, response, next) {
  try {
    const doc = await knowledgeService.reindexDocument(request.params.id);
    return sendSuccess(response, 200, doc, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function reindexAll(request, response, next) {
  try {
    const result = await knowledgeService.reindexAll(extractOrgId(request));
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function deleteDocument(request, response, next) {
  try {
    const result = await knowledgeService.deleteDocument(request.params.id);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function listDocuments(request, response, next) {
  try {
    const { page = 1, limit = 20, documentType, tags, search } = request.query;
    const result = await knowledgeService.listDocuments({
      organizationId: extractOrgId(request),
      documentType,
      tags,
      search,
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function getDocument(request, response, next) {
  try {
    const doc = await knowledgeService.getDocument(request.params.id);
    return sendSuccess(response, 200, doc, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function queryKnowledge(request, response, next) {
  try {
    const { question, topK, documentType, filterDocument } = request.body || {};
    if (!question || !String(question).trim()) {
      throw new AppError(422, 'VALIDATION_ERROR', 'A question is required.');
    }
    const result = await knowledgeService.query({
      question,
      userId: request.auth.userId,
      topK,
      documentType,
      filterDocument,
    });
    await recordAudit(extractOrgId(request), 'KNOWLEDGE_REFERENCED', request.auth.userId, {
      entityType: 'KNOWLEDGE_DOCUMENT',
      context: { question, documentType },
    });
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function searchKnowledge(request, response, next) {
  try {
    const { q, mode = 'semantic', topK = 10, documentType } = request.query;
    if (!q || !String(q).trim()) {
      throw new AppError(422, 'VALIDATION_ERROR', 'A search query (q) is required.');
    }
    const result = await knowledgeService.search({ q, mode, topK, documentType });
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function getStatistics(request, response, next) {
  try {
    const result = await knowledgeService.getStatistics(extractOrgId(request));
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}

export async function getEmployeeKnowledgeInsights(request, response, next) {
  try {
    const result = await knowledgeService.getEmployeeKnowledgeInsights(request.params.employeeId);
    return sendSuccess(response, 200, result, request.requestId);
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError(error.statusCode || 502, error.code || 'KNOWLEDGE_SERVICE_ERROR', error.message));
  }
}
