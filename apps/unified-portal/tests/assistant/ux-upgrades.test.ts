/**
 * Unit Tests for UX Upgrades
 * 
 * Tests for:
 * - Source label rendering
 * - Feedback logging eligibility
 * - Confidence-weighted phrasing
 * - Gap suggestion mapping
 * - Related question suggestions
 */

declare function describe(name: string, fn: () => void): void;
declare function test(name: string, fn: () => void): void;
declare function beforeAll(fn: () => void): void;
declare function afterAll(fn: () => void): void;
declare function expect(value: any): any;

import {
  formatSourceHint,
  wrapWithConfidenceLanguage,
  getRelatedQuestions,
  sanitizeEmDashes,
  formatAssistantResponse,
  getConfidenceLevel,
  isUxEnhancementsEnabled,
  SourceType,
} from '../../lib/assistant/response-formatter';

import {
  canCaptureFeedback,
} from '../../lib/assistant/feedback-logger';

import {
  getSuggestedFix,
  enrichGapLogWithSuggestion,
} from '../../lib/assistant/gap-suggestions';

import type { GapReason } from '../../lib/assistant/gap-logger';

describe('Response Formatter - Source Transparency', () => {
  const originalEnv = process.env.ASSISTANT_UX_ENHANCEMENTS;
  
  beforeAll(() => {
    process.env.ASSISTANT_UX_ENHANCEMENTS = 'true';
  });
  
  afterAll(() => {
    process.env.ASSISTANT_UX_ENHANCEMENTS = originalEnv;
  });
  
  test('formatSourceHint returns correct label for scheme_profile', () => {
    const hint = formatSourceHint({ source: 'scheme_profile' });
    expect(hint).toBe('Based on the development information provided');
  });
  
  test('formatSourceHint returns correct label for unit_profile', () => {
    const hint = formatSourceHint({ source: 'unit_profile' });
    expect(hint).toBe("Based on your home's details");
  });
  
  test('formatSourceHint returns correct label for smart_archive', () => {
    const hint = formatSourceHint({ source: 'smart_archive' });
    expect(hint).toBe('Based on your homeowner documentation');
  });
  
  test('formatSourceHint returns correct label for playbook', () => {
    const hint = formatSourceHint({ source: 'playbook' });
    expect(hint).toBe('General guidance');
  });
  
  test('formatSourceHint includes date for google_places', () => {
    const testDate = new Date('2026-01-15');
    const hint = formatSourceHint({ 
      source: 'google_places', 
      placesLastUpdated: testDate 
    });
    expect(hint).toContain('Based on nearby amenities');
    expect(hint).toContain('Jan');
    expect(hint).toContain('2026');
  });
  
  test('formatSourceHint returns empty for escalation', () => {
    const hint = formatSourceHint({ source: 'escalation' });
    expect(hint).toBe('');
  });
  
  test('formatSourceHint returns empty for unknown', () => {
    const hint = formatSourceHint({ source: 'unknown' });
    expect(hint).toBe('');
  });
});

describe('Response Formatter - Confidence Weighted Language', () => {
  const originalEnv = process.env.ASSISTANT_UX_ENHANCEMENTS;
  
  beforeAll(() => {
    process.env.ASSISTANT_UX_ENHANCEMENTS = 'true';
  });
  
  afterAll(() => {
    process.env.ASSISTANT_UX_ENHANCEMENTS = originalEnv;
  });
  
  test('high confidence returns original content', () => {
    const content = 'The heating system uses a gas boiler.';
    const result = wrapWithConfidenceLanguage(content, { 
      source: 'smart_archive', 
      confidence: 0.9 
    });
    expect(result).toBe(content);
  });
  
  test('medium confidence adds qualification', () => {
    const content = 'The heating system uses a gas boiler.';
    const result = wrapWithConfidenceLanguage(content, { 
      source: 'smart_archive', 
      confidence: 0.6 
    });
    expect(result).toContain('Based on the information available');
  });
  
  test('low confidence adds general qualifier', () => {
    const content = 'The heating system uses a gas boiler.';
    const result = wrapWithConfidenceLanguage(content, { 
      source: 'smart_archive', 
      confidence: 0.3 
    });
    expect(result).toContain('In most developments');
  });
  
  test('getConfidenceLevel returns correct levels', () => {
    expect(getConfidenceLevel(0.9)).toBe('high');
    expect(getConfidenceLevel(0.8)).toBe('high');
    expect(getConfidenceLevel(0.6)).toBe('medium');
    expect(getConfidenceLevel(0.5)).toBe('medium');
    expect(getConfidenceLevel(0.4)).toBe('low');
    expect(getConfidenceLevel(undefined)).toBe('medium');
  });
});

describe('Response Formatter - Related Questions', () => {
  const originalEnv = process.env.ASSISTANT_UX_ENHANCEMENTS;
  
  beforeAll(() => {
    process.env.ASSISTANT_UX_ENHANCEMENTS = 'true';
  });
  
  afterAll(() => {
    process.env.ASSISTANT_UX_ENHANCEMENTS = originalEnv;
  });
  
  test('returns related questions for heating intent', () => {
    const questions = getRelatedQuestions({ 
      source: 'smart_archive', 
      intentType: 'heating' 
    });
    expect(questions.length).toBeGreaterThan(0);
    expect(questions.length).toBeLessThanOrEqual(2);
  });
  
  test('returns no questions for emergency intent', () => {
    const questions = getRelatedQuestions({ 
      source: 'smart_archive', 
      intentType: 'emergencies' 
    });
    expect(questions.length).toBe(0);
  });
  
  test('returns no questions when isEmergency is true', () => {
    const questions = getRelatedQuestions({ 
      source: 'smart_archive', 
      intentType: 'heating',
      isEmergency: true 
    });
    expect(questions.length).toBe(0);
  });
  
  test('returns no questions when isSensitive is true', () => {
    const questions = getRelatedQuestions({ 
      source: 'smart_archive', 
      intentType: 'heating',
      isSensitive: true 
    });
    expect(questions.length).toBe(0);
  });
});

describe('Response Formatter - Em Dash Sanitization', () => {
  test('sanitizes em dashes correctly', () => {
    const text = 'Contact ESB — the electricity provider — for help.';
    const result = sanitizeEmDashes(text);
    expect(result).not.toContain('—');
    expect(result).toContain('-');
  });
  
  test('sanitizes en dashes correctly', () => {
    const text = 'Pages 1–10 of the manual.';
    const result = sanitizeEmDashes(text);
    expect(result).not.toContain('–');
    expect(result).toContain('-');
  });
});

describe('Feedback Logger - Eligibility', () => {
  test('canCaptureFeedback returns true for test mode', () => {
    expect(canCaptureFeedback(true, undefined)).toBe(true);
  });
  
  test('canCaptureFeedback returns true for developer role', () => {
    expect(canCaptureFeedback(false, 'developer')).toBe(true);
  });
  
  test('canCaptureFeedback returns true for admin role', () => {
    expect(canCaptureFeedback(false, 'admin')).toBe(true);
  });
  
  test('canCaptureFeedback returns true for superadmin role', () => {
    expect(canCaptureFeedback(false, 'superadmin')).toBe(true);
  });
  
  test('canCaptureFeedback returns false for homeowner role', () => {
    expect(canCaptureFeedback(false, 'homeowner')).toBe(false);
  });
  
  test('canCaptureFeedback returns false for undefined role without test mode', () => {
    expect(canCaptureFeedback(false, undefined)).toBe(false);
  });
});

describe('Gap Suggestions', () => {
  test('missing_scheme_data suggests scheme profile fields', () => {
    const suggestion = getSuggestedFix('missing_scheme_data', 'heating');
    expect(suggestion.action).toContain('scheme profile');
    expect(suggestion.action).toContain('heating');
    expect(suggestion.priority).toBe('high');
  });
  
  test('no_documents_found suggests uploading documents', () => {
    const suggestion = getSuggestedFix('no_documents_found', 'waste');
    expect(suggestion.action).toContain('Upload');
    expect(suggestion.priority).toBe('high');
  });
  
  test('low_doc_confidence suggests re-tagging', () => {
    const suggestion = getSuggestedFix('low_doc_confidence', 'general');
    expect(suggestion.action).toContain('re-tag');
    expect(suggestion.priority).toBe('medium');
  });
  
  test('playbook_fallback suggests both data and documents', () => {
    const suggestion = getSuggestedFix('playbook_fallback', 'parking');
    expect(suggestion.action).toContain('scheme data');
    expect(suggestion.action).toContain('documents');
    expect(suggestion.priority).toBe('medium');
  });
  
  test('defer_to_developer has low priority', () => {
    const suggestion = getSuggestedFix('defer_to_developer', 'general');
    expect(suggestion.priority).toBe('low');
  });
  
  test('enrichGapLogWithSuggestion returns proper structure', () => {
    const log = {
      gap_reason: 'no_documents_found',
      intent_type: 'heating',
      attempted_sources: ['smart_archive'],
    };
    const enriched = enrichGapLogWithSuggestion(log);
    expect(enriched).toHaveProperty('suggested_fix');
    expect(enriched).toHaveProperty('fix_priority');
    expect(enriched.suggested_fix).toBeTruthy();
  });
});

describe('Feature Flag', () => {
  test('isUxEnhancementsEnabled respects env variable', () => {
    const originalEnv = process.env.ASSISTANT_UX_ENHANCEMENTS;
    
    process.env.ASSISTANT_UX_ENHANCEMENTS = 'true';
    expect(isUxEnhancementsEnabled()).toBe(true);
    
    process.env.ASSISTANT_UX_ENHANCEMENTS = 'false';
    expect(isUxEnhancementsEnabled()).toBe(false);
    
    delete process.env.ASSISTANT_UX_ENHANCEMENTS;
    expect(isUxEnhancementsEnabled()).toBe(false);
    
    process.env.ASSISTANT_UX_ENHANCEMENTS = originalEnv;
  });
});
