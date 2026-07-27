import axios from 'axios';
import { Prediction } from '../models/Prediction.js';
import { PredictionHistory } from '../models/PredictionHistory.js';

const AI_API_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const AI_API_TOKEN = process.env.AI_SERVICE_TOKEN || 'replace-with-a-service-token';

const aiClient = axios.create({
  baseURL: AI_API_URL,
  headers: {
    'Authorization': `Bearer ${AI_API_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

class AIService {
  async predictSingle(employeeId) {
    try {
      const response = await aiClient.post('/predict', { employeeId });
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to generate prediction from AI service');
    }
  }

  async predictBatch(departmentId = null, employeeIds = null) {
    try {
      const payload = {};
      if (departmentId) payload.departmentId = departmentId;
      if (employeeIds) payload.employeeIds = employeeIds;

      const response = await aiClient.post('/predict/batch', payload);
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to run batch prediction');
    }
  }

  async getModelInfo() {
    try {
      const response = await aiClient.get('/model/info');
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch model info');
    }
  }

  async getModelMetrics() {
    try {
      const response = await aiClient.get('/model/metrics');
      return response.data.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch model metrics');
    }
  }

  async getPredictionForEmployee(employeeId) {
    // Read directly from MongoDB where FastAPI saved it
    return await Prediction.findOne({ employeeId });
  }

  async getDashboardRiskCounts(organizationId) {
    const results = await Prediction.aggregate([
      { $match: { organizationId } },
      {
        $group: {
          _id: '$riskLevel',
          count: { $sum: 1 },
        }
      }
    ]);
    
    const counts = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    results.forEach(r => {
      counts[r._id] = r.count;
    });
    return counts;
  }
}

export const aiService = new AIService();
