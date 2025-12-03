import { db } from '@openhouse/db/client';
import { homeowners, developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

/**
 * PHASE 17.2: Authenticated Onboarding Flow Load Testing
 * Simulates concurrent homeowner onboarding with QR token resolution
 */

interface OnboardingTestResult {
  homeownerId: string;
  houseNumber: string;
  qrToken: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  httpStatus?: number;
  error?: string;
  steps?: {
    pageLoad: number;
    tokenResolution?: number;
  };
}

async function performOnboardingRequest(
  baseUrl: string,
  homeownerId: string,
  houseNumber: string,
  qrToken: string
): Promise<OnboardingTestResult> {
  const startTime = Date.now();

  try {
    // Step 1: Load onboarding page with QR token
    const pageLoadStart = Date.now();
    const pageResponse = await fetch(`${baseUrl}/onboarding/${qrToken}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'LoadTest/1.0',
      },
      redirect: 'manual', // Don't follow redirects automatically
    });

    const pageLoadTime = Date.now() - pageLoadStart;

    // Accept both 200 (page rendered) and 302 (redirect to authenticated page)
    if (pageResponse.status !== 200 && pageResponse.status !== 302) {
      throw new Error(`Page load failed: HTTP ${pageResponse.status}`);
    }

    // Step 2: Attempt to resolve QR token (backend validation)
    const resolveStart = Date.now();
    const resolveResponse = await fetch(`${baseUrl}/api/qr/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: qrToken,
      }),
    });

    const resolveTime = Date.now() - resolveStart;

    // Resolution should succeed (200) or indicate already onboarded (409)
    if (resolveResponse.status !== 200 && resolveResponse.status !== 409) {
      const errorText = await resolveResponse.text().catch(() => 'Unable to read error');
      throw new Error(`Token resolution failed: HTTP ${resolveResponse.status}: ${errorText}`);
    }

    const endTime = Date.now();

    return {
      homeownerId,
      houseNumber,
      qrToken,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      success: true,
      httpStatus: pageResponse.status,
      steps: {
        pageLoad: pageLoadTime,
        tokenResolution: resolveTime,
      },
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      homeownerId,
      houseNumber,
      qrToken,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runOnboardingLoadTest(
  houses: Array<{ id: string; unique_qr_token: string | null; metadata: any }>,
  baseUrl: string
): Promise<OnboardingTestResult[]> {
  // Filter houses with valid QR tokens
  const housesWithTokens = houses.filter(h => h.unique_qr_token);

  if (housesWithTokens.length === 0) {
    throw new Error('No houses have QR tokens. Run npm run generate:qrs first');
  }

  console.log(`\n🔥 Simulating ${housesWithTokens.length} concurrent onboarding attempts...\n`);

  const requests: Promise<OnboardingTestResult>[] = housesWithTokens.map(house => {
    const metadata = house.metadata as { houseNumber?: string } || {};
    const houseNumber = metadata.houseNumber || house.id.substring(0, 8);
    
    return performOnboardingRequest(
      baseUrl,
      house.id,
      houseNumber,
      house.unique_qr_token!
    );
  });

  console.log(`📤 Sending ${requests.length} concurrent requests...`);
  
  const results = await Promise.all(requests);
  return results;
}

function analyzeResults(results: OnboardingTestResult[]): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n📊 AUTHENTICATED ONBOARDING LOAD TEST RESULTS');
  console.log('='.repeat(60));

  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  const successRate = (successful.length / results.length) * 100;
  console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

  if (successful.length > 0) {
    const durations = successful.map(r => r.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, val) => acc + val, 0);
    const avg = sum / durations.length;
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];
    const min = durations[0];
    const max = durations[durations.length - 1];

    console.log('\n⏱️  Total Response Times:');
    console.log(`   Min:     ${min}ms`);
    console.log(`   Average: ${Math.round(avg)}ms`);
    console.log(`   p50:     ${p50}ms`);
    console.log(`   p95:     ${p95}ms`);
    console.log(`   p99:     ${p99}ms`);
    console.log(`   Max:     ${max}ms`);

    // Analyze step-by-step performance
    const withSteps = successful.filter(r => r.steps);
    if (withSteps.length > 0) {
      const avgPageLoad = withSteps.reduce((acc, r) => acc + (r.steps?.pageLoad || 0), 0) / withSteps.length;
      const avgResolve = withSteps.reduce((acc, r) => acc + (r.steps?.tokenResolution || 0), 0) / withSteps.length;
      
      console.log('\n📋 Step-by-Step Breakdown:');
      console.log(`   Page Load:         ${Math.round(avgPageLoad)}ms`);
      console.log(`   Token Resolution:  ${Math.round(avgResolve)}ms`);
    }

    // Performance assessment
    console.log('\n📋 Performance Assessment:');
    if (p95 < 1000) {
      console.log('   ✅ p95 < 1s: Excellent onboarding performance');
    } else if (p95 < 2000) {
      console.log('   ⚠️  p95 < 2s: Acceptable, consider optimization');
    } else {
      console.log('   ❌ p95 > 2s: Slow onboarding, optimization required');
    }

    // Identify slow onboardings (>2s)
    const slowRequests = successful.filter(r => r.durationMs > 2000);
    if (slowRequests.length > 0) {
      console.log(`\n⚠️  Slow requests (>2s): ${slowRequests.length}`);
      slowRequests.slice(0, 5).forEach(r => {
        console.log(`   - House ${r.houseNumber}: ${r.durationMs}ms`);
      });
    }
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Requests:');
    const errorGroups = failed.reduce((acc, f) => {
      const errKey = f.error?.substring(0, 100) || 'Unknown error';
      acc[errKey] = (acc[errKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(errorGroups).forEach(([error, count]) => {
      console.log(`   - ${error}: ${count} occurrence(s)`);
    });
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  console.log('\n💾 Memory Usage:');
  console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
  console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);

  console.log('\n' + '='.repeat(60));
}

async function main() {
  console.log('🎯 PHASE 17.2: Authenticated Onboarding Flow Load Test');
  console.log('='.repeat(60));

  // Find Longview Park houses
  const development = await db.query.developments.findFirst({
    where: eq(developments.name, 'Longview Park'),
  });

  if (!development) {
    console.error('\n❌ Error: Longview Park development not found');
    console.log('💡 Run: npm run seed:longview first');
    process.exit(1);
  }

  const houses = await db.query.homeowners.findMany({
    where: eq(homeowners.development_id, development.id),
  });

  if (houses.length === 0) {
    console.error('\n❌ Error: No houses found');
    process.exit(1);
  }

  // Filter houses with QR tokens
  const housesWithQR = houses.filter(h => h.unique_qr_token);

  console.log(`\n✓ Found ${housesWithQR.length} houses with QR tokens (out of ${houses.length} total)`);

  if (housesWithQR.length === 0) {
    console.error('\n❌ Error: No houses have QR tokens');
    console.log('💡 Run: npm run generate:qrs to create QR codes');
    process.exit(1);
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:5000';
  console.log(`\n📍 Target: ${baseUrl}`);
  console.log(`   Testing ${housesWithQR.length} concurrent onboarding flows`);
  console.log(`   Testing: Page load + Token resolution`);

  const results = await runOnboardingLoadTest(houses, baseUrl);
  analyzeResults(results);

  console.log('\n\n✅ AUTHENTICATED ONBOARDING LOAD TEST COMPLETE');
  console.log('\n📋 Recommendations:');
  console.log('   1. If p95 > 1s, optimize page load and asset delivery');
  console.log('   2. If p99 > 2s, check database query performance');
  console.log('   3. If failures > 5%, investigate QR token generation');
  console.log('   4. Review error logs: cat logs/errors.jsonl');

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Authenticated onboarding load test failed:', error);
  process.exit(1);
});
