import api from './api';

export const organizationService = {
  async signup(payload) {
    const response = await api.post('/organizations/signup', payload);
    return response.data.data;
  },

  async getCurrentOrganization() {
    const response = await api.get('/organizations/me');
    return response.data.data;
  },
};

export default organizationService;
