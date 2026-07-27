import api from './api';

export const authService = {
  async login(credentials) {
    const response = await api.post('/auth/login', credentials);
    return response.data.data;
  },

  async logout(refreshToken) {
    const response = await api.post('/auth/logout', { refreshToken });
    return response.data;
  },

  async refresh(refreshToken) {
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data.data;
  },

  async forgotPassword(email) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  async resetPassword({ token, newPassword }) {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },

  async changePassword({ currentPassword, newPassword }) {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },
};

export default authService;
