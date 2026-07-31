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
    // Root cause of the "Generating..." button that never resolved: this
    // axios instance has no default timeout (see api.js), and generating
    // recommendations for the full active workforce genuinely takes several
    // minutes (verified directly against the API: ~4.5 minutes for ~1250
    // employees, well under Express's own 420s AI_BATCH_TIMEOUT_MS below).
    // With no client-side bound at all, ANY network hiccup that doesn't
    // cleanly close the connection would leave the promise — and therefore
    // the button's loading state — with no guaranteed way to ever settle.
    // This timeout is set just above Express's own budget so it only ever
    // fires as a safety net, never preempting a real response.
    const response = await api.post('/decisions/batch', { employeeIds, departmentId }, { timeout: 450000 });
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
