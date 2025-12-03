#!/usr/bin/env tsx

function classifyByFilename(filename: string, documentType?: string) {
  const lowerName = filename.toLowerCase();
  const lowerType = documentType?.toLowerCase() || '';
  
  const floorplanKeywords = ['floor plan', 'floorplan', 'ground and first', 'ground floor', 'first floor', 'proposed floor', 'floor plans', 'site layout', 'floor layout'];
  const hasFloorplanKeyword = floorplanKeywords.some(kw => lowerName.includes(kw));
  const hasFloorplanType = lowerType.includes('floor') || lowerType.includes('plan') || lowerType.includes('architectural');
  
  if (hasFloorplanKeyword && hasFloorplanType) return { doc_kind: 'floorplan', confidence: 0.95 };
  if (hasFloorplanKeyword || hasFloorplanType) return { doc_kind: 'floorplan', confidence: 0.75 };
  
  const specKeywords = ['specification', 'specifications', 'technical spec', 'spec sheet', 'product spec'];
  if (specKeywords.some(kw => lowerName.includes(kw))) {
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

console.log('\n' + '='.repeat(80));
console.log('🧪 COMPREHENSIVE CLASSIFICATION TESTS (Including False Positive Prevention)');
console.log('='.repeat(80) + '\n');

const tests = [
  // True positives - should classify as floorplan
  { filename: 'BD01 - Floor Plan - Ground and First.pdf', type: 'architectural', expectedKind: 'floorplan' },
  { filename: 'House Type BD-02 Floorplan.pdf', type: 'plan', expectedKind: 'floorplan' },
  { filename: 'BS01 Type Floor Plans.pdf', type: 'architectural', expectedKind: 'floorplan' },
  { filename: 'Ground Floor Layout.pdf', type: 'architectural', expectedKind: 'floorplan' },
  
  // False positive prevention - should NOT classify as floorplan
  { filename: 'Traffic Report.pdf', type: 'document', expectedKind: 'other' },
  { filename: 'Special Offer 2024.pdf', type: 'document', expectedKind: 'other' },
  { filename: 'Staff Directory.pdf', type: 'document', expectedKind: 'other' },
  { filename: 'Coffee Shop Menu.pdf', type: 'document', expectedKind: 'other' },
  
  // Other document types
  { filename: 'Specification Sheet.pdf', type: 'document', expectedKind: 'specification' },
  { filename: 'Technical Specifications.pdf', type: 'document', expectedKind: 'specification' },
  { filename: 'Warranty Certificate.pdf', type: 'document', expectedKind: 'warranty' },
  { filename: 'Sales Brochure 2024.pdf', type: 'document', expectedKind: 'brochure' },
  { filename: 'Purchase Agreement.pdf', type: 'legal', expectedKind: 'legal' },
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  const result = classifyByFilename(test.filename, test.type);
  
  const kindMatch = result.doc_kind === test.expectedKind;
  
  if (kindMatch) {
    console.log(`✅ PASS: ${test.filename}`);
    console.log(`   Expected: ${test.expectedKind}, Got: ${result.doc_kind} (${(result.confidence * 100).toFixed(0)}%)`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.filename}`);
    console.log(`   Expected: ${test.expectedKind}, Got: ${result.doc_kind} (${(result.confidence * 100).toFixed(0)}%)`);
    failed++;
  }
  console.log('');
}

console.log('='.repeat(80));
console.log(`📊 RESULTS: ${passed}/${tests.length} tests passed`);
if (failed === 0) {
  console.log('✅ All tests passed! No false positives detected.');
} else {
  console.log(`❌ ${failed} test(s) failed`);
}
console.log('='.repeat(80) + '\n');

process.exit(failed > 0 ? 1 : 0);
