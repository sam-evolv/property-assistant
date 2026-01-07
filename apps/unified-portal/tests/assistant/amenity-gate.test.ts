/**
 * Unit tests for Amenity Answering Gate and Response Validator
 */

import { classifyIntent } from '../../lib/assistant/os';
import { 
  validateAmenityResponse, 
  stripUngroundedClaims,
  getAmenityFallbackResponse,
} from '../../lib/assistant/amenities-validator';
import { getSuggestedFix } from '../../lib/assistant/gap-suggestions';
import { detectPOICategory } from '../../lib/places/poi';
import { buildMultiSourceHint } from '../../lib/assistant/amenity-augmenter';

describe('Intent Classification - Location/Amenities', () => {
  const locationQueries = [
    'nearest supermarket',
    'closest pharmacy',
    'where is the nearest grocery store',
    'what supermarkets are nearby',
    'shops near me',
    'nearest train station',
    'closest bus stop',
    'nearby GP',
    'where is the closest doctor',
    'schools near here',
    'nearest creche',
    'closest childcare',
    'local amenities',
    'what\'s around here',
    'what is close by',
    'nearest park',
    'closest gym',
    'cafes nearby',
    'restaurants near me',
    'where can i find the nearest playground',
    'leisure facilities close by',
  ];

  locationQueries.forEach(query => {
    it(`should classify "${query}" as location_amenities`, () => {
      const result = classifyIntent(query);
      expect(result.intent).toBe('location_amenities');
    });
  });

  it('should have high confidence for clear location queries', () => {
    const result = classifyIntent('nearest supermarket');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

describe('Amenity Response Validator', () => {
  describe('validateAmenityResponse', () => {
    it('should allow Google Places sourced responses', () => {
      const response = 'The nearest SuperValu is 500m away, open from 8am to 10pm';
      const result = validateAmenityResponse(response, 'google_places');
      expect(result.isValid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect ungrounded supermarket names in non-Places responses', () => {
      const response = 'There is a Dunnes Stores nearby';
      const result = validateAmenityResponse(response, 'playbook');
      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('Dunnes'))).toBe(true);
    });

    it('should detect ungrounded opening hours', () => {
      const response = 'The local shop is open from 8am to 10pm';
      const result = validateAmenityResponse(response, 'smart_archive');
      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('opening hours'))).toBe(true);
    });

    it('should detect ungrounded travel times', () => {
      const response = 'The pharmacy is a 5 minute walk away';
      const result = validateAmenityResponse(response, 'playbook');
      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('travel time'))).toBe(true);
    });

    it('should detect "just a few minutes walk" pattern', () => {
      const response = 'The supermarket is just a few minutes walk from the development';
      const result = validateAmenityResponse(response, 'smart_archive');
      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.includes('travel time'))).toBe(true);
    });

    it('should allow responses without venue names, hours, or travel times', () => {
      const response = 'There are shops and amenities in the local area. Please check Google Maps for specific locations.';
      const result = validateAmenityResponse(response, 'playbook');
      expect(result.isValid).toBe(true);
    });

    it('should allow explicitly whitelisted venue names', () => {
      const response = 'The nearest SuperValu is 500m away';
      const result = validateAmenityResponse(response, 'playbook', ['SuperValu']);
      expect(result.isValid).toBe(true);
    });
  });

  describe('stripUngroundedClaims', () => {
    it('should replace opening hours with placeholder', () => {
      const input = 'The shop is open from 8am to 10pm daily';
      const result = stripUngroundedClaims(input);
      expect(result).toContain('[opening hours may vary]');
      expect(result).not.toContain('8am to 10pm');
    });

    it('should replace travel times with placeholder', () => {
      const input = 'The supermarket is a 5 minute walk from here';
      const result = stripUngroundedClaims(input);
      expect(result).toContain('[check distance on Google Maps]');
      expect(result).not.toContain('5 minute walk');
    });
  });

  describe('getAmenityFallbackResponse', () => {
    it('should include scheme address in fallback', () => {
      const result = getAmenityFallbackResponse('123 Main Street', 'supermarket');
      expect(result).toContain('123 Main Street');
      expect(result).toContain('supermarket');
      expect(result).toContain('Google Maps');
    });

    it('should handle missing category gracefully', () => {
      const result = getAmenityFallbackResponse('Test Address');
      expect(result).toContain('amenity');
      expect(result).toContain('Test Address');
    });
  });
});

describe('Gap Suggestions - Places Failures', () => {
  it('should suggest checking API key for google_places_failed', () => {
    const suggestion = getSuggestedFix('google_places_failed', 'location_amenities');
    expect(suggestion.priority).toBe('high');
    expect(suggestion.action).toContain('API');
  });

  it('should suggest checking lat/lng for no_places_results', () => {
    const suggestion = getSuggestedFix('no_places_results', 'location_amenities');
    expect(suggestion.priority).toBe('high');
    expect(suggestion.action.toLowerCase()).toContain('lat');
  });

  it('should suggest checking Places integration for amenities_fallback_used', () => {
    const suggestion = getSuggestedFix('amenities_fallback_used', 'location_amenities');
    expect(suggestion.priority).toBe('medium');
    expect(suggestion.action).toContain('Places');
  });

  it('should suggest adding coordinates for places_no_location', () => {
    const suggestion = getSuggestedFix('places_no_location', 'location_amenities');
    expect(suggestion.priority).toBe('high');
    expect(suggestion.action).toContain('latitude');
  });
});

describe('Amenity Gate Behavior', () => {
  it('should not contain SuperValu in fallback response', () => {
    const fallback = getAmenityFallbackResponse('Longview Park');
    expect(fallback.toLowerCase()).not.toContain('supervalu');
    expect(fallback.toLowerCase()).not.toContain('dunnes');
    expect(fallback.toLowerCase()).not.toContain('tesco');
  });

  it('should not contain any opening hours in fallback response', () => {
    const fallback = getAmenityFallbackResponse('Longview Park', 'supermarket');
    expect(fallback).not.toMatch(/\d{1,2}(?::\d{2})?\s*(?:am|pm)/i);
  });

  it('should not contain any travel times in fallback response', () => {
    const fallback = getAmenityFallbackResponse('Longview Park', 'supermarket');
    expect(fallback).not.toMatch(/\d+\s*(?:minute|min)\s*walk/i);
  });
});

describe('POI Category Detection - Expanded Categories', () => {
  it('should detect park category', () => {
    expect(detectPOICategory('nearest park')).toBe('park');
  });

  it('should detect playground category', () => {
    expect(detectPOICategory('where is the closest playground')).toBe('playground');
  });

  it('should detect gym category', () => {
    expect(detectPOICategory('gyms nearby')).toBe('gym');
  });

  it('should detect cafe category', () => {
    expect(detectPOICategory('nearest cafe')).toBe('cafe');
  });

  it('should detect restaurant category', () => {
    expect(detectPOICategory('restaurants near me')).toBe('restaurant');
  });

  it('should detect leisure category', () => {
    expect(detectPOICategory('swimming pool nearby')).toBe('leisure');
  });

  it('should detect hospital category', () => {
    expect(detectPOICategory('nearest hospital')).toBe('hospital');
  });
});

describe('Multi-Source Hinting', () => {
  it('should show Places source hint when only Places used', () => {
    const hint = buildMultiSourceHint(true, new Date('2026-01-07'), false);
    expect(hint).toContain('Google Places');
    expect(hint).toContain('7 Jan 2026');
    expect(hint).not.toContain('documentation');
  });

  it('should show combined hint when docs also used', () => {
    const hint = buildMultiSourceHint(true, new Date('2026-01-07'), true);
    expect(hint).toContain('Google Places');
    expect(hint).toContain('homeowner documentation');
  });

  it('should show general guidance when Places not used', () => {
    const hint = buildMultiSourceHint(false, null, false);
    expect(hint).toBe('General guidance');
  });
});

describe('Gap Suggestions - Document Augmentation', () => {
  it('should provide low priority for doc augmentation', () => {
    const suggestion = getSuggestedFix('amenities_doc_augment_used', 'location_amenities');
    expect(suggestion.priority).toBe('low');
    expect(suggestion.action).toContain('Local Amenities');
  });
});
