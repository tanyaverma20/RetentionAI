import axios from 'axios';
import fs from 'fs';
import { KnowledgeDocument } from '../models/KnowledgeDocument.js';
import { Employee } from '../models/Employee.js';
import { getKnowledgeDocumentAbsolutePath } from '../middlewares/uploadMiddleware.js';
import { toAiServiceError } from '../utils/aiServiceError.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

const aiClient = axios.create({
  baseURL: AI_API_URL,
  headers: {
    Authorization: `Bearer ${AI_API_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 45000, // grounded LLM queries can legitimately take longer than a typical API call
});

/**
 * Canned, templated knowledge lookups shown on the Employee Profile. These
 * are grounded policy *references* scoped to the employee's role — never a
 * generated recommendation/decision about the employee (that's explicitly
 * out of scope for this sprint; Sprint 7's AI Decision Engine is where
 * personalized recommendations belong).
 */
function buildInsightQueries(employee) {
  const designation = employee.designation || 'employee';
  return [
    { key: 'promotion', label: 'Relevant Promotion Policy', question: `What is the promotion policy for a ${designation}?`, documentType: 'PROMOTION_POLICY' },
    { key: 'performance', label: 'Applicable Performance Rules', question: `What performance guidelines apply to a ${designation}?`, documentType: 'PERFORMANCE_GUIDELINES' },
    { key: 'leave', label: 'Leave Policy References', question: 'What is the company leave policy?', documentType: 'LEAVE_POLICY' },
    { key: 'training', label: 'Training Recommendations', question: `What training or development documents are relevant for a ${designation}?`, documentType: 'TRAINING_DOCUMENT' },
  ];
}

class KnowledgeService {
  // ── Document management ────────────────────────────────────────────────

  async uploadDocument({ documentId, file, documentType, tags, uploadedByUserId, organizationId }) {
    const relativeFilePath = `documents/${file.filename}`;

    const doc = await KnowledgeDocument.create({
      _id: documentId,
      organizationId,
      filename: file.originalname,
      documentType: documentType || 'OTHER',
      uploadedBy: uploadedByUserId,
      tags: tags || [],
      filePath: relativeFilePath,
      fileSizeBytes: file.size,
      status: 'PROCESSING',
    });

    try {
      const response = await aiClient.post('/documents/upload', {
        documentId: String(documentId),
        filePath: getKnowledgeDocumentAbsolutePath(relativeFilePath),
        documentType: doc.documentType,
        tags: doc.tags,
        uploadedBy: String(uploadedByUserId),
        uploadDate: doc.uploadDate.toISOString(),
        version: doc.version,
      });

      doc.status = 'INDEXED';
      doc.chunkCount = response.data.chunksIndexed || 0;
      await doc.save();
    } catch (err) {
      doc.status = 'FAILED';
      doc.errorMessage = err.response?.data?.detail || err.message;
      await doc.save();
      throw toAiServiceError(err, 'Document indexing failed', {
        notReadyMessage: 'The knowledge service is not ready yet. Please try again shortly.',
      });
    }

    return doc;
  }

  async reindexDocument(documentId) {
    const doc = await KnowledgeDocument.findById(documentId);
    if (!doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Knowledge document not found.');
    }

    try {
      const response = await aiClient.post('/documents/reindex', {
        documentId: String(documentId),
        filePath: getKnowledgeDocumentAbsolutePath(doc.filePath),
        documentType: doc.documentType,
        tags: doc.tags,
        uploadedBy: String(doc.uploadedBy),
        uploadDate: doc.uploadDate.toISOString(),
        version: doc.version,
      });
      doc.status = 'INDEXED';
      doc.chunkCount = response.data.chunksIndexed || 0;
      doc.errorMessage = '';
      await doc.save();
    } catch (err) {
      doc.status = 'FAILED';
      doc.errorMessage = err.response?.data?.detail || err.message;
      await doc.save();
      throw toAiServiceError(err, 'Document re-indexing failed');
    }

    return doc;
  }

  async reindexAll(organizationId) {
    const docs = await KnowledgeDocument.find({ organizationId });
    let succeeded = 0;
    let failed = 0;
    for (const doc of docs) {
      try {
        await this.reindexDocument(doc._id);
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    return { totalCount: docs.length, succeeded, failed };
  }

  async deleteDocument(documentId) {
    const doc = await KnowledgeDocument.findById(documentId);
    if (!doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Knowledge document not found.');
    }

    try {
      await aiClient.delete(`/documents/${String(documentId)}`);
    } catch (err) {
      // Proceed with removing the Mongo record / file even if Chroma cleanup
      // fails — an orphaned Chroma entry is recoverable via reindex-all;
      // a document stuck forever in the admin list because the AI service
      // was briefly down is a worse outcome.
      logger.error('knowledge_vector_cleanup_failed', { documentId: String(documentId), message: err.message });
    }

    const absolutePath = getKnowledgeDocumentAbsolutePath(doc.filePath);
    fs.unlink(absolutePath, (err) => {
      if (err) logger.error('knowledge_file_delete_failed', { absolutePath, message: err.message });
    });

    await KnowledgeDocument.deleteOne({ _id: documentId });
    return { success: true };
  }

  async listDocuments({ organizationId, documentType, tags, search, page = 1, limit = 20 }) {
    const filter = { organizationId };
    if (documentType) filter.documentType = documentType;
    if (tags) filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    if (search) filter.filename = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

    const skip = (page - 1) * limit;
    const [items, totalItems] = await Promise.all([
      KnowledgeDocument.find(filter).populate('uploadedBy', 'name email').sort({ uploadDate: -1 }).skip(skip).limit(limit),
      KnowledgeDocument.countDocuments(filter),
    ]);

    return { items, totalItems, page: Number(page), limit: Number(limit), totalPages: Math.ceil(totalItems / limit) || 1 };
  }

  async getDocument(documentId) {
    const doc = await KnowledgeDocument.findById(documentId).populate('uploadedBy', 'name email');
    if (!doc) {
      throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'Knowledge document not found.');
    }

    let chunkDetail = null;
    try {
      const response = await aiClient.get(`/knowledge/document/${String(documentId)}`);
      chunkDetail = response.data;
    } catch {
      // Chunk-level preview is supplementary — the Mongo record is the
      // canonical metadata and is returned regardless.
    }

    return { ...doc.toObject(), chunkDetail };
  }

  // ── Query / search ──────────────────────────────────────────────────────

  async query({ question, userId, topK, documentType, filterDocument }) {
    try {
      const response = await aiClient.post('/knowledge/query', {
        question,
        userId,
        topK,
        documentType,
        filterDocument,
      });
      return response.data;
    } catch (err) {
      throw toAiServiceError(err, 'Knowledge query failed', {
        notReadyMessage: 'The knowledge assistant is not ready yet. Please train/index the knowledge base first.',
      });
    }
  }

  async search({ q, mode, topK, documentType }) {
    try {
      const response = await aiClient.get('/knowledge/search', {
        params: { q, mode, topK, documentType },
      });
      return response.data;
    } catch (err) {
      throw toAiServiceError(err, 'Knowledge search failed');
    }
  }

  async getStatistics(organizationId) {
    let aiStats = {
      indexedDocuments: 0,
      totalChunks: 0,
      recentQueryCount: 0,
      mostSearchedPolicies: [],
      querySuccessRate: 0,
    };
    try {
      const response = await aiClient.get('/knowledge/statistics');
      aiStats = response.data;
    } catch (err) {
      logger.error('knowledge_statistics_fetch_failed', { message: err.message });
    }

    const [documentsIndexedCount, recentUploads] = await Promise.all([
      KnowledgeDocument.countDocuments({ organizationId, status: 'INDEXED' }),
      KnowledgeDocument.find({ organizationId }).sort({ uploadDate: -1 }).limit(5).populate('uploadedBy', 'name'),
    ]);

    return {
      ...aiStats,
      documentsIndexedCount,
      recentUploads,
    };
  }

  // ── Employee Profile Knowledge Insights ─────────────────────────────────

  async getEmployeeKnowledgeInsights(employeeId) {
    const employee = await Employee.findById(employeeId).populate('departmentId', 'name');
    if (!employee) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Employee not found.');
    }

    const queries = buildInsightQueries(employee);
    const insights = await Promise.all(
      queries.map(async ({ key, label, question, documentType }) => {
        try {
          const result = await aiClient.post('/knowledge/query', {
            question,
            userId: `employee-profile:${employeeId}`,
            topK: 3,
            documentType,
          });
          return { key, label, question, ...result.data };
        } catch (err) {
          return {
            key,
            label,
            question,
            answer: 'Unable to retrieve this policy reference right now.',
            sourceDocuments: [],
            confidenceScore: 0,
            error: err.response?.data?.detail || err.message,
          };
        }
      }),
    );

    return { employeeId, designation: employee.designation, insights };
  }
}

export const knowledgeService = new KnowledgeService();
