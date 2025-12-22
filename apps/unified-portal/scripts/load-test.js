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

const endpoints = [
  { name: 'Health', method: 'GET', path: '/api/health' },
  { name: 'Resolve', method: 'POST', path: '/api/houses/resolve', body: { token: '0dd0ba83-bea2-40e3-93c9-c86893202df6' } },
];

async function runTest() {
  const stats = {
    total: 0,
    success: 0,
    errors: 0,
    timeouts: 0,
    latencies: [],
    statusCodes: {},
  };

  const startTime = Date.now();
  const endTime = startTime + (DURATION_SECONDS * 1000);

  async function makeRequest() {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const url = `${BASE_URL}${endpoint.path}`;
    const start = Date.now();

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
      stats.latencies.push(latency);
      stats.statusCodes[response.status] = (stats.statusCodes[response.status] || 0) + 1;

      if (response.ok || response.status < 500) {
        stats.success++;
      } else {
        stats.errors++;
      }
    } catch (err) {
      stats.total++;
      if (err.name === 'AbortError') {
        stats.timeouts++;
      } else {
        stats.errors++;
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
  console.log(`Errors: ${stats.errors}`);
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
  for (const [code, count] of Object.entries(stats.statusCodes)) {
    console.log(`  ${code}: ${count}`);
  }

  const errorRate = (stats.errors + stats.timeouts) / stats.total * 100;
  if (errorRate > 5) {
    console.log('');
    console.log(`WARNING: Error rate ${errorRate.toFixed(2)}% exceeds 5% threshold`);
    process.exit(1);
  }

  console.log('');
  console.log('Load test completed successfully!');
}

runTest().catch(console.error);
