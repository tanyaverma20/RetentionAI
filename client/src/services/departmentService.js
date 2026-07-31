import api from './api';

export const departmentService = {
  async listDepartments(params = {}) {
    const response = await api.get('/departments', { params });
    return response.data.data;
  },

  async getDepartment(id) {
    const response = await api.get(`/departments/${id}`);
    return response.data.data;
  },

  async createDepartment(data) {
    const response = await api.post('/departments', data);
    return response.data.data;
  },

  async updateDepartment(id, data) {
    const response = await api.patch(`/departments/${id}`, data);
    return response.data.data;
  },

  async deleteDepartment(id) {
    const response = await api.delete(`/departments/${id}`);
    return response.data.data;
  },

  async deleteAllDepartments() {
    const response = await api.delete('/departments');
    return response.data.data;
  },

  async bulkUploadDepartments(formData) {
    const response = await api.post('/departments/bulk', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async assignManager(departmentId, managerId) {
    const response = await api.post(`/departments/${departmentId}/manager`, { managerId });
    return response.data.data;
  },
};

export default departmentService;
