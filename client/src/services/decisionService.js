import { api } from './api';

export const decisionService = {
  async generateForEmployee(employeeId, forceRefresh = false) {
    const response = await api.post(`/decisions/${employeeId}/generate${forceRefresh ? '?refresh=true' : ''}`);
    return response.data.data;
  },

  async getDecision(employeeId) {
    const response = await api.get(`/decisions/${employeeId}`);
    return response.data.data;
  },

  async getHistory(employeeId) {
    const response = await api.get(`/decisions/${employeeId}/history`);
    return response.data.data;
  },

  async generateBatch({ employeeIds, departmentId } = {}) {
    const response = await api.post('/decisions/batch', { employeeIds, departmentId });
    return response.data.data;
  },

  async updateStatus(decisionId, status, note = '') {
    const response = await api.patch(`/decisions/status/${decisionId}`, { status, note });
    return response.data.data;
  },

  async getDashboardSummary() {
    const response = await api.get('/decisions/dashboard/summary');
    return response.data.data;
  },

  async getManagerDashboard(departmentId) {
    const response = await api.get('/decisions/dashboard/manager', { params: { departmentId } });
    return response.data.data;
  },
};

export default decisionService;
