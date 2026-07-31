#!/usr/bin/env node
/**
 * RetentionAI — load test harness (Sprint 10, Part 9).
 *
 * Runs autocannon against the LIVE dev stack (must already be running) at
 * increasing concurrency for cheap, cacheable read endpoints (dashboard,
 * search, prediction-read), and at a single conservative concurrency for
 * endpoints that call out to an external LLM (Groq) or generate a file —
 * hammering those at 500 connections would just load-test Groq's rate
 * limiter, not this application, and could incur real API cost.
 *
 * Usage: node --env-file=.env scripts/load-test.js
 */

import autocannon from 'autocannon';

const BASE_URL = 'http://localhost:5000/api/v1';
const CONCURRENCY_LEVELS = [100, 250, 500];
const DURATION_SECONDS = 10;

async function login() {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.test', password: 'Admin#12345' }),
  });
  const json = await response.json();
  return json.data.accessToken;
}

function run(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

function summarize(result) {
  return {
    connections: result.connections,
    durationSec: result.duration,
    requestsPerSec: result.requests.average,
    latencyMs: { p50: result.latency.p50, p95: result.latency.p97_5 ?? result.latency.p99, p99: result.latency.p99, max: result.latency.max },
    throughputMBps: Math.round((result.throughput.average / 1024 / 1024) * 100) / 100,
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
  };
}

async function main() {
  const token = await login();
  const authHeaders = { Authorization: `Bearer ${token}` };
  const report = { scaledEndpoints: {}, fixedConcurrencyEndpoints: {} };

  const scaledEndpoints = [
    { name: 'dashboard_analytics', path: '/analytics/dashboard-summary' },
    { name: 'global_search', path: '/search?q=engineering' },
    { name: 'employees_list', path: '/employees?limit=20' },
  ];

  for (const endpoint of scaledEndpoints) {
    report.scaledEndpoints[endpoint.name] = [];
    for (const connections of CONCURRENCY_LEVELS) {
      console.log(`\n=== ${endpoint.name} @ ${connections} connections ===`);
      const result = await run({
        url: `${BASE_URL}${endpoint.path}`,
        connections,
        duration: DURATION_SECONDS,
        headers: authHeaders,
      });
      const summary = summarize(result);
      report.scaledEndpoints[endpoint.name].push(summary);
      console.log(JSON.stringify(summary, null, 1));
    }
  }

  // Conservative, fixed concurrency for expensive/external-dependency endpoints.
  const fixedEndpoints = [
    { name: 'ai_predict_cached', path: '/ai/predict/6a6b61bd88bd95a656e0ac6e', method: 'POST', connections: 50 },
    { name: 'decision_cached', path: '/decisions/6a6b61bd88bd95a656e0ac6e/generate', method: 'POST', connections: 20 },
    { name: 'workflow_dashboard', path: '/workflow/dashboard', connections: 100 },
  ];

  for (const endpoint of fixedEndpoints) {
    console.log(`\n=== ${endpoint.name} @ ${endpoint.connections} connections (fixed) ===`);
    const result = await run({
      url: `${BASE_URL}${endpoint.path}`,
      connections: endpoint.connections,
      duration: DURATION_SECONDS,
      method: endpoint.method || 'GET',
      headers: authHeaders,
    });
    const summary = summarize(result);
    report.fixedConcurrencyEndpoints[endpoint.name] = summary;
    console.log(JSON.stringify(summary, null, 1));
  }

  console.log('\n\n=== FULL REPORT (JSON) ===');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error('Load test failed:', err);
  process.exit(1);
});
