import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

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
      const response = await this.client.get(`/explain/${employeeId}`);
      return response.data.data;
    } catch (error) {
      if (error.response) {
        throw new AppError(error.response.data.detail || 'AI Service Error', error.response.status);
      }
      throw new AppError('Failed to connect to AI Service', 503);
    }
  }
}

export const aiService = new AIService();
