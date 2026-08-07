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
    // Overrides api.js's 60s default: Express holds this connection open
    // while it polls the ai-service's background decision job (up to
    // DECISION_JOB_MAX_WAIT_MS = 12 min in decisionService.js), so the
    // client budget must sit just above that. Recommendations are the
    // slowest path in the app — each employee needs a Groq LLM call, and
    // Groq's own account rate ceiling (~4 req/sec, measured) sets the floor
    // on total wall time regardless of local concurrency.
    const response = await api.post('/decisions/batch', { employeeIds, departmentId }, { timeout: 13 * 60 * 1000 });
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
