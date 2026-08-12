import { api } from './api';

export const executiveService = {
  async getDashboard(filter = {}) {
    const response = await api.get('/executive/dashboard', { params: filter });
    return response.data.data;
  },

  async getInsights(filter = {}) {
    const response = await api.get('/executive/insights', { params: filter });
    return response.data.data.insights;
  },

  async getInterventionAnalytics(filter = {}) {
    const response = await api.get('/executive/intervention-analytics', { params: filter });
    return response.data.data;
  },

  async getRoiAnalytics(filter = {}) {
    const response = await api.get('/executive/roi', { params: filter });
    return response.data.data;
  },

  async getForecast(filter = {}) {
    const response = await api.get('/executive/forecast', { params: filter });
    return response.data.data;
  },

  async downloadReport(format, filter = {}) {
    const response = await api.get(`/executive/reports/${format}`, { params: filter, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `executive-report.${format}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async listAlerts(status) {
    const response = await api.get('/executive/alerts', { params: status ? { status } : {} });
    return response.data.data.alerts;
  },

  async generateAlerts(filter = {}) {
    const response = await api.post('/executive/alerts/generate', filter);
    return response.data.data;
  },

  async dismissAlert(alertId) {
    const response = await api.patch(`/executive/alerts/${alertId}/dismiss`);
    return response.data.data;
  },

  async reviewAlert(alertId) {
    const response = await api.patch(`/executive/alerts/${alertId}/review`);
    return response.data.data;
  },

  async assignAlert(alertId, assignedToUserId) {
    const response = await api.patch(`/executive/alerts/${alertId}/assign`, { assignedToUserId });
    return response.data.data;
  },

  async transitionAlert(alertId, status, note = '') {
    const response = await api.patch(`/executive/alerts/${alertId}/transition`, { status, note });
    return response.data.data;
  },
};

export default executiveService;
