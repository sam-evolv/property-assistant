#!/usr/bin/env node

const BASE_URL = process.argv[2] || 'http://localhost:5000';
const CONCURRENCY = parseInt(process.argv[3] || '10', 10);
const DURATION_SECONDS = parseInt(process.argv[4] || '10', 10);

console.log('=========================================');
console.log('OpenHouse AI - Load Test');
console.log('=========================================');
console.log(`Target: ${BASE_URL}`);
console.log(`Concurrency: ${CONCURRENCY}`);
console.log(`Duration: ${DURATION_SECONDS}s`);
console.log('');

// Test a known unit for consistent testing
const TEST_UNIT_UID = '0dd0ba83-bea2-40e3-93c9-c86893202df6';

const endpoints = [
  { name: 'Health', method: 'GET', path: '/api/health', weight: 1 },
  { name: 'Resolve', method: 'POST', path: '/api/houses/resolve', body: { token: TEST_UNIT_UID }, weight: 3 },
  { name: 'Profile', method: 'GET', path: `/api/purchaser/profile?unitUid=${TEST_UNIT_UID}&token=${TEST_UNIT_UID}`, weight: 3 },
];

// Weighted random endpoint selection
function pickEndpoint() {
  const totalWeight = endpoints.reduce((sum, e) => sum + (e.weight || 1), 0);
  let rand = Math.random() * totalWeight;
  for (const ep of endpoints) {
    rand -= (ep.weight || 1);
    if (rand <= 0) return ep;
  }
  return endpoints[0];
}

async function runTest() {
  const stats = {
    total: 0,
    success: 0,
    errors: 0,
    timeouts: 0,
    rateLimited: 0,
    serverErrors: 0,
    latencies: [],
    statusCodes: {},
    perEndpoint: {},
  };
  
  // Initialize per-endpoint stats
  endpoints.forEach(e => {
    stats.perEndpoint[e.name] = { total: 0, success: 0, errors: 0, latencies: [] };
  });

  const startTime = Date.now();
  const endTime = startTime + (DURATION_SECONDS * 1000);

  async function makeRequest() {
    const endpoint = pickEndpoint();
    const url = `${BASE_URL}${endpoint.path}`;
    const start = Date.now();
    const epStats = stats.perEndpoint[endpoint.name];

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const options = {
        method: endpoint.method,
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      };

      if (endpoint.body) {
        options.body = JSON.stringify(endpoint.body);
      }

      const response = await fetch(url, options);
      clearTimeout(timeout);

      const latency = Date.now() - start;
      stats.total++;
      epStats.total++;
      stats.latencies.push(latency);
      epStats.latencies.push(latency);
      stats.statusCodes[response.status] = (stats.statusCodes[response.status] || 0) + 1;

      if (response.status === 429) {
        stats.rateLimited++;
        stats.success++; // 429 is expected under load
        epStats.success++;
      } else if (response.status >= 500) {
        stats.serverErrors++;
        stats.errors++;
        epStats.errors++;
      } else if (response.ok || response.status < 500) {
        stats.success++;
        epStats.success++;
      } else {
        stats.errors++;
        epStats.errors++;
      }
    } catch (err) {
      stats.total++;
      epStats.total++;
      if (err.name === 'AbortError') {
        stats.timeouts++;
      } else {
        stats.errors++;
        epStats.errors++;
      }
    }
  }

  async function worker() {
    while (Date.now() < endTime) {
      await makeRequest();
      await new Promise(r => setTimeout(r, 10));
    }
  }

  const workers = Array(CONCURRENCY).fill(null).map(() => worker());
  await Promise.all(workers);

  const duration = (Date.now() - startTime) / 1000;
  const rps = stats.total / duration;

  stats.latencies.sort((a, b) => a - b);
  const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.5)] || 0;
  const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)] || 0;
  const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)] || 0;
  const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length || 0;

  console.log('--- Results ---');
  console.log(`Total requests: ${stats.total}`);
  console.log(`Successful: ${stats.success}`);
  console.log(`Server errors (5xx): ${stats.serverErrors}`);
  console.log(`Rate limited (429): ${stats.rateLimited}`);
  console.log(`Timeouts: ${stats.timeouts}`);
  console.log(`Requests/sec: ${rps.toFixed(2)}`);
  console.log('');
  console.log('--- Latency (ms) ---');
  console.log(`  Avg: ${avg.toFixed(0)}`);
  console.log(`  P50: ${p50}`);
  console.log(`  P95: ${p95}`);
  console.log(`  P99: ${p99}`);
  console.log('');
  console.log('--- Status Codes ---');
  for (const [code, count] of Object.entries(stats.statusCodes).sort()) {
    console.log(`  ${code}: ${count}`);
  }
  console.log('');
  console.log('--- Per Endpoint ---');
  for (const [name, epStats] of Object.entries(stats.perEndpoint)) {
    if (epStats.total > 0) {
      epStats.latencies.sort((a, b) => a - b);
      const epP95 = epStats.latencies[Math.floor(epStats.latencies.length * 0.95)] || 0;
      const epAvg = epStats.latencies.reduce((a, b) => a + b, 0) / epStats.latencies.length || 0;
      console.log(`  ${name}: ${epStats.total} reqs, P95=${epP95}ms, Avg=${epAvg.toFixed(0)}ms, Errors=${epStats.errors}`);
    }
  }

  const serverErrorRate = stats.serverErrors / stats.total * 100;
  if (serverErrorRate > 1) {
    console.log('');
    console.log(`FAIL: Server error rate ${serverErrorRate.toFixed(2)}% exceeds 1% threshold`);
    process.exit(1);
  }

  if (stats.rateLimited > 0) {
    console.log('');
    console.log(`Note: ${stats.rateLimited} requests were rate-limited (429) - this is expected under load`);
  }

  console.log('');
  console.log('Load test completed successfully!');
}

runTest().catch(console.error);
