/**
 * @file metrics.js
 * @description In-process latency tracking — Sprint 10, Part 4 (Monitoring).
 *
 * Deliberately in-memory rather than Prometheus/StatsD: this is a
 * single-instance MVP, so a rolling sample window per route category is
 * enough to answer "is prediction/decision/knowledge/dashboard latency
 * healthy right now" from the /health/deep endpoint without adding a new
 * infrastructure dependency. A multi-instance deployment would need to
 * replace this with a real metrics backend — documented as tech debt.
 */

const WINDOW_SIZE = 200;

const CATEGORY_MATCHERS = [
  { name: 'prediction', test: (p) => p.startsWith('/api/v1/ai/predict') },
  { name: 'decision', test: (p) => p.startsWith('/api/v1/decisions') },
  { name: 'knowledge', test: (p) => p.startsWith('/api/v1/knowledge') },
  { name: 'shap', test: (p) => p.startsWith('/api/v1/explain') },
  { name: 'dashboard', test: (p) => p.startsWith('/api/v1/analytics') || p.startsWith('/api/v1/executive/dashboard') || p.startsWith('/api/v1/workflow/dashboard') },
];

const samples = new Map(); // category -> number[] (ms)
let totalRequests = 0;
let totalErrors = 0;

function categorize(path) {
  const match = CATEGORY_MATCHERS.find((c) => c.test(path));
  return match?.name || null;
}

function record(category, durationMs) {
  if (!samples.has(category)) samples.set(category, []);
  const arr = samples.get(category);
  arr.push(durationMs);
  if (arr.length > WINDOW_SIZE) arr.shift();
}

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[index]);
}

export function metricsMiddleware(request, response, next) {
  const start = process.hrtime.bigint();
  response.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    totalRequests += 1;
    if (response.statusCode >= 500) totalErrors += 1;
    const category = categorize(request.path);
    if (category) record(category, durationMs);
  });
  next();
}

export function getMetricsSnapshot() {
  const categories = {};
  for (const [name, arr] of samples.entries()) {
    categories[name] = {
      sampleCount: arr.length,
      avgMs: arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null,
      p95Ms: percentile(arr, 95),
      maxMs: arr.length ? Math.round(Math.max(...arr)) : null,
    };
  }
  return {
    totalRequests,
    totalErrors,
    errorRate: totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0,
    categories,
  };
}
