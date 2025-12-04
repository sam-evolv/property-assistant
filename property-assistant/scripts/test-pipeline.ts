import { db } from '../packages/db/client';
import { sql } from 'drizzle-orm';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function logResult(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${details}`);
}

async function testDatabaseConnection(): Promise<boolean> {
  try {
    const result = await db.execute(sql`SELECT 1 as test`);
    await logResult('Database Connection', true, 'Connected successfully');
    return true;
  } catch (error) {
    await logResult('Database Connection', false, `Failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testAnalyticsEventsTable(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM analytics_events LIMIT 1
    `);
    await logResult('Analytics Events Table', true, 'Table exists and is accessible');
    return true;
  } catch (error) {
    await logResult('Analytics Events Table', false, `Table missing or error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testDocumentProcessingLogsTable(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM document_processing_logs LIMIT 1
    `);
    await logResult('Document Processing Logs Table', true, 'Table exists and is accessible');
    return true;
  } catch (error) {
    await logResult('Document Processing Logs Table', false, `Table missing or error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testDocumentsWithChunks(): Promise<boolean> {
  try {
    const result = await db.execute<{ doc_count: string; chunk_count: string }>(sql`
      SELECT 
        COUNT(DISTINCT d.id) as doc_count,
        COUNT(c.id) as chunk_count
      FROM documents d
      LEFT JOIN doc_chunks c ON d.id = c.document_id
      WHERE d.processing_status = 'completed'
    `);
    
    const row = result.rows?.[0];
    const docCount = parseInt(row?.doc_count || '0');
    const chunkCount = parseInt(row?.chunk_count || '0');
    
    const passed = docCount > 0 && chunkCount > 0;
    await logResult('Documents with Chunks', passed, `${docCount} docs, ${chunkCount} chunks`);
    return passed;
  } catch (error) {
    await logResult('Documents with Chunks', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testEmbeddingDimensions(): Promise<boolean> {
  try {
    const result = await db.execute<{ dims: string }>(sql`
      SELECT array_length(embedding::real[], 1) as dims 
      FROM doc_chunks 
      WHERE embedding IS NOT NULL 
      LIMIT 1
    `);
    
    const row = result.rows?.[0];
    const dims = parseInt(row?.dims || '0');
    
    const passed = dims === 1536;
    await logResult('Embedding Dimensions', passed, `${dims} dimensions (expected 1536)`);
    return passed;
  } catch (error) {
    await logResult('Embedding Dimensions', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testVectorSearchIndex(): Promise<boolean> {
  try {
    const result = await db.execute<{ indexname: string }>(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'doc_chunks' 
      AND indexdef LIKE '%hnsw%'
    `);
    
    const passed = (result.rows?.length || 0) > 0;
    await logResult('HNSW Vector Index', passed, passed ? 'Index exists' : 'No HNSW index found');
    return passed;
  } catch (error) {
    await logResult('HNSW Vector Index', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testRateLimitsTable(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM rate_limits LIMIT 1
    `);
    await logResult('Rate Limits Table', true, 'Table exists and is accessible');
    return true;
  } catch (error) {
    await logResult('Rate Limits Table', false, `Table missing or error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testMessagesTable(): Promise<boolean> {
  try {
    const result = await db.execute<{ count: string }>(sql`
      SELECT COUNT(*) as count FROM messages
    `);
    
    const count = parseInt(result.rows?.[0]?.count || '0');
    await logResult('Messages Table', true, `${count} messages logged`);
    return true;
  } catch (error) {
    await logResult('Messages Table', false, `Table missing or error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testIntelligenceProfiles(): Promise<boolean> {
  try {
    const result = await db.execute<{ count: string; current_count: string }>(sql`
      SELECT 
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_current = true) as current_count
      FROM unit_intelligence_profiles
    `);
    
    const row = result.rows?.[0];
    const count = parseInt(row?.count || '0');
    const currentCount = parseInt(row?.current_count || '0');
    
    await logResult('Intelligence Profiles', true, `${count} profiles (${currentCount} current)`);
    return true;
  } catch (error) {
    await logResult('Intelligence Profiles', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testHouseTypes(): Promise<boolean> {
  try {
    const result = await db.execute<{ count: string; with_dims: string }>(sql`
      SELECT 
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE room_dimensions IS NOT NULL AND room_dimensions::text != '{}') as with_dims
      FROM house_types
    `);
    
    const row = result.rows?.[0];
    const count = parseInt(row?.count || '0');
    const withDims = parseInt(row?.with_dims || '0');
    
    const passed = count > 0;
    await logResult('House Types', passed, `${count} house types (${withDims} with room dimensions)`);
    return passed;
  } catch (error) {
    await logResult('House Types', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testUnitAssignments(): Promise<boolean> {
  try {
    const result = await db.execute<{ total: string; with_purchaser: string; with_house_type: string }>(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE purchaser_name IS NOT NULL) as with_purchaser,
        COUNT(*) FILTER (WHERE house_type_code IS NOT NULL) as with_house_type
      FROM units
    `);
    
    const row = result.rows?.[0];
    const total = parseInt(row?.total || '0');
    const withPurchaser = parseInt(row?.with_purchaser || '0');
    const withHouseType = parseInt(row?.with_house_type || '0');
    
    const passed = total > 0;
    await logResult('Unit Assignments', passed, `${total} units (${withPurchaser} with purchasers, ${withHouseType} with house types)`);
    return passed;
  } catch (error) {
    await logResult('Unit Assignments', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testFailedDocuments(): Promise<boolean> {
  try {
    const result = await db.execute<{ failed: string; pending: string }>(sql`
      SELECT 
        COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
        COUNT(*) FILTER (WHERE processing_status = 'pending') as pending
      FROM documents
    `);
    
    const row = result.rows?.[0];
    const failed = parseInt(row?.failed || '0');
    const pending = parseInt(row?.pending || '0');
    
    const passed = failed === 0;
    await logResult('Document Processing Status', passed, `${failed} failed, ${pending} pending`);
    return passed;
  } catch (error) {
    await logResult('Document Processing Status', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function testChunkMetadata(): Promise<boolean> {
  try {
    const result = await db.execute<{ with_house_type: string; with_metadata: string; total: string }>(sql`
      SELECT 
        COUNT(*) FILTER (WHERE house_type_code IS NOT NULL) as with_house_type,
        COUNT(*) FILTER (WHERE metadata IS NOT NULL AND metadata::text != '{}') as with_metadata,
        COUNT(*) as total
      FROM doc_chunks
    `);
    
    const row = result.rows?.[0];
    const withHouseType = parseInt(row?.with_house_type || '0');
    const withMetadata = parseInt(row?.with_metadata || '0');
    const total = parseInt(row?.total || '0');
    
    await logResult('Chunk Metadata', true, `${total} chunks (${withHouseType} with house type, ${withMetadata} with metadata)`);
    return true;
  } catch (error) {
    await logResult('Chunk Metadata', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

async function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 OPENHOUSE AI PIPELINE VERIFICATION TEST');
  console.log('='.repeat(80));
  console.log('');
  
  console.log('INFRASTRUCTURE TESTS:');
  console.log('-'.repeat(40));
  await testDatabaseConnection();
  await testAnalyticsEventsTable();
  await testDocumentProcessingLogsTable();
  await testRateLimitsTable();
  await testMessagesTable();
  
  console.log('\nDOCUMENT PIPELINE TESTS:');
  console.log('-'.repeat(40));
  await testDocumentsWithChunks();
  await testEmbeddingDimensions();
  await testVectorSearchIndex();
  await testChunkMetadata();
  await testFailedDocuments();
  
  console.log('\nINTELLIGENCE SYSTEM TESTS:');
  console.log('-'.repeat(40));
  await testIntelligenceProfiles();
  await testHouseTypes();
  await testUnitAssignments();
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
  
  console.log('='.repeat(80));
  console.log('');
  
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
