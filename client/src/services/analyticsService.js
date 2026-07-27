import api from './api';

export const analyticsService = {
  async getDashboardSummary(params = {}) {
    const response = await api.get('/analytics/dashboard-summary', { params });
    return response.data.data;
  },

  async getKpis(params = {}) {
    const response = await api.get('/analytics/kpis', { params });
    return response.data.data;
  },

  async getDepartmentStats(params = {}) {
    const response = await api.get('/analytics/departments', { params });
    return response.data.data;
  },

  async getMonthlyTrends(params = {}) {
    const response = await api.get('/analytics/monthly-trends', { params });
    return response.data.data;
  },

  async getDemographics(params = {}) {
    const response = await api.get('/analytics/demographics', { params });
    return response.data.data;
  },

  async getEmployeeInsights(params = {}) {
    const response = await api.get('/analytics/employees', { params });
    return response.data.data;
  },
};

export default analyticsService;
