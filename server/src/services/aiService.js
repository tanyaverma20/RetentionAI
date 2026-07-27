import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { findEmployeeById } from '../repositories/employeeRepository.js';

/**
 * Service to proxy requests to the Python AI microservice.
 */
class AIService {
  constructor() {
    this.client = axios.create({
      baseURL: env.aiService.url,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add authorization if token is configured
    if (env.aiService.token && env.aiService.token !== 'replace-with-a-service-token') {
      this.client.interceptors.request.use((config) => {
        config.headers.Authorization = `Bearer ${env.aiService.token}`;
        return config;
      });
    }
  }

  /**
   * Fetch SHAP explainability insights for a specific employee.
   * @param {string} employeeId - The ID of the employee
   * @returns {Promise<Object>} The AI insights payload
   */
  async explainEmployeeRisk(employeeId) {
    try {
      const emp = await findEmployeeById(employeeId);
      if (!emp) {
        throw new AppError(404, 'NOT_FOUND', 'Employee not found for explanation.');
      }
      
      const payload = {
        employeeId: emp._id.toString(),
        salary: emp.salary,
        dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.toISOString() : undefined,
        joiningDate: emp.joiningDate ? emp.joiningDate.toISOString() : undefined,
        gender: emp.gender,
        employmentType: emp.employmentType,
        workLocation: emp.workLocation,
        designation: emp.designation,
        departmentId: emp.departmentId ? emp.departmentId.toString() : undefined,
        status: emp.status
      };

      const response = await this.client.post(`/explain`, payload);
      return response.data.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.response) {
        throw new AppError(
          error.response.status,
          'AI_SERVICE_ERROR',
          error.response.data.detail || 'AI Service returned an error',
        );
      }
      throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'Failed to connect to AI Service');
    }
  }

  /**
   * Fetch Global Feature Importance from the AI service.
   * @param {number} nSamples - Number of samples to compute importance over.
   * @returns {Promise<Object>} Feature importance payload.
   */
  async getGlobalFeatureImportance(nSamples = 100) {
    try {
      const response = await this.client.get(`/feature-importance?n_samples=${nSamples}`);
      return response.data.data;
    } catch (error) {
      if (error.response) {
        throw new AppError(
          error.response.status,
          'AI_SERVICE_ERROR',
          error.response.data.detail || 'AI Service returned an error'
        );
      }
      throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'Failed to connect to AI Service');
    }
  }

  /**
   * Fetch Global Plots from the AI service.
   * @param {string} feature - Feature to generate dependence plot for.
   * @param {number} nSamples - Number of samples.
   * @returns {Promise<Object>} Plot paths payload.
   */
  async getGlobalPlots(feature = 'salary', nSamples = 100) {
    try {
      const response = await this.client.get(`/plots/global?feature=${feature}&n_samples=${nSamples}`);
      return response.data.data;
    } catch (error) {
      if (error.response) {
        throw new AppError(
          error.response.status,
          'AI_SERVICE_ERROR',
          error.response.data.detail || 'AI Service returned an error'
        );
      }
      throw new AppError(503, 'AI_SERVICE_UNAVAILABLE', 'Failed to connect to AI Service');
    }
  }
}

export const aiService = new AIService();
