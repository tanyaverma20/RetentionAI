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

  // Configuration only, not a live round-trip (getRedisDiagnostics() never
  // calls Upstash) — keeps this endpoint fast and never NOT configured
  // doesn't degrade overallStatus: it's a valid, intentional dev-mode state
  // (see redisClient.js's module docstring). Never includes the token or
  // full URL — host only (Part 16).
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
      // os.loadavg() is POSIX-only and always returns [0,0,0] on Windows —
      // reported as-is rather than faked, with the platform noted so a
      // reader doesn't mistake "0" for "idle".
      cpuLoadAvg: { '1m': cpuLoad[0], '5m': cpuLoad[1], '15m': cpuLoad[2], platform: os.platform() },
      cpuCount: os.cpus().length,
    },
    pipelineLatency: getMetricsSnapshot(),
  });
}
