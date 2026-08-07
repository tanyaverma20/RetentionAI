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
    // Overrides api.js's 60s default. This is by far the slowest action in
    // the app and the budget is derived from measured production numbers,
    // not guessed: 300 employees took 197s (~0.66s each), a rate set by
    // Groq's account-level API ceiling rather than by this code. Express
    // processes the workforce in chunks of 300 (see server-side
    // decisionService.generateBatch), so the full ~1320-employee run is
    // roughly 5 chunks x ~197s = ~870s. 20 minutes leaves real headroom
    // above that without ever being the thing that fails first.
    const response = await api.post('/decisions/batch', { employeeIds, departmentId }, { timeout: 20 * 60 * 1000 });
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
