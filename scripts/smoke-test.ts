import { db } from '@openhouse/db/client';
import { developments, homeowners, tenants } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { generateTestJWT } from './utils/generateTestJWT';

/**
 * PHASE 21: Full System Smoke Test
 * Quick end-to-end validation of all core features for pilot launch readiness
 */

interface SmokeTestResult {
  feature: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
  details?: any;
}

const TEST_QUESTIONS = [
  'Where is the main water shutoff valve?',
  'How do I reset the boiler?',
  'What is the warranty period?',
  'How do I operate the heating system?',
  'Where are the fuse boxes located?',
];

async function testOnboarding(
  baseUrl: string,
  tenantSlug: string,
  homeownerToken: string
): Promise<SmokeTestResult> {
  const startTime = Date.now();
  try {
    // Test QR resolve endpoint (GET method with uid parameter)
    const testUid = '00000000-0000-0000-0000-000000000000'; // Invalid test UID
    const response = await fetch(`${baseUrl}/api/qr/resolve?uid=${testUid}`, {
      method: 'GET',
      headers: {
        'x-tenant': tenantSlug,
      },
    });

    const durationMs = Date.now() - startTime;

    if (response.status === 401 || response.status === 404 || response.status === 400) {
      // Expected for test data - UID won't match real QR token
      return {
        feature: 'Onboarding',
        status: 'PASS',
        durationMs,
        details: 'Endpoint responding correctly (validation working)',
      };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      feature: 'Onboarding',
      status: 'PASS',
      durationMs,
      details: data,
    };
  } catch (error: any) {
    return {
      feature: 'Onboarding',
      status: 'FAIL',
      durationMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function testChat(
  baseUrl: string,
  tenantSlug: string,
  developmentId: string,
  jwtToken: string,
  questionIndex: number
): Promise<SmokeTestResult> {
  const startTime = Date.now();
  const question = TEST_QUESTIONS[questionIndex % TEST_QUESTIONS.length];

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant': tenantSlug,
        'Cookie': `homeowner_token=${jwtToken}`,
      },
      body: JSON.stringify({
        message: question,
        developmentId: developmentId,
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.reply) {
      throw new Error('No reply in response');
    }

    return {
      feature: `Chat Request ${questionIndex + 1}`,
      status: 'PASS',
      durationMs,
      details: {
        question,
        responseLength: data.reply.length,
        sourceCount: data.sources?.length || 0,
      },
    };
  } catch (error: any) {
    return {
      feature: `Chat Request ${questionIndex + 1}`,
      status: 'FAIL',
      durationMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function testDocuments(
  baseUrl: string,
  tenantSlug: string,
  developmentId: string
): Promise<SmokeTestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/documents?tenantSlug=${tenantSlug}&developmentId=${developmentId}`, {
      method: 'GET',
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      feature: 'Document Fetch',
      status: 'PASS',
      durationMs,
      details: {
        documentCount: data.documents?.length || 0,
      },
    };
  } catch (error: any) {
    return {
      feature: 'Document Fetch',
      status: 'FAIL',
      durationMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function testNoticeboard(
  baseUrl: string,
  tenantSlug: string
): Promise<SmokeTestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/notices`, {
      method: 'GET',
      headers: {
        'x-tenant': tenantSlug,
      },
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      feature: 'Noticeboard List',
      status: 'PASS',
      durationMs,
      details: {
        postCount: data.notices?.length || 0,
      },
    };
  } catch (error: any) {
    return {
      feature: 'Noticeboard List',
      status: 'FAIL',
      durationMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function testTheme(
  baseUrl: string,
  tenantSlug: string
): Promise<SmokeTestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/theme/get`, {
      method: 'GET',
      headers: {
        'x-tenant': tenantSlug,
      },
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      feature: 'Theme Fetch',
      status: 'PASS',
      durationMs,
      details: {
        hasTheme: !!data.theme,
        primaryColor: data.theme?.primaryColor,
      },
    };
  } catch (error: any) {
    return {
      feature: 'Theme Fetch',
      status: 'FAIL',
      durationMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function testHealthCheck(
  baseUrl: string
): Promise<SmokeTestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${baseUrl}/api/health/db`, {
      method: 'GET',
    });

    const durationMs = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'healthy') {
      throw new Error(`Database unhealthy: ${data.status}`);
    }

    return {
      feature: 'Database Health',
      status: 'PASS',
      durationMs,
      details: {
        status: data.status,
        latencyMs: data.latencyMs,
        poolStats: data.poolStats,
      },
    };
  } catch (error: any) {
    return {
      feature: 'Database Health',
      status: 'FAIL',
      durationMs: Date.now() - startTime,
      error: error.message,
    };
  }
}

async function runSmokeTest() {
  console.log('🧪 PHASE 21: FULL SYSTEM SMOKE TEST\n');
  console.log('═'.repeat(60));

  const results: SmokeTestResult[] = [];

  try {
    // Get test development
    const development = await db.query.developments.findFirst({
      where: eq(developments.name, 'Longview Park'),
      with: {
        tenant: true,
      },
    });

    if (!development) {
      console.error('❌ FAIL: Longview Park development not found');
      console.log('\nRun: npm run seed:longview');
      process.exit(1);
    }

    // Get test homeowner (represents a house in our schema)
    const homeowner = await db.query.homeowners.findFirst({
      where: eq(homeowners.development_id, development.id),
    });

    if (!homeowner) {
      console.error('❌ FAIL: No homeowners found in Longview Park');
      console.log('\nRun: npm run seed:longview');
      process.exit(1);
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : 'http://localhost:5000';

    const tenantSlug = development.tenant.slug;

    console.log(`\n📋 Test Configuration:`);
    console.log(`   Base URL: ${baseUrl}`);
    console.log(`   Tenant: ${tenantSlug}`);
    console.log(`   Development: ${development.name}`);
    console.log(`   House ID: ${homeowner.id}`);
    console.log(`   Homeowner: ${homeowner.name}`);
    console.log(`   Address: ${homeowner.address || 'N/A'}`);
    console.log('\n' + '─'.repeat(60) + '\n');

    // Generate test JWT
    const jwtToken = await generateTestJWT({
      tenant_id: development.tenant_id,
      development_id: development.id,
      house_id: homeowner.id,
      house_type: homeowner.house_type,
    });

    // Test 1: Database Health Check
    console.log('🔍 Testing Database Health...');
    results.push(await testHealthCheck(baseUrl));

    // Test 2: Theme Fetch
    console.log('🔍 Testing Theme Fetch...');
    results.push(await testTheme(baseUrl, tenantSlug));

    // Test 3: Onboarding
    console.log('🔍 Testing Onboarding...');
    results.push(await testOnboarding(baseUrl, tenantSlug, jwtToken));

    // Test 4: Document Fetch
    console.log('🔍 Testing Document Fetch...');
    results.push(await testDocuments(baseUrl, tenantSlug, development.id));

    // Test 5: Noticeboard
    console.log('🔍 Testing Noticeboard...');
    results.push(await testNoticeboard(baseUrl, tenantSlug));

    // Test 6-10: Chat Requests (5 requests)
    for (let i = 0; i < 5; i++) {
      console.log(`🔍 Testing Chat Request ${i + 1}/5...`);
      results.push(await testChat(baseUrl, tenantSlug, development.id, jwtToken, i));
    }

    // Print results
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SMOKE TEST RESULTS\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);

    results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : '❌';
      const duration = result.durationMs.toFixed(0).padStart(6);
      console.log(`${icon} ${result.feature.padEnd(25)} ${duration}ms`);

      if (result.error) {
        console.log(`   └─ Error: ${result.error}`);
      }

      if (result.details && result.status === 'PASS') {
        const detailStr = JSON.stringify(result.details);
        if (detailStr.length < 80) {
          console.log(`   └─ ${detailStr}`);
        }
      }
    });

    console.log('\n' + '─'.repeat(60));
    console.log(`\n📈 Summary:`);
    console.log(`   Total Tests: ${results.length}`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    console.log(`   Average Duration: ${(totalDuration / results.length).toFixed(0)}ms`);

    console.log('\n' + '═'.repeat(60));

    if (failed === 0) {
      console.log('\n✅ SMOKE TEST: PASS');
      console.log('🚀 System is PILOT READY\n');
      process.exit(0);
    } else {
      console.log('\n❌ SMOKE TEST: FAIL');
      console.log(`⚠️  ${failed} test(s) failed - system needs fixes\n`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ SMOKE TEST ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run smoke test
runSmokeTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
