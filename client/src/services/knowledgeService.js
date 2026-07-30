import { api } from './api';

export const knowledgeService = {
  async uploadDocument({ file, documentType, tags }) {
    const formData = new FormData();
    formData.append('document', file);
    if (documentType) formData.append('documentType', documentType);
    if (tags?.length) formData.append('tags', tags.join(','));
    const response = await api.post('/knowledge/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  async reindexDocument(documentId) {
    const response = await api.post(`/knowledge/documents/${documentId}/reindex`);
    return response.data.data;
  },

  async reindexAll() {
    const response = await api.post('/knowledge/reindex-all');
    return response.data.data;
  },

  async deleteDocument(documentId) {
    const response = await api.delete(`/knowledge/documents/${documentId}`);
    return response.data.data;
  },

  async listDocuments(params = {}) {
    const response = await api.get('/knowledge/documents', { params });
    return response.data.data;
  },

  async getDocument(documentId) {
    const response = await api.get(`/knowledge/documents/${documentId}`);
    return response.data.data;
  },

  async query({ question, topK, documentType, filterDocument }) {
    const response = await api.post('/knowledge/query', { question, topK, documentType, filterDocument });
    return response.data.data;
  },

  async search({ q, mode = 'semantic', topK = 10, documentType }) {
    const response = await api.get('/knowledge/search', { params: { q, mode, topK, documentType } });
    return response.data.data;
  },

  async getStatistics() {
    const response = await api.get('/knowledge/statistics');
    return response.data.data;
  },

  async getEmployeeKnowledgeInsights(employeeId) {
    const response = await api.get(`/knowledge/employees/${employeeId}/insights`);
    return response.data.data;
  },
};

export default knowledgeService;
