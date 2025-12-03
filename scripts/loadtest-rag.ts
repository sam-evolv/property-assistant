import { db } from '@openhouse/db/client';
import { documents, developments } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * PHASE 17: RAG Load Testing
 * Tests vector search and RAG pipeline under concurrent load
 */

interface RAGTestResult {
  queryId: number;
  question: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  chunksRetrieved: number;
  success: boolean;
  error?: string;
}

const SAMPLE_QUESTIONS = [
  'Where is the main water shutoff valve?',
  'How do I reset the boiler?',
  'What is the BER rating of this house?',
  'How do I operate the heating system?',
  'Where are the fuse boxes located?',
  'What warranty is provided?',
  'How do I contact emergency maintenance?',
  'What appliances are included?',
  'How do I use the solar panels?',
  'What is the procedure for reporting issues?',
  'How do I access the attic?',
  'What type of windows are installed?',
  'How do I operate the ventilation system?',
  'What is covered under the house warranty?',
  'Where is the stopcock located?',
  'How do I program the thermostat?',
  'What are the paint colors used?',
  'How do I maintain the kitchen appliances?',
  'What is the roof warranty period?',
  'How do I operate the alarm system?',
];

async function performRAGQuery(
  developmentId: string,
  question: string,
  queryId: number
): Promise<RAGTestResult> {
  const startTime = Date.now();

  try {
    // Simulate the full RAG pipeline
    // 1. Generate embedding (simulated - would call OpenAI)
    // 2. Query vector database
    // 3. Retrieve relevant chunks

    // Note: Using dummy zero vector for load testing
    // In production, this would use actual embeddings from OpenAI
    const dummyVector = Array(1536).fill(0).join(',');
    
    const result = await db.execute<{ chunk_text: string; similarity: number }>(
      sql`
      SELECT 
        chunk_text,
        1 - (embedding <=> ('['||${dummyVector}||']')::vector) as similarity
      FROM doc_chunks
      WHERE development_id = ${developmentId}
      ORDER BY embedding <=> ('['||${dummyVector}||']')::vector
      LIMIT 5
      `
    );

    const chunks = Array.isArray(result) ? result : (result.rows || []);
    const endTime = Date.now();

    return {
      queryId,
      question,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      chunksRetrieved: chunks.length,
      success: true,
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      queryId,
      question,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      chunksRetrieved: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runConcurrentQueries(
  developmentId: string,
  concurrency: number
): Promise<RAGTestResult[]> {
  console.log(`\n🔥 Running ${concurrency} concurrent RAG queries...\n`);

  const queries: Promise<RAGTestResult>[] = [];

  for (let i = 0; i < concurrency; i++) {
    const question = SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length];
    queries.push(performRAGQuery(developmentId, question, i + 1));
  }

  const results = await Promise.all(queries);
  return results;
}

function analyzeResults(results: RAGTestResult[]): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n📊 LOAD TEST RESULTS');
  console.log('='.repeat(50));

  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    const durations = successful.map(r => r.durationMs).sort((a, b) => a - b);
    const sum = durations.reduce((acc, val) => acc + val, 0);
    const avg = sum / durations.length;
    const p50 = durations[Math.floor(durations.length * 0.5)];
    const p95 = durations[Math.floor(durations.length * 0.95)];
    const p99 = durations[Math.floor(durations.length * 0.99)];
    const min = durations[0];
    const max = durations[durations.length - 1];

    console.log('\n⏱️  Response Times:');
    console.log(`   Min:     ${min}ms`);
    console.log(`   Average: ${Math.round(avg)}ms`);
    console.log(`   p50:     ${p50}ms`);
    console.log(`   p95:     ${p95}ms`);
    console.log(`   p99:     ${p99}ms`);
    console.log(`   Max:     ${max}ms`);

    const avgChunks = successful.reduce((acc, r) => acc + r.chunksRetrieved, 0) / successful.length;
    console.log(`\n📄 Average chunks retrieved: ${avgChunks.toFixed(1)}`);

    // Identify slow queries (>1s)
    const slowQueries = successful.filter(r => r.durationMs > 1000);
    if (slowQueries.length > 0) {
      console.log(`\n⚠️  Slow queries (>1s): ${slowQueries.length}`);
      slowQueries.slice(0, 5).forEach(q => {
        console.log(`   - Query ${q.queryId}: ${q.durationMs}ms - "${q.question.substring(0, 50)}..."`);
      });
    }
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Queries:');
    failed.slice(0, 10).forEach(f => {
      console.log(`   - Query ${f.queryId}: ${f.error}`);
    });
  }

  console.log('\n' + '='.repeat(50));
}

async function main() {
  console.log('🎯 PHASE 17: RAG Load Testing');
  console.log('='.repeat(50));

  // Find Longview Park development
  const development = await db.query.developments.findFirst({
    where: eq(developments.name, 'Longview Park'),
    with: {
      documents: true,
    },
  });

  if (!development) {
    console.error('\n❌ Error: Longview Park development not found');
    console.log('💡 Run: npm run seed:longview first');
    process.exit(1);
  }

  console.log(`\n✓ Testing development: ${development.name}`);
  console.log(`  ID: ${development.id}`);
  console.log(`  Documents: ${development.documents?.length || 0}`);

  if (!development.documents || development.documents.length === 0) {
    console.warn('\n⚠️  Warning: No documents found');
    console.log('Upload documents via Developer Portal before testing');
  }

  // Test different concurrency levels
  const concurrencyLevels = [1, 5, 10, 20, 50];

  for (const concurrency of concurrencyLevels) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`Testing with concurrency: ${concurrency}`);
    console.log('─'.repeat(50));

    const results = await runConcurrentQueries(development.id, concurrency);
    analyzeResults(results);

    // Wait a bit between tests
    if (concurrency < concurrencyLevels[concurrencyLevels.length - 1]) {
      console.log('\n⏸️  Cooling down for 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n\n✅ LOAD TESTING COMPLETE');
  console.log('\n📋 Recommendations:');
  console.log('   1. If p95 > 500ms, consider adding indexes');
  console.log('   2. If p99 > 1000ms, investigate slow queries');
  console.log('   3. If failures > 5%, check connection pool limits');
  console.log('   4. Monitor database CPU and memory during peak load');

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Load test failed:', error);
  process.exit(1);
});
