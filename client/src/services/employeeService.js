import api from './api';

export const employeeService = {
  async listEmployees(params = {}) {
    const response = await api.get('/employees', { params });
    return response.data.data;
  },

  async getEmployeeProfile(id) {
    const response = await api.get(`/employees/${id}`);
    return response.data.data;
  },

  async getEmployee360(id) {
    const response = await api.get(`/employees/${id}/360`);
    return response.data.data;
  },

  async getEmployeeExplanation(id) {
    const response = await api.get(`/employees/${id}/explain`);
    return response.data.data;
  },

  async createEmployee(data) {
    const response = await api.post('/employees', data);
    return response.data.data;
  },

  async updateEmployee(id, data) {
    const response = await api.patch(`/employees/${id}`, data);
    return response.data.data;
  },

  async softDeleteEmployee(id) {
    const response = await api.delete(`/employees/${id}`);
    return response.data.data;
  },

  async restoreEmployee(id) {
    const response = await api.post(`/employees/${id}/restore`);
    return response.data.data;
  },

  async bulkImport(payload) {
    const response = await api.post('/employees/bulk-import', payload);
    return response.data.data;
  },
};

export default employeeService;
