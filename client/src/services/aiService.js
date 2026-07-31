import api from './api';

export const aiService = {
  async trainModel() {
    // Express wraps every AI-service response as { success, data, meta } —
    // the FastAPI ack (`{ success, message }`) lives at response.data.data,
    // not response.data. Returning response.data made every caller's
    // `res.message` read undefined and silently fall back to a hardcoded
    // string, no matter what the backend actually said.
    const response = await api.post('/ai/train');
    return response.data.data;
  },

  /** Fetch the existing stored prediction for an employee (read-only, does not trigger inference). */
  async getPrediction(id) {
    const response = await api.get(`/ai/predict/${id}`);
    return response.data.data;
  },

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

  // ── Explainability (SHAP) ──────────────────────────────────────────────────

  /** Fetch cached SHAP explanation for an employee (GET). */
  async getExplanation(employeeId) {
    const response = await api.get(`/explain/${employeeId}`);
    return response.data.data;
  },

  /** Generate or refresh a SHAP explanation for a single employee (POST). */
  async explainSingle(employeeId, forceRefresh = false) {
    const response = await api.post(
      `/explain/${employeeId}${forceRefresh ? '?refresh=true' : ''}`
    );
    return response.data.data;
  },

  /** Generate SHAP explanations for the whole workforce (or a subset). */
  async explainBatch(employeeIds = null) {
    const payload = employeeIds ? { employeeIds } : {};
    // Bounded slightly above Express's own AI_BATCH_TIMEOUT_MS (180s) for this
    // route — without this, the axios instance's default (no timeout) meant
    // the promise would only ever settle once Express responded, with no
    // client-side guarantee at all. This is a pure safety net: Express should
    // always respond well before this fires.
    const response = await api.post('/explain/batch', payload, { timeout: 210000 });
    return response.data.data;
  },

  /** Fetch global feature importance from the AI service. */
  async getGlobalFeatureImportance() {
    const response = await api.get('/explain/global/feature-importance');
    return response.data.data;
  },

  /** Fetch the top attrition-risk driver per department (from stored explanations). */
  async getDepartmentRiskDrivers() {
    const response = await api.get('/explain/global/department-drivers');
    return response.data.data;
  },

  // ── Employee Intelligence (NLP) ────────────────────────────────────────────

  /** Fetch cached Employee Intelligence profile for an employee (GET). */
  async getEmployeeIntelligence(employeeId) {
    const response = await api.get(`/employee-intelligence/${employeeId}`);
    return response.data.data;
  },

  /** Generate Employee Intelligence profiles for many employees at once (or the whole workforce). */
  async generateEmployeeIntelligenceBatch(employeeIds = null) {
    const payload = employeeIds ? { employeeIds } : {};
    // Bounded slightly above Express's own AI_BATCH_TIMEOUT_MS (240s) for this
    // route, same reasoning as explainBatch above.
    const response = await api.post('/employee-intelligence/batch', payload, { timeout: 270000 });
    return response.data.data;
  },

  /** Generate or refresh the Employee Intelligence profile for an employee (POST). */
  async generateEmployeeIntelligence(employeeId, forceRefresh = false) {
    const response = await api.post(
      `/employee-intelligence/${employeeId}${forceRefresh ? '?refresh=true' : ''}`
    );
    return response.data.data;
  },

  /** Fetch workforce-wide Employee Intelligence dashboard aggregation. */
  async getEmployeeIntelligenceDashboard() {
    const response = await api.get('/employee-intelligence/dashboard/summary');
    return response.data.data;
  },

  /** Fetch the merged Prediction + Explanation + Employee Intelligence view for one employee. */
  async getEmployeeAiInsights(employeeId) {
    const response = await api.get(`/employees/${employeeId}/ai-insights`);
    return response.data.data;
  },
};

export default aiService;

