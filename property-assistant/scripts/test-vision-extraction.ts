import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { trainFromFile } from '../packages/api/src/train';
import { getCanonicalRoomDimension } from '../packages/api/src/dimension-guardrail';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL', message: string, details?: any) {
  results.push({ test, status, message, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${test}: ${message}`);
  if (details) {
    console.log(`   Details:`, JSON.stringify(details, null, 2));
  }
}

async function cleanupTestData(tenantId: string, developmentId: string) {
  console.log('\n🧹 Cleaning up test data...');
  await db.execute(sql`DELETE FROM unit_room_dimensions WHERE tenant_id = ${tenantId}::uuid`);
  await db.execute(sql`DELETE FROM doc_chunks WHERE tenant_id = ${tenantId}::uuid`);
  await db.execute(sql`DELETE FROM documents WHERE tenant_id = ${tenantId}::uuid`);
  await db.execute(sql`DELETE FROM training_jobs WHERE tenant_id = ${tenantId}::uuid`);
  console.log('✅ Cleanup complete\n');
}

async function testVisionExtractionFlow() {
  console.log('\n' + '='.repeat(80));
  console.log('VISION EXTRACTION END-TO-END TEST');
  console.log('='.repeat(80) + '\n');

  const tenantId = '01940469-9acb-720a-a17c-f086547509bb';
  const developmentId = '01940469-d9ed-7e70-850f-cb53cd00ffcd';
  const houseTypeCode = 'B1';

  await cleanupTestData(tenantId, developmentId);

  console.log('TEST 1: Create house type and unit for testing');
  console.log('-'.repeat(80));
  try {
    await db.execute(sql`
      INSERT INTO house_types (
        id, tenant_id, development_id, house_type_code, name,
        total_floor_area_sqm, room_dimensions
      )
      VALUES (
        gen_random_uuid(), ${tenantId}::uuid, ${developmentId}::uuid, ${houseTypeCode}, 'Test Type B1',
        100.0, '{}'::jsonb
      )
      ON CONFLICT (development_id, house_type_code) DO NOTHING
    `);

    await db.execute(sql`
      INSERT INTO units (
        id, tenant_id, development_id, house_type_code, address,
        block_name, unit_number, status
      )
      VALUES (
        gen_random_uuid(), ${tenantId}::uuid, ${developmentId}::uuid, ${houseTypeCode},
        '123 Test Street', 'Block A', '101', 'available'
      )
      ON CONFLICT (development_id, block_name, unit_number) DO NOTHING
    `);

    logResult('Setup', 'PASS', 'House type and unit created successfully');
  } catch (error) {
    logResult('Setup', 'FAIL', 'Failed to create test data', { error: error instanceof Error ? error.message : 'Unknown' });
    return;
  }

  console.log('\nTEST 2: Check if sample floorplan exists');
  console.log('-'.repeat(80));
  const sampleFloorplanPath = path.join(process.cwd(), 'test-data', 'sample-floorplan-B1.pdf');
  
  if (!fs.existsSync(sampleFloorplanPath)) {
    logResult('Floorplan Check', 'FAIL', `Sample floorplan not found at ${sampleFloorplanPath}. Please create a test PDF.`);
    console.log('\n⚠️  To run this test, create a sample floorplan PDF at:');
    console.log(`   ${sampleFloorplanPath}`);
    console.log('   Or update the path to point to an existing floorplan PDF.');
    return;
  }

  const floorplanBuffer = fs.readFileSync(sampleFloorplanPath);
  logResult('Floorplan Check', 'PASS', `Found sample floorplan (${floorplanBuffer.length} bytes)`);

  console.log('\nTEST 3: Run Vision extraction via training pipeline');
  console.log('-'.repeat(80));
  try {
    const trainResult = await trainFromFile(
      floorplanBuffer,
      'B1-floorplan.pdf',
      tenantId,
      developmentId
    );

    if (trainResult.success) {
      logResult('Training Pipeline', 'PASS', 'Document training completed successfully', {
        documentId: trainResult.documentId,
        chunksCreated: trainResult.chunksCreated,
      });
    } else {
      logResult('Training Pipeline', 'FAIL', trainResult.error || 'Unknown error');
      return;
    }

    console.log('\nTEST 4: Verify unit_room_dimensions table populated');
    console.log('-'.repeat(80));
    const dimensionsResult = await db.execute<{
      room_name: string;
      area_m2: number;
      length_m: number;
      width_m: number;
      confidence: number;
    }>(sql`
      SELECT room_name, area_m2, length_m, width_m, confidence
      FROM unit_room_dimensions
      WHERE tenant_id = ${tenantId}::uuid
        AND unit_type_code = ${houseTypeCode}
      ORDER BY room_name
    `);

    if (dimensionsResult.rows && dimensionsResult.rows.length > 0) {
      logResult('Vision Data Storage', 'PASS', `Extracted ${dimensionsResult.rows.length} rooms from floorplan`, {
        rooms: dimensionsResult.rows,
      });
    } else {
      logResult('Vision Data Storage', 'FAIL', 'No room dimensions found in database');
      return;
    }

    console.log('\nTEST 5: Test dimension lookup through guardrail');
    console.log('-'.repeat(80));
    
    const testRooms = ['living_room', 'kitchen', 'bedroom_1', 'bedroom_2'];
    for (const roomKey of testRooms) {
      const lookupResult = await getCanonicalRoomDimension(
        tenantId,
        developmentId,
        houseTypeCode,
        roomKey
      );

      if (lookupResult.found && lookupResult.room) {
        logResult(`Dimension Lookup [${roomKey}]`, 'PASS', `Found dimensions via ${lookupResult.room.source}`, {
          area: lookupResult.room.area_m2,
          dimensions: lookupResult.room.length_m && lookupResult.room.width_m 
            ? `${lookupResult.room.length_m}m × ${lookupResult.room.width_m}m`
            : 'N/A',
          confidence: lookupResult.room.extraction_confidence,
        });

        if (lookupResult.room.source !== 'vision_floorplan') {
          logResult(`Source Priority [${roomKey}]`, 'FAIL', 'Expected vision_floorplan as source but got ' + lookupResult.room.source);
        } else {
          logResult(`Source Priority [${roomKey}]`, 'PASS', 'Correctly prioritized Vision-extracted data');
        }
      } else {
        logResult(`Dimension Lookup [${roomKey}]`, 'FAIL', 'Room not found in dimension guardrail');
      }
    }

  } catch (error) {
    logResult('Vision Extraction', 'FAIL', 'Error during Vision extraction', {
      error: error instanceof Error ? error.message : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const totalCount = results.length;
  
  console.log(`\nTotal Tests: ${totalCount}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / totalCount) * 100).toFixed(1)}%\n`);

  if (failCount > 0) {
    console.log('Failed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.test}: ${r.message}`);
    });
  }

  await cleanupTestData(tenantId, developmentId);
}

testVisionExtractionFlow()
  .then(() => {
    console.log('\n✅ Test script completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
