import { aiService } from '../services/aiService.js';
import { AppError } from '../middleware/errorHandler.js';

export const predictSingle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prediction = await aiService.predictSingle(id);
    res.status(200).json({ success: true, data: prediction });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export const predictBatch = async (req, res, next) => {
  try {
    const { departmentId, employeeIds } = req.body;
    const result = await aiService.predictBatch(departmentId, employeeIds);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export const getModelInfo = async (req, res, next) => {
  try {
    const info = await aiService.getModelInfo();
    res.status(200).json({ success: true, data: info });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export const getModelMetrics = async (req, res, next) => {
  try {
    const metrics = await aiService.getModelMetrics();
    res.status(200).json({ success: true, data: metrics });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};

export const getDashboardAnalytics = async (req, res, next) => {
  try {
    const counts = await aiService.getDashboardRiskCounts(req.user.organizationId);
    res.status(200).json({ success: true, data: { riskCounts: counts } });
  } catch (error) {
    next(new AppError(error.message, 500));
  }
};
