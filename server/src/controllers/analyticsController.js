/**
 * @file analyticsController.js
 * @description HTTP request handlers for workforce analytics and dashboard metric endpoints.
 *
 * Why this file exists
 * --------------------
 * Extracts HTTP query parameters (departmentId, employmentType, date range, search query),
 * passes request authorization context to `analyticsService`, and returns standardized API responses.
 */

import * as analyticsService from '../services/analyticsService.js';
import { aiService } from '../services/aiService.js';
import { sendSuccess } from '../utils/response.js';
import { AppError } from '../errors/AppError.js';

export async function getDashboardSummary(request, response, next) {
  try {
    const summary = await analyticsService.getDashboardSummary(request.auth, request.query);
    return sendSuccess(response, 200, summary, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getKpis(request, response, next) {
  try {
    const kpis = await analyticsService.getKpis(request.auth, request.query);
    return sendSuccess(response, 200, kpis, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getDepartmentStats(request, response, next) {
  try {
    const stats = await analyticsService.getDepartmentStats(request.auth, request.query);
    return sendSuccess(response, 200, stats, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getMonthlyTrends(request, response, next) {
  try {
    const trends = await analyticsService.getMonthlyTrends(request.auth, request.query);
    return sendSuccess(response, 200, trends, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getDemographics(request, response, next) {
  try {
    const demographics = await analyticsService.getDemographics(request.auth, request.query);
    return sendSuccess(response, 200, demographics, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getEmployeeInsights(request, response, next) {
  try {
    const insights = await analyticsService.getEmployeeInsights(request.auth, request.query);
    return sendSuccess(response, 200, insights, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getHrMetrics(request, response, next) {
  try {
    const metrics = await analyticsService.getHrMetrics(request.auth, request.query);
    return sendSuccess(response, 200, metrics, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getPerformanceAnalytics(request, response, next) {
  try {
    const analytics = await analyticsService.getPerformanceAnalytics(request.auth, request.query);
    return sendSuccess(response, 200, analytics, request.requestId);
  } catch (error) { return next(error); }
}

export async function getAttendanceAnalytics(request, response, next) {
  try {
    const analytics = await analyticsService.getAttendanceAnalytics(request.auth, request.query);
    return sendSuccess(response, 200, analytics, request.requestId);
  } catch (error) { return next(error); }
}

export async function getTrainingAnalytics(request, response, next) {
  try {
    const analytics = await analyticsService.getTrainingAnalytics(request.auth, request.query);
    return sendSuccess(response, 200, analytics, request.requestId);
  } catch (error) { return next(error); }
}

export async function getAiFeatureImportance(request, response, next) {
  try {
    const nSamples = request.query.n_samples ? parseInt(request.query.n_samples, 10) : 100;
    const importance = await aiService.getGlobalFeatureImportance(nSamples);
    return sendSuccess(response, 200, importance, request.requestId);
  } catch (error) {
    return next(error);
  }
}

export async function getAiGlobalPlot(request, response, next) {
  try {
    const plotType = request.params.plotType; // summaryBeeswarm, summaryBar, dependence
    const feature = request.query.feature || 'salary';
    const nSamples = request.query.n_samples ? parseInt(request.query.n_samples, 10) : 100;

    const plots = await aiService.getGlobalPlots(feature, nSamples);
    const plotPath = plots[plotType];

    if (!plotPath) {
      throw new AppError(404, 'PLOT_NOT_FOUND', `Plot type ${plotType} not found.`);
    }

    return response.sendFile(plotPath, (err) => {
      if (err) {
        next(new AppError(404, 'PLOT_READ_ERROR', 'Failed to read plot file.'));
      }
    });
  } catch (error) {
    return next(error);
  }
}
