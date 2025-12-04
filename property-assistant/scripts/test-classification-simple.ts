#!/usr/bin/env tsx

function classifyByFilename(filename: string, documentType?: string) {
  const lowerName = filename.toLowerCase();
  const lowerType = documentType?.toLowerCase() || '';
  
  const floorplanKeywords = ['floor plan', 'floorplan', 'ground and first', 'ground floor', 'first floor', 'proposed floor', 'ff', 'gf', 'floor plans', 'site layout'];
  const hasFloorplanKeyword = floorplanKeywords.some(kw => lowerName.includes(kw));
  const hasFloorplanType = lowerType.includes('floor') || lowerType.includes('plan') || lowerType.includes('architectural');
  
  if (hasFloorplanKeyword && hasFloorplanType) return { doc_kind: 'floorplan', confidence: 0.95 };
  if (hasFloorplanKeyword || hasFloorplanType) return { doc_kind: 'floorplan', confidence: 0.75 };
  
  if (['specification', 'spec', 'technical spec', 'specs'].some(kw => lowerName.includes(kw))) {
    return { doc_kind: 'specification', confidence: 0.90 };
  }
  if (['warranty', 'guarantee'].some(kw => lowerName.includes(kw))) {
    return { doc_kind: 'warranty', confidence: 0.90 };
  }
  if (['brochure', 'sales brochure', 'marketing'].some(kw => lowerName.includes(kw))) {
    return { doc_kind: 'brochure', confidence: 0.85 };
  }
  if (['contract', 'agreement', 'legal', 'terms', 'conditions'].some(kw => lowerName.includes(kw))) {
    return { doc_kind: 'legal', confidence: 0.85 };
  }
  
  return { doc_kind: 'other', confidence: 0.30 };
}

function extractHouseTypeCodes(filename: string): string[] {
  const codes: Set<string> = new Set();
  const standardPattern = /\b(BD|BS|BT|BH|BB)\s*-?\s*(\d{2})\b/gi;
  let match;
  while ((match = standardPattern.exec(filename)) !== null) {
    codes.add(`${match[1].toUpperCase()}${match[2]}`);
  }
  return Array.from(codes);
}

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING DOCUMENT CLASSIFICATION & HOUSE-TYPE EXTRACTION');
console.log('='.repeat(80) + '\n');

const tests = [
  { filename: 'BD01 - Floor Plan - Ground and First.pdf', type: 'architectural', expectedKind: 'floorplan', expectedCodes: ['BD01'] },
  { filename: 'House Type BD-02 Floorplan.pdf', type: 'plan', expectedKind: 'floorplan', expectedCodes: ['BD02'] },
  { filename: 'Specification Sheet.pdf', type: 'document', expectedKind: 'specification', expectedCodes: [] },
  { filename: 'Warranty Certificate.pdf', type: 'document', expectedKind: 'warranty', expectedCodes: [] },
  { filename: 'Sales Brochure 2024.pdf', type: 'document', expectedKind: 'brochure', expectedCodes: [] },
  { filename: 'BS01 Type Floor Plans.pdf', type: 'architectural', expectedKind: 'floorplan', expectedCodes: ['BS01'] },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = classifyByFilename(test.filename, test.type);
  const codes = extractHouseTypeCodes(test.filename);
  
  const kindMatch = result.doc_kind === test.expectedKind;
  const codesMatch = JSON.stringify(codes.sort()) === JSON.stringify(test.expectedCodes.sort());
  
  if (kindMatch && codesMatch) {
    console.log(`✅ PASS: ${test.filename}`);
    console.log(`   Kind: ${result.doc_kind} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
    if (codes.length > 0) console.log(`   Codes: ${codes.join(', ')}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.filename}`);
    console.log(`   Expected: ${test.expectedKind} [${test.expectedCodes.join(', ')}]`);
    console.log(`   Got: ${result.doc_kind} [${codes.join(', ')}]`);
    failed++;
  }
  console.log('');
}

console.log('='.repeat(80));
console.log(`📊 RESULTS: ${passed}/${tests.length} tests passed`);
console.log('='.repeat(80) + '\n');
