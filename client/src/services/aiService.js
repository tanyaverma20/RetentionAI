import api from './api';

export const aiService = {
  async predictSingle(id) {
    const response = await api.post(`/ai/predict/${id}`);
    return response.data.data;
  },

  async predictBatch(payload = {}) {
    const response = await api.post('/ai/predict/batch', payload);
    return response.data.data;
  },

  async getModelInfo() {
    const response = await api.get('/ai/model/info');
    return response.data.data;
  },

  async getModelMetrics() {
    const response = await api.get('/ai/model/metrics');
    return response.data.data;
  },

  async getDashboardAnalytics() {
    const response = await api.get('/ai/dashboard');
    return response.data.data;
  },
};

export default aiService;
