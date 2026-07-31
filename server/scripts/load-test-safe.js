#!/usr/bin/env node
/**
 * Reduced-concurrency variant of load-test.js for this specific sandboxed
 * dev machine, where Mongo, FastAPI's full ML/NLP stack, Express, AND the
 * load generator itself all share one host's RAM/CPU — 250+ concurrent
 * connections crashed the ephemeral dev MongoDB instance outright (see the
 * Sprint 10 Part 9 report). This is not a statement about the application's
 * real capacity ceiling, only about what this one shared machine can host
 * alongside everything else running on it. Use load-test.js's full
 * 100/250/500 levels against a properly resourced environment instead.
 */
import autocannon from 'autocannon';

const BASE_URL = 'http://localhost:5000/api/v1';
const CONCURRENCY_LEVELS = [50, 100, 150];
const DURATION_SECONDS = 8;

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
    requestsPerSec: result.requests.average,
    latencyMs: { p50: result.latency.p50, p95: result.latency.p97_5 ?? result.latency.p99, max: result.latency.max },
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
  };
}

async function main() {
  const token = await login();
  const authHeaders = { Authorization: `Bearer ${token}` };
  const report = {};

  const endpoints = [
    { name: 'dashboard_analytics', path: '/analytics/dashboard-summary' },
    { name: 'employees_list', path: '/employees?limit=20' },
    { name: 'workflow_dashboard', path: '/workflow/dashboard' },
  ];

  for (const endpoint of endpoints) {
    report[endpoint.name] = [];
    for (const connections of CONCURRENCY_LEVELS) {
      const result = await run({ url: `${BASE_URL}${endpoint.path}`, connections, duration: DURATION_SECONDS, headers: authHeaders });
      const summary = summarize(result);
      report[endpoint.name].push(summary);
      console.log(`${endpoint.name} @ ${connections}:`, JSON.stringify(summary));
      await new Promise((r) => setTimeout(r, 1500)); // brief recovery pause between runs
    }
  }

  console.log('\n=== REPORT ===\n' + JSON.stringify(report, null, 2));
}

main().catch((err) => { console.error(err); process.exit(1); });
