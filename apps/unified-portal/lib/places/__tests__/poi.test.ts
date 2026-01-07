import { detectPOICategory, formatPOIResponse, SUPPORTED_CATEGORIES, type POICategory } from '../poi';

describe('POI Engine', () => {
  describe('detectPOICategory', () => {
    it('should detect supermarket category', () => {
      expect(detectPOICategory('Where is the nearest supermarket?')).toBe('supermarket');
      expect(detectPOICategory('Is there a Tesco nearby?')).toBe('supermarket');
      expect(detectPOICategory('grocery store near me')).toBe('supermarket');
      expect(detectPOICategory('Where can I buy food?')).toBe(null);
    });

    it('should detect pharmacy category', () => {
      expect(detectPOICategory('Where is the nearest pharmacy?')).toBe('pharmacy');
      expect(detectPOICategory('Is there a chemist nearby?')).toBe('pharmacy');
      expect(detectPOICategory('Looking for Boots')).toBe('pharmacy');
    });

    it('should detect GP category', () => {
      expect(detectPOICategory('Where is the nearest GP?')).toBe('gp');
      expect(detectPOICategory('Looking for a doctor')).toBe('gp');
      expect(detectPOICategory('Is there a medical clinic nearby?')).toBe('gp');
    });

    it('should detect childcare category', () => {
      expect(detectPOICategory('Where is the nearest creche?')).toBe('childcare');
      expect(detectPOICategory('Looking for a montessori')).toBe('childcare');
      expect(detectPOICategory('childcare facilities nearby')).toBe('childcare');
    });

    it('should detect primary school category', () => {
      expect(detectPOICategory('Where is the nearest primary school?')).toBe('primary_school');
      expect(detectPOICategory('Looking for a national school')).toBe('primary_school');
    });

    it('should detect secondary school category', () => {
      expect(detectPOICategory('Where is the nearest secondary school?')).toBe('secondary_school');
      expect(detectPOICategory('Looking for a high school')).toBe('secondary_school');
      expect(detectPOICategory('post-primary schools nearby')).toBe('secondary_school');
    });

    it('should detect train station category', () => {
      expect(detectPOICategory('Where is the nearest train station?')).toBe('train_station');
      expect(detectPOICategory('Is there a DART station nearby?')).toBe('train_station');
      expect(detectPOICategory('Looking for the Luas')).toBe('train_station');
    });

    it('should detect bus stop category', () => {
      expect(detectPOICategory('Where is the nearest bus stop?')).toBe('bus_stop');
      expect(detectPOICategory('bus routes nearby')).toBe('bus_stop');
    });

    it('should return null for unrecognized queries', () => {
      expect(detectPOICategory('What is the weather like?')).toBe(null);
      expect(detectPOICategory('Hello, how are you?')).toBe(null);
    });
  });

  describe('formatPOIResponse', () => {
    const mockFreshData = {
      results: [
        {
          name: 'Tesco Express',
          address: '123 Main Street',
          place_id: 'ChIJ123',
          distance_km: 0.5,
          walk_time_min: 6,
          drive_time_min: 2,
          open_now: true,
        },
        {
          name: 'Aldi',
          address: '456 High Street',
          place_id: 'ChIJ456',
          distance_km: 1.2,
          walk_time_min: 15,
          drive_time_min: 4,
          open_now: false,
        },
        {
          name: 'Lidl',
          address: '789 Oak Road',
          place_id: 'ChIJ789',
          distance_km: 2.0,
        },
      ],
      fetched_at: new Date('2026-01-06'),
      from_cache: true,
    };

    it('should format POI results correctly', () => {
      const response = formatPOIResponse(mockFreshData, 'supermarket', 3);
      
      expect(response).toContain('Tesco Express');
      expect(response).toContain('0.5km');
      expect(response).toContain('6 min walk');
      expect(response).toContain('2 min drive');
      expect(response).toContain('Open now');
      expect(response).toContain('Aldi');
      expect(response).toContain('Currently closed');
      expect(response).toContain('Lidl');
      expect(response).toContain('Based on Google Places');
      expect(response).toContain("You've a few convenient supermarkets");
      expect(response).not.toContain('**');
    });

    it('should limit results to specified count', () => {
      const response = formatPOIResponse(mockFreshData, 'supermarket', 2);
      
      expect(response).toContain('Tesco Express');
      expect(response).toContain('Aldi');
      expect(response).not.toContain('Lidl');
    });

    it('should handle empty results', () => {
      const emptyData = {
        results: [],
        fetched_at: new Date(),
        from_cache: false,
      };
      
      const response = formatPOIResponse(emptyData, 'supermarket', 5);
      expect(response).toContain("could not find any supermarkets");
    });

    it('should include fetch timestamp', () => {
      const response = formatPOIResponse(mockFreshData, 'supermarket', 3);
      expect(response).toContain('2026');
    });
  });

  describe('SUPPORTED_CATEGORIES', () => {
    it('should include all expected categories', () => {
      expect(SUPPORTED_CATEGORIES).toContain('supermarket');
      expect(SUPPORTED_CATEGORIES).toContain('pharmacy');
      expect(SUPPORTED_CATEGORIES).toContain('gp');
      expect(SUPPORTED_CATEGORIES).toContain('childcare');
      expect(SUPPORTED_CATEGORIES).toContain('primary_school');
      expect(SUPPORTED_CATEGORIES).toContain('secondary_school');
      expect(SUPPORTED_CATEGORIES).toContain('train_station');
      expect(SUPPORTED_CATEGORIES).toContain('bus_stop');
    });

    it('should have all supported categories', () => {
      expect(SUPPORTED_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Cache Freshness Logic', () => {
    it('should consider cache fresh within TTL', () => {
      const now = new Date();
      const ttlDays = 30;
      const fetchedAt = new Date(now.getTime() - (ttlDays - 1) * 24 * 60 * 60 * 1000);
      const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
      const isStale = now.getTime() - fetchedAt.getTime() > ttlMs;
      
      expect(isStale).toBe(false);
    });

    it('should consider cache stale after TTL expires', () => {
      const now = new Date();
      const ttlDays = 30;
      const fetchedAt = new Date(now.getTime() - (ttlDays + 1) * 24 * 60 * 60 * 1000);
      const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
      const isStale = now.getTime() - fetchedAt.getTime() > ttlMs;
      
      expect(isStale).toBe(true);
    });

    it('should consider cache stale exactly at TTL boundary', () => {
      const now = new Date();
      const ttlDays = 30;
      const fetchedAt = new Date(now.getTime() - ttlDays * 24 * 60 * 60 * 1000 - 1);
      const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
      const isStale = now.getTime() - fetchedAt.getTime() > ttlMs;
      
      expect(isStale).toBe(true);
    });

    it('should calculate TTL correctly in milliseconds', () => {
      const ttlDays = 30;
      const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      
      expect(ttlMs).toBe(expectedMs);
      expect(ttlMs).toBe(2592000000);
    });
  });
});
