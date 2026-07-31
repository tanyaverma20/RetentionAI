import { api } from './api';

export const interventionService = {
  async list(filter = {}) {
    const response = await api.get('/interventions', { params: filter });
    return response.data.data.interventions;
  },
  async get(id) {
    const response = await api.get(`/interventions/${id}`);
    return response.data.data;
  },
  async create(payload) {
    const response = await api.post('/interventions', payload);
    return response.data.data;
  },
  async createFromDecision(payload) {
    const response = await api.post('/interventions/from-decision', payload);
    return response.data.data;
  },
  async transition(id, status, extra = {}) {
    const response = await api.patch(`/interventions/${id}/status`, { status, ...extra });
    return response.data.data;
  },
  async listOverdue() {
    const response = await api.get('/interventions/overdue');
    return response.data.data.interventions;
  },
};

export const taskService = {
  async list(filter = {}) {
    const response = await api.get('/tasks', { params: filter });
    return response.data.data.tasks;
  },
  async get(id) {
    const response = await api.get(`/tasks/${id}`);
    return response.data.data;
  },
  async create(payload) {
    const response = await api.post('/tasks', payload);
    return response.data.data;
  },
  async assign(id, ownerUserId, note) {
    const response = await api.patch(`/tasks/${id}/assign`, { ownerUserId, note });
    return response.data.data;
  },
  async complete(id, note) {
    const response = await api.patch(`/tasks/${id}/complete`, { note });
    return response.data.data;
  },
  async cancel(id, note) {
    const response = await api.patch(`/tasks/${id}/cancel`, { note });
    return response.data.data;
  },
  async escalate(id, escalateToUserId, note) {
    const response = await api.patch(`/tasks/${id}/escalate`, { escalateToUserId, note });
    return response.data.data;
  },
};

export const approvalService = {
  async getForEntity(entityType, entityId) {
    const response = await api.get('/approvals', { params: { entityType, entityId } });
    return response.data.data;
  },
  async decide(id, decision, reason) {
    const response = await api.patch(`/approvals/${id}/decide`, { decision, reason });
    return response.data.data;
  },
};

export const notificationService = {
  async list(filter = {}) {
    const response = await api.get('/notifications', { params: filter });
    return response.data.data;
  },
  async markRead(id) {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data.data;
  },
  async markAllRead() {
    const response = await api.patch('/notifications/read-all');
    return response.data.data;
  },
  async archive(id) {
    const response = await api.patch(`/notifications/${id}/archive`);
    return response.data.data;
  },
  async dismiss(id) {
    const response = await api.patch(`/notifications/${id}/dismiss`);
    return response.data.data;
  },
  async getPreferences() {
    const response = await api.get('/notifications/preferences');
    return response.data.data;
  },
  async updatePreferences(channels) {
    const response = await api.patch('/notifications/preferences', { channels });
    return response.data.data;
  },
};

export const commentService = {
  async list(entityType, entityId) {
    const response = await api.get('/comments', { params: { entityType, entityId } });
    return response.data.data.comments;
  },
  async create(payload) {
    const response = await api.post('/comments', payload);
    return response.data.data;
  },
  async remove(id) {
    const response = await api.delete(`/comments/${id}`);
    return response.data.data;
  },
};

export const workflowDashboardService = {
  async getDashboard() {
    const response = await api.get('/workflow/dashboard');
    return response.data.data;
  },
};

export const enterpriseSearchService = {
  async search(q, limit = 10) {
    const response = await api.get('/search', { params: { q, limit } });
    return response.data.data;
  },
};

export const auditService = {
  async list(filter = {}) {
    const response = await api.get('/audit', { params: filter });
    return response.data.data.entries;
  },
  async timeline(filter = {}) {
    const response = await api.get('/audit/timeline', { params: filter });
    return response.data.data.activity;
  },
  async downloadCsv(filter = {}) {
    const response = await api.get('/audit/export', { params: filter, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'audit-log.csv');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const attachmentService = {
  async list(entityType, entityId) {
    const response = await api.get('/attachments', { params: { entityType, entityId } });
    return response.data.data.attachments;
  },
  async upload(entityType, entityId, file) {
    const formData = new FormData();
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    formData.append('file', file);
    const response = await api.post('/attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data.data;
  },
  async download(id, filename) {
    const response = await api.get(`/attachments/${id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || 'attachment');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const automationService = {
  async listJobs() {
    const response = await api.get('/automation/jobs');
    return response.data.data;
  },
  async runJob(jobName) {
    const response = await api.post(`/automation/jobs/${jobName}/run`);
    return response.data.data;
  },
};
