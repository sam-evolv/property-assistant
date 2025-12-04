import { getCanonicalRoomDimension } from '../packages/api/src/dimension-guardrail';

/**
 * Test the dimension guardrail to ensure it never fabricates numbers
 * when no actual dimension data exists in the database
 */
async function testDimensionGuardrailSafety() {
  console.log('\n' + '='.repeat(80));
  console.log('DIMENSION GUARDRAIL SAFETY TEST');
  console.log('='.repeat(80));
  console.log('\nThis test verifies that the guardrail returns NO numeric dimensions');
  console.log('when no data exists in unit_room_dimensions, intelligence_profiles, or house_types.\n');

  // Test with a non-existent house type and room
  const testCases = [
    {
      description: 'Non-existent house type',
      tenantId: '00000000-0000-0000-0000-000000000000',
      developmentId: '00000000-0000-0000-0000-000000000000',
      houseTypeCode: 'NONEXISTENT01',
      roomKey: 'living_room',
    },
    {
      description: 'Non-existent room in potentially valid house type',
      tenantId: '00000000-0000-0000-0000-000000000000',
      developmentId: '00000000-0000-0000-0000-000000000000',
      houseTypeCode: 'BD01',
      roomKey: 'nonexistent_room',
    },
  ];

  let allTestsPassed = true;

  for (const testCase of testCases) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Test: ${testCase.description}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`House Type: ${testCase.houseTypeCode}`);
    console.log(`Room: ${testCase.roomKey}\n`);

    try {
      const result = await getCanonicalRoomDimension(
        testCase.tenantId,
        testCase.developmentId,
        testCase.houseTypeCode,
        testCase.roomKey
      );

      console.log('Result:');
      console.log(`  Found: ${result.found}`);
      console.log(`  Reason: ${result.reason || 'N/A'}\n`);

      if (result.found) {
        console.log('❌ FAIL: Guardrail returned found=true when it should return false');
        console.log(`   Room data: ${JSON.stringify(result.room, null, 2)}`);
        allTestsPassed = false;
        continue;
      }

      if (!result.reason) {
        console.log('❌ FAIL: Guardrail returned no reason message');
        allTestsPassed = false;
        continue;
      }

      // Check for numeric dimensions in the reason message
      const numericPatterns = [
        /\d+\.?\d*\s*m²/i,      // matches "14.5 m²"
        /\d+\.?\d*\s*m\b/i,      // matches "3.5 m" or "3 m"
        /\d+\.?\d*\s*x\s*\d+/i,  // matches "3.5 x 4.2"
        /\d+\.?\d*\s*sqm/i,      // matches "14 sqm"
        /\d+\.?\d*\s*sq\s*m/i,   // matches "14 sq m"
        /\d+\.?\d*\s*square/i,   // matches "14 square"
      ];

      let foundNumericDimension = false;
      for (const pattern of numericPatterns) {
        if (pattern.test(result.reason)) {
          console.log(`❌ FAIL: Guardrail reason contains numeric dimension matching pattern: ${pattern}`);
          console.log(`   Reason: "${result.reason}"`);
          foundNumericDimension = true;
          allTestsPassed = false;
          break;
        }
      }

      if (!foundNumericDimension) {
        console.log('✅ PASS: Guardrail correctly returned no dimensions');
        console.log(`   Safe message: "${result.reason}"`);
      }

    } catch (error) {
      console.log(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      allTestsPassed = false;
    }
  }

  console.log('\n' + '='.repeat(80));
  if (allTestsPassed) {
    console.log('✅ ALL TESTS PASSED');
    console.log('The dimension guardrail is safe - it never fabricates numbers.');
  } else {
    console.log('❌ SOME TESTS FAILED');
    console.log('The dimension guardrail may be returning fabricated numeric dimensions.');
  }
  console.log('='.repeat(80) + '\n');

  return allTestsPassed;
}

testDimensionGuardrailSafety()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(() => process.exit(1));
