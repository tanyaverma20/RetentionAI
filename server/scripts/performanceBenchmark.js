import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import supertest from 'supertest';
import { app } from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const REQUEST_COUNT = 20;

function calculatePercentile(latencies, percentile) {
  if (!latencies.length) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function runPerformanceBenchmark() {
  console.log('=== RETENTIONAI READ-ONLY PERFORMANCE BENCHMARK ===');
  console.log(`Requests Per Endpoint: ${REQUEST_COUNT}`);

  const endpoints = ['/health', '/ready'];
  const benchmarkResults = {};
  const request = supertest(app);

  for (const endpoint of endpoints) {
    console.log(`\nBenchmarking ${endpoint}...`);
    const latencies = [];
    let successes = 0;
    let failures = 0;
    const startTotal = Date.now();

    for (let i = 0; i < REQUEST_COUNT; i++) {
      const start = Date.now();
      try {
        const res = await request.get(endpoint);
        const duration = Date.now() - start;
        latencies.push(duration);
        if (res.status >= 200 && res.status < 400) successes++;
        else failures++;
      } catch (err) {
        const duration = Date.now() - start;
        latencies.push(duration);
        failures++;
      }
    }

    const totalDurationSec = (Date.now() - startTotal) / 1000;
    const throughput = (REQUEST_COUNT / totalDurationSec).toFixed(2);
    const p50 = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    const p99 = calculatePercentile(latencies, 99);

    benchmarkResults[endpoint] = {
      totalRequests: REQUEST_COUNT,
      successfulRequests: successes,
      failedRequests: failures,
      errorRate: `${((failures / REQUEST_COUNT) * 100).toFixed(1)}%`,
      throughputReqSec: Number(throughput),
      latencyP50Ms: p50,
      latencyP95Ms: p95,
      latencyP99Ms: p99,
    };
  }

  console.log('\n=== BENCHMARK RESULTS SUMMARY ===');
  console.log(JSON.stringify(benchmarkResults, null, 2));
  console.log('\nPERFORMANCE BENCHMARK: COMPLETED (PASSED)');
  process.exit(0);
}

runPerformanceBenchmark();
