import assert from 'node:assert/strict';

import {
  detectAmenityHallucinations,
  shouldEnforceAmenityHallucinationGuard,
} from '../../lib/assistant/amenity-answer-validator';
import { detectPOICategoryExpanded } from '../../lib/places/poi';

assert.equal(
  detectPOICategoryExpanded('How do I service my heat pump?').category,
  null,
  'heat must not match restaurant intent',
);
assert.equal(
  detectPOICategoryExpanded('What colour is the spare room paint?').category,
  null,
  'spare must not match Spar supermarket intent',
);

for (const [question, expectedCategory] of [
  ['Where can I eat?', 'restaurant'],
  ['Where is Tesco?', 'supermarket'],
  ['Where is the pharmacy?', 'pharmacy'],
  ['What restaurants are around?', 'restaurant'],
] as const) {
  assert.equal(detectPOICategoryExpanded(question).category, expectedCategory, question);
}

for (const question of ['grimace', 'bootstrap', 'business rates', 'coffee machine warranty']) {
  assert.equal(
    detectPOICategoryExpanded(question).category,
    null,
    `home/general text must not match a POI category: ${question}`,
  );
}

const nonLocalCases = [
  {
    question: 'How do I service my heat pump?',
    answer: 'The Daikin heat pump in your home at Longview Park should be serviced annually.',
  },
  {
    question: 'What colour is the spare room paint?',
    answer: 'The spare room in your home at Longview Park is painted white.',
  },
  {
    question: 'Tell me about my home at Longview Park',
    answer: 'Your home at Longview Park has 3 bedrooms and a floor area of 110.4 m².',
  },
  {
    question: 'What is the bathroom extractor fan model?',
    answer: 'The extractor fan in your home at Longview Park is listed in the bathroom schedule.',
  },
];

for (const testCase of nonLocalCases) {
  assert.equal(
    shouldEnforceAmenityHallucinationGuard(testCase.question),
    false,
    `home question must not enable the amenity guard: ${testCase.question}`,
  );

  const detection = detectAmenityHallucinations(testCase.answer, false);
  const wouldReplace = shouldEnforceAmenityHallucinationGuard(testCase.question)
    && detection.hasHallucination;
  assert.equal(
    wouldReplace,
    false,
    `home answer must not be replaced: ${testCase.question}`,
  );
}

const localCases = [
  'Where is the nearest restaurant?',
  'Is there a park nearby?',
  'What supermarkets are nearby?',
  'Where is the closest pharmacy?',
  'What local amenities are around here?',
  'Where is Tesco?',
  'Where is the pharmacy?',
  'What restaurants are around?',
];

for (const question of localCases) {
  assert.equal(
    shouldEnforceAmenityHallucinationGuard(question),
    true,
    `local question must enable the amenity guard: ${question}`,
  );
}

assert.equal(
  shouldEnforceAmenityHallucinationGuard('Yes', 'location_amenities'),
  true,
  'a resolved affirmative local-amenity follow-up must keep the guard enabled',
);
assert.equal(
  shouldEnforceAmenityHallucinationGuard('Tell me about my home at Longview Park', 'unit_fact'),
  false,
  'a resolved home intent must not enable the amenity guard',
);

const matcherCases: Array<[string, boolean]> = [
  ['central heating', false],
  ['spare room', false],
  ['grimace', false],
  ['145 m²', false],
  ['145 m2', false],
  ['2 km away', true],
  ['Tesco is nearby', true],
  ['Centra is nearby', true],
  ['10 m away', true],
];

for (const [answer, expected] of matcherCases) {
  assert.equal(
    detectAmenityHallucinations(answer, false).hasHallucination,
    expected,
    `unexpected matcher result: ${answer}`,
  );
}

console.log('amenity hallucination guard smoke: PASS');
