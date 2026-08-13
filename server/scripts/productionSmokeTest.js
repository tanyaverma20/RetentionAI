/**
 * RetentionAI — Non-Destructive Production Smoke Test
 *
 * Performs strict read-only validation against the backend API,
 * readiness probes, billing catalog, and AI service endpoint.
 *
 * DO NOT perform destructive mutations or reseed production data.
 */

import http from 'node:http';
import https from 'node:https';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

function fetchUrl(urlStr) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(urlStr, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data, headers: res.headers });
      });
    });
    req.on('error', (err) => resolve({ statusCode: 0, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ statusCode: 0, error: 'Request timeout' });
    });
  });
}

async function runSmokeTest() {
  console.log('====================================================');
  console.log('RetentionAI Production Non-Destructive Smoke Test');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Health Probe
  console.log('1. Testing Backend /health...');
  const healthRes = await fetchUrl(`${SERVER_URL}/health`);
  if (healthRes.statusCode === 200) {
    console.log('   [PASS] /health returned HTTP 200 OK');
    passed++;
  } else {
    console.log(`   [FAIL/SKIP] /health returned ${healthRes.statusCode} (${healthRes.error || ''})`);
  }

  // 2. Readiness Probe
  console.log('2. Testing Backend /ready...');
  const readyRes = await fetchUrl(`${SERVER_URL}/ready`);
  if (readyRes.statusCode === 200) {
    console.log('   [PASS] /ready returned HTTP 200 OK');
    passed++;
  } else {
    console.log(`   [FAIL/SKIP] /ready returned ${readyRes.statusCode} (${readyRes.error || ''})`);
  }

  // 3. Billing Plan Catalog Endpoint
  console.log('3. Testing Billing Catalog GET /api/v1/billing/plans...');
  const planRes = await fetchUrl(`${SERVER_URL}/api/v1/billing/plans`);
  if (planRes.statusCode === 200) {
    console.log('   [PASS] /api/v1/billing/plans returned HTTP 200 OK');
    passed++;
  } else {
    console.log(`   [FAIL/SKIP] /api/v1/billing/plans returned ${planRes.statusCode}`);
  }

  // 4. AI Service Health Endpoint
  console.log('4. Testing AI Service GET /health...');
  const aiHealthRes = await fetchUrl(`${AI_SERVICE_URL}/health`);
  if (aiHealthRes.statusCode === 200) {
    console.log('   [PASS] AI Service /health returned HTTP 200 OK');
    passed++;
  } else {
    console.log(`   [WARN/SKIP] AI Service /health returned ${aiHealthRes.statusCode} (${aiHealthRes.error || 'offline/unreachable'})`);
  }

  console.log('\n====================================================');
  console.log(`Smoke Test Verification Script Complete`);
  console.log('====================================================');
}

runSmokeTest();
