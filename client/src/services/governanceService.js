import api from './api';

export const governanceService = {
  async getSummary() {
    const res = await api.get('/governance/summary');
    return res.data;
  },

  async getGuardrailLogs() {
    const res = await api.get('/governance/guardrails');
    return res.data;
  },

  async calculateBiasAudit(demographicCategory = 'DEPARTMENT') {
    const res = await api.post('/governance/bias-audit', { demographicCategory });
    return res.data;
  },

  async getBiasHistory() {
    const res = await api.get('/governance/bias-history');
    return res.data;
  },

  async updatePolicy(policyData) {
    const res = await api.put('/governance/policies', policyData);
    return res.data;
  },

  async getHitlQueue() {
    const res = await api.get('/governance/hitl-queue');
    return res.data;
  },

  async submitHitlReview(decisionId, action, reviewNote) {
    const res = await api.post(`/governance/hitl-review/${decisionId}`, { action, reviewNote });
    return res.data;
  },

  async runRedTeamEval() {
    const res = await api.post('/governance/redteam/run');
    return res.data;
  },

  async exportGovernanceEvidence(format = 'json') {
    if (format === 'csv') {
      const res = await api.get('/governance/export/evidence?format=csv', { responseType: 'blob' });
      return res;
    }
    const res = await api.get('/governance/export/evidence');
    return res.data;
  },
};
