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
import { sendSuccess } from '../utils/response.js';

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

