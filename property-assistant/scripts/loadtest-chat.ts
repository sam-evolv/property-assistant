import { db } from '@openhouse/db/client';
import { developments, homeowners } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { generateTestJWTBatch } from './utils/generateTestJWT';

/**
 * PHASE 17.2: Authenticated Chat Load Testing
 * Simulates concurrent chat requests with real homeowner JWTs
 */

interface ChatTestResult {
  homeownerId: string;
  houseNumber: string;
  questionNumber: number;
  question: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  httpStatus?: number;
  error?: string;
}

const SAMPLE_QUESTIONS = [
  'Where is the main water shutoff valve located?',
  'How do I reset the boiler if it stops working?',
  'What is the warranty period for the house?',
  'How do I operate the heating system?',
  'Where are the fuse boxes located?',
  'What appliances are included?',
  'How do I contact emergency maintenance?',
  'What type of windows are installed?',
  'How do I operate the ventilation system?',
  'Where is the stopcock located?',
];

async function performChatRequest(
  baseUrl: string,
  developmentId: string,
  tenantSlug: string,
  homeownerId: string,
  houseNumber: string,
  question: string,
  questionNumber: number,
  jwtToken: string
): Promise<ChatTestResult> {
  const startTime = Date.now();

  try {
    // Use authenticated chat endpoint with homeowner JWT
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Slug': tenantSlug,
        'Authorization': `Bearer ${jwtToken}`,
        'Cookie': `homeowner_token=${jwtToken}`,
      },
      body: JSON.stringify({
        message: question,
        developmentId: developmentId,
      }),
    });

    const endTime = Date.now();
    const httpStatus = response.status;

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error');
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    return {
      homeownerId,
      houseNumber,
      questionNumber,
      question,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      success: true,
      httpStatus,
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      homeownerId,
      houseNumber,
      questionNumber,
      question,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runChatLoadTest(
  developmentId: string,
  tenantSlug: string,
  houses: Array<{ id: string; houseNumber: string; jwt: string }>,
  baseUrl: string,
  concurrentQuestions: number = 3
): Promise<ChatTestResult[]> {
  console.log(`\n🔥 Simulating ${houses.length} homeowners × ${concurrentQuestions} questions each...\n`);

  const allRequests: Promise<ChatTestResult>[] = [];

  // Each homeowner asks N questions
  houses.forEach(house => {
    for (let i = 0; i < concurrentQuestions; i++) {
      const question = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];
      allRequests.push(
        performChatRequest(
          baseUrl,
          developmentId,
          tenantSlug,
          house.id,
          house.houseNumber,
          question,
          i + 1,
          house.jwt
        )
      );
    }
  });

  console.log(`📤 Sending ${allRequests.length} concurrent authenticated requests...`);
  
  const results = await Promise.all(allRequests);
  return results;
}

function analyzeResults(results: ChatTestResult[]): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n📊 AUTHENTICATED CHAT LOAD TEST RESULTS');
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

    console.log('\n⏱️  End-to-End Response Times:');
    console.log(`   Min:     ${min}ms`);
    console.log(`   Average: ${Math.round(avg)}ms`);
    console.log(`   p50:     ${p50}ms`);
    console.log(`   p95:     ${p95}ms`);
    console.log(`   p99:     ${p99}ms`);
    console.log(`   Max:     ${max}ms`);

    // Performance assessment
    console.log('\n📋 Performance Assessment:');
    if (p95 < 3000) {
      console.log('   ✅ p95 < 3s: Excellent performance');
    } else if (p95 < 5000) {
      console.log('   ⚠️  p95 < 5s: Acceptable, consider optimization');
    } else {
      console.log('   ❌ p95 > 5s: Poor performance, optimization required');
    }

    if (p99 < 5000) {
      console.log('   ✅ p99 < 5s: Good tail latency');
    } else {
      console.log('   ⚠️  p99 > 5s: High tail latency, investigate slow queries');
    }

    // Identify very slow requests (>5s)
    const verySlow = successful.filter(r => r.durationMs > 5000);
    if (verySlow.length > 0) {
      console.log(`\n⚠️  Very slow requests (>5s): ${verySlow.length}`);
      verySlow.slice(0, 5).forEach(r => {
        console.log(`   - House ${r.houseNumber}, Q${r.questionNumber}: ${r.durationMs}ms - "${r.question.substring(0, 40)}..."`);
      });
    }
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Requests:');
    
    // Group errors by type
    const errorGroups = failed.reduce((acc, f) => {
      const errKey = f.error?.substring(0, 100) || 'Unknown error';
      acc[errKey] = (acc[errKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(errorGroups).forEach(([error, count]) => {
      console.log(`   - ${error}: ${count} occurrence(s)`);
    });

    // Show sample failures
    if (failed.length <= 5) {
      console.log('\n   Sample failures:');
      failed.forEach(f => {
        console.log(`   - House ${f.houseNumber}: ${f.error}`);
      });
    }
  }

  // Memory usage (optional)
  const memUsage = process.memoryUsage();
  console.log('\n💾 Memory Usage:');
  console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
  console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`   Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);

  console.log('\n' + '='.repeat(60));
}

async function main() {
  console.log('🎯 PHASE 17.2: Authenticated Chat Load Test');
  console.log('='.repeat(60));

  // Find Longview Park development
  const development = await db.query.developments.findFirst({
    where: eq(developments.name, 'Longview Park'),
    with: {
      tenant: true,
    },
  });

  if (!development) {
    console.error('\n❌ Error: Longview Park development not found');
    console.log('💡 Run: npm run seed:longview first');
    process.exit(1);
  }

  const houses = await db.query.homeowners.findMany({
    where: eq(homeowners.development_id, development.id),
    limit: 20,
  });

  if (houses.length === 0) {
    console.error('\n❌ Error: No houses found');
    process.exit(1);
  }

  console.log(`\n✓ Found development: ${development.name}`);
  console.log(`  Tenant: ${development.tenant.slug}`);
  console.log(`  Houses: ${houses.length}`);

  // Generate JWTs for all test houses
  console.log('\n🔐 Generating test JWTs...');
  
  const jwtPayloads = houses.map(h => {
    const metadata = h.metadata as { houseNumber?: string; houseType?: string } || {};
    return {
      tenant_id: development.tenant_id,
      development_id: development.id,
      house_id: h.id,
      house_type: metadata.houseType || null,
    };
  });

  const jwtMap = await generateTestJWTBatch(jwtPayloads);
  console.log(`✓ Generated ${jwtMap.size} JWTs`);

  const houseData = houses.map(h => {
    const metadata = h.metadata as { houseNumber?: string } || {};
    const jwt = jwtMap.get(h.id);
    
    if (!jwt) {
      throw new Error(`Failed to generate JWT for house ${h.id}`);
    }

    return {
      id: h.id,
      houseNumber: metadata.houseNumber || h.id.substring(0, 8),
      jwt,
    };
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:5000';

  console.log(`\n📍 Target: ${baseUrl}`);
  console.log(`   Questions per house: ${SAMPLE_QUESTIONS.length}`);
  console.log(`   Total requests: ${houseData.length * 3}`);
  console.log(`   Authentication: Homeowner JWT`);

  const results = await runChatLoadTest(
    development.id,
    development.tenant.slug,
    houseData,
    baseUrl,
    3 // 3 questions per house for faster testing
  );
  
  analyzeResults(results);

  console.log('\n\n✅ AUTHENTICATED CHAT LOAD TEST COMPLETE');
  console.log('\n📋 Recommendations:');
  console.log('   1. If p95 > 3s, optimize RAG retrieval');
  console.log('   2. If p99 > 5s, check OpenAI rate limits');
  console.log('   3. If failures > 5%, investigate authentication or rate limiting');
  console.log('   4. Review error logs for patterns: cat logs/errors.jsonl');

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Authenticated chat load test failed:', error);
    process.exit(1);
  });
}
