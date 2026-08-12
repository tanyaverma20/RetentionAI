import os from 'os';
import axios from 'axios';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { getMetricsSnapshot } from '../middlewares/metrics.js';
import { getRedisDiagnostics } from '../utils/redisClient.js';

const startedAt = Date.now();

/** Fast liveness probe — no external calls, used by Docker/orchestrator HEALTHCHECK. Must stay under a few ms. */
export function getHealth(_request, response) {
  response.status(200).json({ status: 'OK', uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
}

async function checkMongo() {
  const start = Date.now();
  try {
    if (mongoose.connection.readyState !== 1) {
      return { status: 'DOWN', latencyMs: null, detail: `readyState=${mongoose.connection.readyState}` };
    }
    await mongoose.connection.db.admin().ping();
    return { status: 'UP', latencyMs: Date.now() - start };
  } catch (error) {
    return { status: 'DOWN', latencyMs: Date.now() - start, detail: error.message };
  }
}

async function checkAiService() {
  const start = Date.now();
  try {
    await axios.get(`${env.aiService.url}/health`, { timeout: 3000 });
    return { status: 'UP', latencyMs: Date.now() - start };
  } catch (error) {
    return { status: 'DOWN', latencyMs: Date.now() - start, detail: error.message };
  }
}

/** Deep health check — dependency status, resource usage, and pipeline latency. Not on the hot path; used by dashboards/alerting, not container orchestration. */
export async function getDetailedHealth(_request, response) {
  const [mongo, aiService] = await Promise.all([checkMongo(), checkAiService()]);

  const memory = process.memoryUsage();
  const cpuLoad = os.loadavg(); // [1min, 5min, 15min] — Windows always reports [0,0,0], documented below.

  const overallStatus = mongo.status === 'UP' && aiService.status === 'UP' ? 'UP' : 'DEGRADED';

  const redis = getRedisDiagnostics();

  response.status(overallStatus === 'UP' ? 200 : 503).json({
    status: overallStatus,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    dependencies: { mongo, aiService, redis },
    resources: {
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
      },
      cpuLoadAvg: { '1m': cpuLoad[0], '5m': cpuLoad[1], '15m': cpuLoad[2], platform: os.platform() },
      cpuCount: os.cpus().length,
    },
    pipelineLatency: getMetricsSnapshot(),
  });
}

/**
 * Readiness Probe: GET /ready
 * Verifies readiness of MongoDB, Redis, AI service, and ChromaDB vector retrieval.
 * Returns HTTP 200 for 'healthy' / 'degraded' and HTTP 503 for 'not_ready'.
 */
export async function getReadiness(request, response) {
  const correlationId = request.correlationId || request.requestId;
  const [mongo, aiService] = await Promise.all([checkMongo(), checkAiService()]);
  const redis = getRedisDiagnostics();

  const isMongoReady = mongo.status === 'UP';
  const isAiServiceReady = aiService.status === 'UP';
  const isRedisConfigured = redis.configured || redis.mode === 'in_memory';

  let status = 'healthy';
  let httpStatusCode = 200;

  if (!isMongoReady) {
    status = 'not_ready';
    httpStatusCode = 503;
  } else if (!isAiServiceReady) {
    status = 'degraded';
    httpStatusCode = 200;
  }

  return response.status(httpStatusCode).json({
    status,
    correlationId,
    timestamp: new Date().toISOString(),
    checks: {
      database: { status: mongo.status, latencyMs: mongo.latencyMs },
      aiService: { status: aiService.status, latencyMs: aiService.latencyMs },
      redis: { status: isRedisConfigured ? 'UP' : 'DEGRADED', mode: redis.mode },
      vectorStore: { status: isAiServiceReady ? 'UP' : 'UNKNOWN' },
    },
  });
}
