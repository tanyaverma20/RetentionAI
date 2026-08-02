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
import { explainService } from '../services/explainService.js';
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
    // Delegates to explainService, which owns the FastAPI /feature-importance
    // call. This previously called aiService.getGlobalFeatureImportance(),
    // which has never existed on AIService — the route returned a 500
    // ("aiService.getGlobalFeatureImportance is not a function") for every
    // caller. It went unnoticed because the AI service was never deployed, so
    // the route failed with a plausible-looking AI_SERVICE_UNAVAILABLE before
    // ever reaching the missing method.
    //
    // n_samples is accepted for API compatibility but not forwarded: the
    // FastAPI endpoint computes importance over its own fixed background
    // sample and takes no such parameter.
    const importance = await explainService.getGlobalFeatureImportance();
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

    // Previously: aiService.getGlobalPlots() (a method that does not exist)
    // followed by response.sendFile(plotPath). Both were broken — the second
    // more subtly, since the path returned by the AI service points into
    // *its* container, so sendFile could only ever have worked when both
    // services shared a filesystem. The AI service now streams the PNG and
    // this proxies the bytes through.
    const ALLOWED_PLOT_TYPES = new Set(['summaryBeeswarm', 'summaryBar', 'dependence']);
    if (!ALLOWED_PLOT_TYPES.has(plotType)) {
      throw new AppError(404, 'PLOT_NOT_FOUND', `Plot type ${plotType} not found.`);
    }

    const image = await explainService.getGlobalPlotImage(plotType, feature, nSamples);
    response.setHeader('Content-Type', 'image/png');
    response.setHeader('Cache-Control', 'private, max-age=300');
    return response.send(image);
  } catch (error) {
    return next(error);
  }
}
