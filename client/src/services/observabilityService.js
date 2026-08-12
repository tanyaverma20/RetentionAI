import api from './api';

export const getTelemetryStats = async (params = {}) => {
  const response = await api.get('/api/v1/observability/telemetry', { params });
  return response.data;
};

export const getDriftMetrics = async () => {
  const response = await api.get('/api/v1/observability/drift');
  return response.data;
};

export const calculateDrift = async (modelVersion = '1.0.0') => {
  const response = await api.post('/api/v1/observability/drift/calculate', { modelVersion });
  return response.data;
};

export const getAgentTrace = async (decisionId) => {
  const response = await api.get(`/api/v1/observability/agent-traces/${decisionId}`);
  return response.data;
};

export const runEvalBench = async () => {
  const response = await api.post('/api/v1/observability/eval/run');
  return response.data;
};

export const exportTelemetryCsv = async () => {
  const response = await api.get('/api/v1/observability/export/csv', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `ai-telemetry-${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export default {
  getTelemetryStats,
  getDriftMetrics,
  calculateDrift,
  getAgentTrace,
  runEvalBench,
  exportTelemetryCsv,
};
