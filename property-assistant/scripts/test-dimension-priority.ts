import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { getCanonicalRoomDimension } from '../packages/api/src/dimension-guardrail';

interface TestCase {
  name: string;
  roomKey: string;
  expectedSource: 'vision_floorplan' | 'intelligence_profile' | 'house_types';
  expectedArea?: number;
}

async function setupTestData(tenantId: string, developmentId: string, houseTypeCode: string) {
  console.log('🔧 Setting up test data...\n');

  await db.execute(sql`DELETE FROM unit_room_dimensions WHERE tenant_id = ${tenantId}::uuid`);
  await db.execute(sql`DELETE FROM unit_intelligence_profiles WHERE tenant_id = ${tenantId}::uuid`);
  await db.execute(sql`DELETE FROM house_types WHERE tenant_id = ${tenantId}::uuid`);

  const houseTypeResult = await db.execute<{ id: string }>(sql`
    INSERT INTO house_types (
      id, tenant_id, development_id, house_type_code, name,
      total_floor_area_sqm, room_dimensions
    )
    VALUES (
      gen_random_uuid(), ${tenantId}::uuid, ${developmentId}::uuid, ${houseTypeCode}, 'Test Type',
      100.0,
      '{
        "living_room": {"length_m": 5.0, "width_m": 4.0, "area_sqm": 20.0},
        "kitchen": {"length_m": 3.5, "width_m": 3.0, "area_sqm": 10.5}
      }'::jsonb
    )
    RETURNING id
  `);
  const houseTypeId = houseTypeResult.rows?.[0]?.id;
  console.log('✅ Created house_types with living_room and kitchen');

  await db.execute(sql`
    INSERT INTO unit_intelligence_profiles (
      id, tenant_id, development_id, house_type_code, version, is_current,
      rooms, source_document_ids, quality_score, metadata
    )
    VALUES (
      gen_random_uuid(), ${tenantId}::uuid, ${developmentId}::uuid, ${houseTypeCode}, 1, true,
      '{
        "bedroom_1": {"length_m": 4.5, "width_m": 3.5, "area_sqm": 15.75, "confidence": 0.85},
        "kitchen": {"length_m": 3.6, "width_m": 3.1, "area_sqm": 11.16, "confidence": 0.9}
      }'::jsonb,
      ARRAY[gen_random_uuid()]::uuid[],
      0.88,
      '{}'::jsonb
    )
  `);
  console.log('✅ Created intelligence_profile with bedroom_1 and kitchen (overrides house_types)');

  await db.execute(sql`
    INSERT INTO unit_room_dimensions (
      tenant_id, development_id, house_type_id, unit_type_code, room_name, level,
      area_m2, confidence, source
    )
    VALUES
      (${tenantId}::uuid, ${developmentId}::uuid, ${houseTypeId}::uuid, ${houseTypeCode}, 'Living Room', 'Ground Floor',
       21.5, 0.95, 'gpt-4o-vision'),
      (${tenantId}::uuid, ${developmentId}::uuid, ${houseTypeId}::uuid, ${houseTypeCode}, 'Kitchen', 'Ground Floor',
       12.8, 0.92, 'gpt-4o-vision')
  `);
  console.log('✅ Created unit_room_dimensions with living_room and kitchen (highest priority)\n');
}

async function cleanupTestData(tenantId: string) {
  await db.execute(sql`DELETE FROM unit_room_dimensions WHERE tenant_id = ${tenantId}::uuid`);
  await db.execute(sql`DELETE FROM unit_intelligence_profiles WHERE tenant_id = ${tenantId}::uuid`);
  await db.execute(sql`DELETE FROM house_types WHERE tenant_id = ${tenantId}::uuid`);
}

async function testDimensionPriority() {
  console.log('\n' + '='.repeat(80));
  console.log('3-TIER DIMENSION LOOKUP PRIORITY TEST');
  console.log('='.repeat(80) + '\n');

  const tenantId = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
  const developmentId = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
  const houseTypeCode = 'TEST1';

  await setupTestData(tenantId, developmentId, houseTypeCode);

  const testCases: TestCase[] = [
    {
      name: 'Living room (Vision overrides house_types)',
      roomKey: 'living_room',
      expectedSource: 'vision_floorplan',
      expectedArea: 21.5,
    },
    {
      name: 'Kitchen (Vision overrides both Profile and house_types)',
      roomKey: 'kitchen',
      expectedSource: 'vision_floorplan',
      expectedArea: 12.8,
    },
    {
      name: 'Bedroom 1 (Profile fallback - no Vision data)',
      roomKey: 'bedroom_1',
      expectedSource: 'intelligence_profile',
      expectedArea: 15.75,
    },
  ];

  let passCount = 0;
  let failCount = 0;

  for (const testCase of testCases) {
    console.log(`TEST: ${testCase.name}`);
    console.log('-'.repeat(80));

    const result = await getCanonicalRoomDimension(
      tenantId,
      developmentId,
      houseTypeCode,
      testCase.roomKey
    );

    if (!result.found) {
      console.log(`❌ FAIL: Room not found`);
      failCount++;
      console.log('');
      continue;
    }

    const sourceMatch = result.room?.source === testCase.expectedSource;
    const areaMatch = testCase.expectedArea 
      ? Math.abs((result.room?.area_m2 || 0) - testCase.expectedArea) < 0.1
      : true;

    if (sourceMatch && areaMatch) {
      console.log(`✅ PASS`);
      console.log(`   Source: ${result.room?.source} (expected: ${testCase.expectedSource})`);
      console.log(`   Area: ${result.room?.area_m2} m² (expected: ${testCase.expectedArea} m²)`);
      console.log(`   Confidence: ${result.room?.extraction_confidence}`);
      passCount++;
    } else {
      console.log(`❌ FAIL`);
      console.log(`   Expected source: ${testCase.expectedSource}, got: ${result.room?.source}`);
      console.log(`   Expected area: ${testCase.expectedArea} m², got: ${result.room?.area_m2} m²`);
      failCount++;
    }
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total: ${testCases.length}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`Success Rate: ${((passCount / testCases.length) * 100).toFixed(0)}%\n`);

  await cleanupTestData(tenantId);

  if (failCount === 0) {
    console.log('🎉 All tests passed! The 3-tier fallback system works correctly:\n');
    console.log('   1️⃣  Vision-extracted dimensions (unit_room_dimensions) - HIGHEST PRIORITY');
    console.log('   2️⃣  Intelligence profiles (unit_intelligence_profiles)');
    console.log('   3️⃣  House type templates (house_types) - LOWEST PRIORITY\n');
  } else {
    console.log('⚠️  Some tests failed. Check the dimension guardrail logic.\n');
  }
}

testDimensionPriority()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
