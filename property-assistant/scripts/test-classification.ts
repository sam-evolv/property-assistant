#!/usr/bin/env tsx
import { classifyByFilename } from '../packages/api/src';
import { extractHouseTypeCodes } from '../packages/api/src';

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING DOCUMENT CLASSIFICATION & HOUSE-TYPE EXTRACTION');
console.log('='.repeat(80) + '\n');

const testCases = [
  {
    filename: 'BD01 - Floor Plan - Ground and First.pdf',
    type: 'architectural',
    expectedKind: 'floorplan',
    expectedCodes: ['BD01'],
  },
  {
    filename: 'House Type BD-02 Floorplan.pdf',
    type: 'plan',
    expectedKind: 'floorplan',
    expectedCodes: ['BD02'],
  },
  {
    filename: 'Specification Sheet.pdf',
    type: 'document',
    expectedKind: 'specification',
    expectedCodes: [],
  },
  {
    filename: 'Warranty Certificate.pdf',
    type: 'document',
    expectedKind: 'warranty',
    expectedCodes: [],
  },
  {
    filename: 'Sales Brochure 2024.pdf',
    type: 'document',
    expectedKind: 'brochure',
    expectedCodes: [],
  },
  {
    filename: 'Purchase Contract.pdf',
    type: 'legal',
    expectedKind: 'legal',
    expectedCodes: [],
  },
  {
    filename: 'Unknown Document.pdf',
    type: 'document',
    expectedKind: 'other',
    expectedCodes: [],
  },
  {
    filename: 'BS01 Type Floor Plans.pdf',
    type: 'architectural',
    expectedKind: 'floorplan',
    expectedCodes: ['BS01'],
  },
];

console.log('📋 CLASSIFICATION TESTS:\n');

let passed = 0;
let failed = 0;

for (const test of testCases) {
  const result = classifyByFilename(test.filename, test.type);
  const codes = extractHouseTypeCodes(test.filename);
  
  const kindMatch = result.doc_kind === test.expectedKind;
  const codesMatch = JSON.stringify(codes.sort()) === JSON.stringify(test.expectedCodes.sort());
  
  if (kindMatch && codesMatch) {
    console.log(`✅ PASS: ${test.filename}`);
    console.log(`   Kind: ${result.doc_kind} (confidence: ${(result.mapping_confidence * 100).toFixed(0)}%)`);
    if (codes.length > 0) {
      console.log(`   Codes: ${codes.join(', ')}`);
    }
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.filename}`);
    console.log(`   Expected kind: ${test.expectedKind}, got: ${result.doc_kind}`);
    console.log(`   Expected codes: ${test.expectedCodes.join(', ')}, got: ${codes.join(', ')}`);
    failed++;
  }
  console.log('');
}

console.log('='.repeat(80));
console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(80) + '\n');

process.exit(failed > 0 ? 1 : 0);
