import { db, poi_cache, scheme_profile, developments } from '@openhouse/db';
import { eq, and, sql } from 'drizzle-orm';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface POIResult {
  name: string;
  address: string;
  place_id: string;
  distance_km: number;
  walk_time_min?: number;
  drive_time_min?: number;
  open_now?: boolean;
  rating?: number;
}

export interface POICacheResult {
  results: POIResult[];
  fetched_at: Date;
  from_cache: boolean;
  is_stale?: boolean;
  diagnostics?: PlacesDiagnostics;
}

export interface PlacesDiagnostics {
  scheme_id: string;
  scheme_lat?: number | null;
  scheme_lng?: number | null;
  scheme_address?: string | null;
  scheme_location_source?: 'scheme_profile' | 'developments' | 'geocoded' | null;
  scheme_location_present: boolean;
  category: string;
  cache_hit: boolean;
  is_stale_cache: boolean;
  places_request_url?: string;
  places_http_status?: number;
  places_error_message?: string;
  places_api_error_code?: PlacesErrorCode;
  failure_reason?: PlacesFailureReason;
  timestamp: string;
}

export type PlacesErrorCode = 
  | 'OK'
  | 'ZERO_RESULTS'
  | 'REQUEST_DENIED'
  | 'OVER_QUERY_LIMIT'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT';

export type PlacesFailureReason =
  | 'google_places_request_denied'
  | 'google_places_rate_limited'
  | 'google_places_invalid_coordinates'
  | 'google_places_network_error'
  | 'google_places_failed'
  | 'no_places_results'
  | 'places_no_location'
  | 'missing_location'
  | 'invalid_coordinates';

export function isLocationMissingReason(reason: PlacesFailureReason | undefined): boolean {
  return reason === 'places_no_location' || 
         reason === 'missing_location' || 
         reason === 'invalid_coordinates' ||
         reason === 'google_places_invalid_coordinates';
}

export function sortByQuality(results: POIResult[]): POIResult[] {
  return [...results].sort((a, b) => {
    if (a.walk_time_min !== undefined && b.walk_time_min !== undefined) {
      return a.walk_time_min - b.walk_time_min;
    }
    if (a.walk_time_min !== undefined) return -1;
    if (b.walk_time_min !== undefined) return 1;
    
    if (a.drive_time_min !== undefined && b.drive_time_min !== undefined) {
      return a.drive_time_min - b.drive_time_min;
    }
    if (a.drive_time_min !== undefined) return -1;
    if (b.drive_time_min !== undefined) return 1;
    
    if (a.rating !== undefined && b.rating !== undefined) {
      return b.rating - a.rating;
    }
    if (a.rating !== undefined) return -1;
    if (b.rating !== undefined) return 1;
    
    return a.distance_km - b.distance_km;
  });
}

const LOCAL_AMENITIES_MAX_PER_CATEGORY = 3;
const LOCAL_AMENITIES_MAX_TOTAL = 12;
const LOCAL_AMENITIES_MIN_PER_CATEGORY = 2;

export interface DedupeWithFillResult {
  supermarket: POIResult[];
  pharmacy: POIResult[];
  gp: POIResult[];
  transport: POIResult[];
  cafe: POIResult[];
  seenPlaceIds: Set<string>;
}

export function dedupeAndFillAmenities(
  categoryResults: Record<string, POIResult[]>,
  debug: boolean = false
): DedupeWithFillResult {
  const rawCandidates: Record<string, POIResult[]> = {
    supermarket: sortByQuality([...(categoryResults['supermarket'] || [])]),
    pharmacy: sortByQuality([...(categoryResults['pharmacy'] || [])]),
    gp: sortByQuality([...(categoryResults['gp'] || [])]),
    transport: sortByQuality([...(categoryResults['bus_stop'] || [])]),
    cafe: sortByQuality([...(categoryResults['cafe'] || [])]),
  };
  
  const seenPlaceIds = new Set<string>();
  const deduped: Record<string, POIResult[]> = {
    supermarket: [],
    pharmacy: [],
    gp: [],
    transport: [],
    cafe: [],
  };
  
  const categoryOrder = ['supermarket', 'pharmacy', 'gp', 'transport', 'cafe'];
  
  const sortedByScarcity = [...categoryOrder].sort((a, b) => 
    rawCandidates[a].length - rawCandidates[b].length
  );
  
  for (const cat of sortedByScarcity) {
    let added = 0;
    for (const item of rawCandidates[cat]) {
      if (!seenPlaceIds.has(item.place_id)) {
        seenPlaceIds.add(item.place_id);
        deduped[cat].push(item);
        added++;
        if (added >= LOCAL_AMENITIES_MIN_PER_CATEGORY) break;
      }
    }
  }
  
  if (debug) {
    console.log('[POI] Dedupe - after min reservation:', {
      supermarket: deduped.supermarket.length,
      pharmacy: deduped.pharmacy.length,
      gp: deduped.gp.length,
      transport: deduped.transport.length,
      cafe: deduped.cafe.length,
    });
  }
  
  for (const cat of categoryOrder) {
    for (const item of rawCandidates[cat]) {
      if (!seenPlaceIds.has(item.place_id)) {
        seenPlaceIds.add(item.place_id);
        deduped[cat].push(item);
      }
    }
  }
  
  if (debug) {
    console.log('[POI] Dedupe - final counts:', {
      supermarket: deduped.supermarket.length,
      pharmacy: deduped.pharmacy.length,
      gp: deduped.gp.length,
      transport: deduped.transport.length,
      cafe: deduped.cafe.length,
    });
  }
  
  return {
    supermarket: deduped.supermarket,
    pharmacy: deduped.pharmacy,
    gp: deduped.gp,
    transport: deduped.transport,
    cafe: deduped.cafe,
    seenPlaceIds,
  };
}

export type POICategory = 
  | 'supermarket'
  | 'pharmacy'
  | 'gp'
  | 'hospital'
  | 'childcare'
  | 'primary_school'
  | 'secondary_school'
  | 'train_station'
  | 'bus_stop'
  | 'park'
  | 'playground'
  | 'gym'
  | 'leisure'
  | 'cafe'
  | 'restaurant'
  | 'sports'
  | 'bar'
  | 'convenience_store'
  | 'golf_course'
  | 'cinema';

const CATEGORY_MAPPINGS: Record<POICategory, { types: string[]; keywords?: string[] }> = {
  supermarket: { types: ['supermarket', 'grocery_or_supermarket', 'grocery_store', 'department_store'] },
  pharmacy: { types: ['pharmacy'] },
  gp: { types: ['doctor'] },
  hospital: { types: ['hospital'] },
  childcare: { types: ['school'], keywords: ['creche', 'montessori', 'preschool', 'daycare', 'childcare', 'nursery'] },
  primary_school: { types: ['primary_school', 'school'], keywords: ['primary', 'national school', 'n.s.', 'ns'] },
  secondary_school: { types: ['secondary_school', 'school'], keywords: ['secondary', 'college', 'post-primary', 'high school'] },
  train_station: { types: ['train_station'] },
  bus_stop: { types: ['bus_station', 'transit_station'] },
  park: { types: ['park'] },
  playground: { types: ['park'], keywords: ['playground', 'play area', 'play ground'] },
  gym: { types: ['gym'] },
  leisure: { types: ['gym', 'spa', 'bowling_alley', 'movie_theater'] },
  cafe: { types: ['cafe'] },
  restaurant: { types: ['restaurant'] },
  sports: { types: ['stadium', 'gym'], keywords: ['sports', 'fitness', 'athletic', 'swimming', 'pool'] },
  bar: { types: ['bar', 'night_club'] },
  convenience_store: { types: ['convenience_store'] },
  golf_course: { types: ['golf_course'] },
  cinema: { types: ['movie_theater'] },
};

const DEFAULT_TTL_DAYS = 30;
const MAX_RESULTS = 10;
const PLACES_TIMEOUT_MS = 10000;

const ESCALATION_RADII = [2000, 4000, 7000] as const;
const MIN_RESULTS_THRESHOLD = 2;

// Cache version - bump this when making breaking changes to type filtering logic
// Any cached results with older versions will be considered stale
const POI_CACHE_VERSION = 2; // v2: Added type filtering to prevent mismatched results (hotels for golf, etc)

function getGoogleMapsApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || null;
}

function isApiKeyConfigured(): boolean {
  return getGoogleMapsApiKey() !== null;
}

function maskApiKeyInUrl(url: string): string {
  return url.replace(/key=[^&]+/, 'key=***REDACTED***');
}

function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function mapGoogleStatusToFailureReason(status: string): PlacesFailureReason {
  switch (status) {
    case 'REQUEST_DENIED':
      return 'google_places_request_denied';
    case 'OVER_QUERY_LIMIT':
      return 'google_places_rate_limited';
    case 'INVALID_REQUEST':
      return 'google_places_invalid_coordinates';
    default:
      return 'google_places_failed';
  }
}

export interface SchemeLocationResult {
  lat: number;
  lng: number;
  address?: string;
  source: 'scheme_profile' | 'developments' | 'geocoded';
  schemeProfileId?: string;
}

async function getSchemeLocation(supabaseProjectId: string): Promise<SchemeLocationResult | null> {
  console.log('[POI] Looking up location for supabaseProjectId:', supabaseProjectId);
  
  // SINGLE SOURCE OF TRUTH: scheme_profile is the authoritative source for amenity locations
  // This ensures deterministic, scheme-scoped resolution
  const schemes = await db
    .select({ 
      id: scheme_profile.id,
      lat: scheme_profile.scheme_lat, 
      lng: scheme_profile.scheme_lng,
      address: scheme_profile.scheme_address,
    })
    .from(scheme_profile)
    .where(eq(scheme_profile.id, supabaseProjectId))
    .limit(1);

  if (schemes.length > 0 && schemes[0].lat && schemes[0].lng) {
    console.log('[POI] Found location in scheme_profile:', {
      id: schemes[0].id,
      lat: schemes[0].lat,
      lng: schemes[0].lng,
      address: schemes[0].address,
    });
    return {
      lat: schemes[0].lat,
      lng: schemes[0].lng,
      address: schemes[0].address || undefined,
      source: 'scheme_profile',
      schemeProfileId: schemes[0].id,
    };
  }

  console.log('[POI] No location found in scheme_profile for:', supabaseProjectId);
  return null;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) return null;
    
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', address);
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'OK' && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
  } catch (err) {
    console.error('[POI] Geocoding failed:', err);
  }
  return null;
}

interface CacheEntry {
  results: POIResult[];
  fetched_at: Date;
  is_fresh: boolean;
}

// Validation keywords to detect cached results that don't match expected types
// If a category has validation keywords, at least one result should contain one of them
const CACHE_VALIDATION_KEYWORDS: Partial<Record<POICategory, string[]>> = {
  golf_course: ['golf', 'links', 'club'],
  pharmacy: ['pharmacy', 'chemist', 'boots', 'lloyds'],
  supermarket: ['tesco', 'aldi', 'lidl', 'dunnes', 'supervalu', 'spar', 'centra', 'supermarket', 'grocery'],
  cinema: ['cinema', 'odeon', 'vue', 'cineworld', 'imax', 'movie', 'multiplex', 'gate'],
};

function isCacheContentValid(results: POIResult[], category: POICategory): boolean {
  const keywords = CACHE_VALIDATION_KEYWORDS[category];
  if (!keywords || results.length === 0) {
    return true; // No validation needed or no results to validate
  }
  
  // Check if at least one result contains a validation keyword
  const hasValidResult = results.some(poi => {
    const name = poi.name.toLowerCase();
    return keywords.some(kw => name.includes(kw.toLowerCase()));
  });
  
  if (!hasValidResult && results.length > 0) {
    console.warn(`[POI] Cache content validation failed for ${category}`, {
      category,
      expectedKeywords: keywords,
      actualNames: results.slice(0, 3).map(r => r.name),
    });
  }
  
  return hasValidResult;
}

function buildCacheKey(category: POICategory, radiusMeters: number): string {
  return `${category}:${radiusMeters}`;
}

function parseCacheKey(cacheKey: string): { category: POICategory; radius: number } | null {
  const parts = cacheKey.split(':');
  if (parts.length === 2) {
    return { category: parts[0] as POICategory, radius: parseInt(parts[1], 10) };
  }
  if (parts.length === 1) {
    return { category: parts[0] as POICategory, radius: 5000 };
  }
  return null;
}

async function getCachedPOIs(schemeId: string, category: POICategory, radiusMeters?: number): Promise<CacheEntry | null> {
  const cacheKey = radiusMeters ? buildCacheKey(category, radiusMeters) : category;
  
  const cached = await db
    .select()
    .from(poi_cache)
    .where(and(
      eq(poi_cache.scheme_id, schemeId),
      eq(poi_cache.category, cacheKey)
    ))
    .limit(1);

  if (cached.length === 0) {
    return null;
  }

  const record = cached[0];
  const now = new Date();
  const fetchedAt = new Date(record.fetched_at);
  const ttlMs = record.ttl_days * 24 * 60 * 60 * 1000;
  const isTTLFresh = now.getTime() - fetchedAt.getTime() <= ttlMs;
  
  const results = record.results_json as POIResult[];
  
  const isContentValid = isCacheContentValid(results, category);
  
  const isFresh = isTTLFresh && isContentValid;

  return {
    results,
    fetched_at: fetchedAt,
    is_fresh: isFresh,
  };
}

interface PlacesFetchResult {
  results: POIResult[];
  success: boolean;
  httpStatus?: number;
  errorCode?: PlacesErrorCode;
  errorMessage?: string;
  requestUrl?: string;
  failureReason?: PlacesFailureReason;
}

async function fetchFromGooglePlaces(
  lat: number,
  lng: number,
  category: POICategory,
  radiusMeters: number = ESCALATION_RADII[0]
): Promise<PlacesFetchResult> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return {
      results: [],
      success: false,
      errorCode: 'REQUEST_DENIED',
      errorMessage: 'Google Maps API key not configured',
      failureReason: 'google_places_request_denied',
    };
  }

  if (!isValidCoordinate(lat, lng)) {
    return {
      results: [],
      success: false,
      errorCode: 'INVALID_REQUEST',
      errorMessage: `Invalid coordinates: lat=${lat}, lng=${lng}`,
      failureReason: 'google_places_invalid_coordinates',
    };
  }

  const mapping = CATEGORY_MAPPINGS[category];
  const allResults: any[] = [];
  let lastHttpStatus: number | undefined;
  let lastErrorCode: PlacesErrorCode | undefined;
  let lastErrorMessage: string | undefined;
  let lastRequestUrl: string | undefined;
  let lastFailureReason: PlacesFailureReason | undefined;

  for (const placeType of mapping.types) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', radiusMeters.toString());
    url.searchParams.set('type', placeType);
    url.searchParams.set('key', apiKey);

    lastRequestUrl = maskApiKeyInUrl(url.toString());

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);

      const response = await fetch(url.toString(), { signal: controller.signal });
      clearTimeout(timeoutId);

      lastHttpStatus = response.status;
      const data = await response.json();

      console.log('[POI] Places API response:', {
        type: placeType,
        status: data.status,
        resultCount: data.results?.length || 0,
        httpStatus: response.status,
      });

      if (data.status === 'OK' && data.results) {
        allResults.push(...data.results);
        lastErrorCode = 'OK';
      } else if (data.status === 'ZERO_RESULTS') {
        lastErrorCode = 'ZERO_RESULTS';
      } else {
        lastErrorCode = data.status as PlacesErrorCode;
        lastErrorMessage = data.error_message || `Google Places returned ${data.status}`;
        lastFailureReason = mapGoogleStatusToFailureReason(data.status);
        
        console.error('[POI] Google Places API error:', {
          timestamp: new Date().toISOString(),
          schemeId: 'unknown',
          category,
          lat,
          lng,
          httpStatus: response.status,
          status: data.status,
          errorMessage: lastErrorMessage,
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        lastErrorCode = 'TIMEOUT';
        lastErrorMessage = 'Request timed out';
        lastFailureReason = 'google_places_network_error';
      } else {
        lastErrorCode = 'NETWORK_ERROR';
        lastErrorMessage = error.message || 'Network error';
        lastFailureReason = 'google_places_network_error';
      }
      
      console.error('[POI] Places fetch error:', {
        timestamp: new Date().toISOString(),
        category,
        lat,
        lng,
        errorType: error.name,
        errorMessage: error.message,
      });
    }
  }

  if (allResults.length === 0 && lastErrorCode && lastErrorCode !== 'OK' && lastErrorCode !== 'ZERO_RESULTS') {
    return {
      results: [],
      success: false,
      httpStatus: lastHttpStatus,
      errorCode: lastErrorCode,
      errorMessage: lastErrorMessage,
      requestUrl: lastRequestUrl,
      failureReason: lastFailureReason,
    };
  }

  const seen = new Set<string>();
  let filteredResults = allResults.filter(place => {
    if (seen.has(place.place_id)) return false;
    seen.add(place.place_id);
    return true;
  });

  // CRITICAL: Filter by Google Places types to prevent mismatched results
  // This ensures e.g. golf_course queries don't return hotels/lodging
  const typeFiltered = filteredResults.filter(place => {
    const placeTypes = place.types || [];
    return mapping.types.some(requiredType => placeTypes.includes(requiredType));
  });
  
  // Only use type-filtered results if we got matches, otherwise log and return empty
  if (typeFiltered.length > 0) {
    filteredResults = typeFiltered;
  } else if (filteredResults.length > 0) {
    // Google returned results but none matched our required types - this is a type mismatch
    console.warn('[POI] Type mismatch: Google returned results but none matched required types', {
      category,
      requiredTypes: mapping.types,
      returnedTypes: filteredResults.slice(0, 3).map(p => ({ name: p.name, types: p.types })),
    });
    filteredResults = []; // Clear mismatched results
  }

  if (mapping.keywords && mapping.keywords.length > 0) {
    const keywordFiltered = filteredResults.filter(place => {
      const name = (place.name || '').toLowerCase();
      return mapping.keywords!.some(kw => name.includes(kw.toLowerCase()));
    });
    if (keywordFiltered.length > 0) {
      filteredResults = keywordFiltered;
    }
  }

  const results: POIResult[] = filteredResults.map(place => ({
    name: place.name,
    address: place.vicinity || place.formatted_address || '',
    place_id: place.place_id,
    distance_km: calculateDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
    open_now: place.opening_hours?.open_now,
    rating: place.rating,
  }));

  results.sort((a, b) => a.distance_km - b.distance_km);
  
  return {
    results: results.slice(0, MAX_RESULTS),
    success: true,
    httpStatus: lastHttpStatus,
    errorCode: 'OK',
    requestUrl: lastRequestUrl,
  };
}

async function fetchTravelTimes(
  originLat: number,
  originLng: number,
  places: POIResult[]
): Promise<POIResult[]> {
  if (places.length === 0) return places;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return places;

  const destinations = places.map(p => `place_id:${p.place_id}`).join('|');

  const results = [...places];

  for (const mode of ['walking', 'driving'] as const) {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${originLat},${originLng}`);
    url.searchParams.set('destinations', destinations);
    url.searchParams.set('mode', mode);
    url.searchParams.set('key', apiKey);

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status === 'OK' && data.rows?.[0]?.elements) {
        data.rows[0].elements.forEach((element: any, index: number) => {
          if (element.status === 'OK' && element.duration) {
            const minutes = Math.round(element.duration.value / 60);
            if (mode === 'walking') {
              results[index].walk_time_min = minutes;
            } else {
              results[index].drive_time_min = minutes;
            }
          }
        });
      }
    } catch (error) {
      console.error(`[POI] Distance Matrix error for ${mode}:`, error);
    }
  }

  return results;
}

async function storePOICache(
  schemeId: string,
  category: POICategory,
  results: POIResult[],
  radiusMeters?: number
): Promise<void> {
  const cacheKey = radiusMeters ? buildCacheKey(category, radiusMeters) : category;
  
  try {
    const existing = await db
      .select({ id: poi_cache.id })
      .from(poi_cache)
      .where(and(
        eq(poi_cache.scheme_id, schemeId),
        eq(poi_cache.category, cacheKey)
      ))
      .limit(1);

    const now = new Date();

    if (existing.length > 0) {
      await db
        .update(poi_cache)
        .set({
          results_json: results,
          fetched_at: now,
          ttl_days: DEFAULT_TTL_DAYS,
        })
        .where(eq(poi_cache.id, existing[0].id));
    } else {
      await db
        .insert(poi_cache)
        .values({
          scheme_id: schemeId,
          category: cacheKey,
          provider: 'google_places',
          results_json: results,
          fetched_at: now,
          ttl_days: DEFAULT_TTL_DAYS,
        });
    }
  } catch (err) {
    console.error('[POI] Failed to store cache (FK constraint?):', err);
  }
}

async function findBestStaleCache(schemeId: string, category: POICategory): Promise<CacheEntry | null> {
  let bestStale: CacheEntry | null = null;
  
  const legacyCache = await getCachedPOIsLegacy(schemeId, category);
  if (legacyCache && legacyCache.results.length > 0) {
    bestStale = legacyCache;
  }
  
  for (const radius of ESCALATION_RADII) {
    const cached = await getCachedPOIs(schemeId, category, radius);
    if (cached && cached.results.length > 0) {
      if (!bestStale || cached.results.length > bestStale.results.length) {
        bestStale = cached;
      }
    }
  }
  return bestStale;
}

async function getCachedPOIsLegacy(schemeId: string, category: POICategory): Promise<CacheEntry | null> {
  const cached = await db
    .select()
    .from(poi_cache)
    .where(and(
      eq(poi_cache.scheme_id, schemeId),
      eq(poi_cache.category, category)
    ))
    .limit(1);

  if (cached.length === 0) {
    return null;
  }

  const record = cached[0];
  const fetchedAt = new Date(record.fetched_at);
  const results = record.results_json as POIResult[];

  return {
    results,
    fetched_at: fetchedAt,
    is_fresh: false,
  };
}

export async function getNearbyPOIs(
  schemeId: string,
  category: POICategory
): Promise<POICacheResult> {
  console.log(`[POI] getNearbyPOIs called for scheme=${schemeId}, category=${category}`);

  const diagnostics: PlacesDiagnostics = {
    scheme_id: schemeId,
    category,
    cache_hit: false,
    is_stale_cache: false,
    scheme_location_present: false,
    timestamp: new Date().toISOString(),
  };

  const location = await getSchemeLocation(schemeId);
  
  if (location) {
    diagnostics.scheme_location_present = true;
    diagnostics.scheme_lat = location.lat;
    diagnostics.scheme_lng = location.lng;
    diagnostics.scheme_address = location.address;
    diagnostics.scheme_location_source = location.source;
  } else {
    diagnostics.scheme_location_present = false;
    diagnostics.scheme_location_source = null;
  }

  if (!location) {
    console.error(`[POI] Scheme ${schemeId} has no location set in scheme_profile - returning deterministic failure`);
    diagnostics.failure_reason = 'missing_location';
    
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  if (!isValidCoordinate(location.lat, location.lng)) {
    console.error(`[POI] Scheme ${schemeId} has invalid coordinates: lat=${location.lat}, lng=${location.lng}`);
    diagnostics.failure_reason = 'invalid_coordinates';
    diagnostics.places_error_message = `Invalid coordinates: lat=${location.lat}, lng=${location.lng}`;
    
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  let bestFreshResults: POIResult[] = [];
  let bestFreshRadius: number = ESCALATION_RADII[0];
  let bestFreshFetchedAt: Date = new Date();
  let escalationUsed = false;
  let allApiFetchesFailed = true;
  let anyApiFetchAttempted = false;
  let anyFreshDataAvailable = false;

  for (const radius of ESCALATION_RADII) {
    console.log(`[POI] Trying radius ${radius}m for ${category}`);
    
    const cached = await getCachedPOIs(schemeId, category, radius);
    if (cached && cached.is_fresh) {
      console.log(`[POI] Cache hit at ${radius}m: ${cached.results.length} results`);
      anyFreshDataAvailable = true;
      
      if (cached.results.length >= MIN_RESULTS_THRESHOLD) {
        diagnostics.cache_hit = true;
        (diagnostics as any).radius_used = radius;
        (diagnostics as any).escalation_used = radius > ESCALATION_RADII[0];
        return {
          results: cached.results,
          fetched_at: cached.fetched_at,
          from_cache: true,
          diagnostics,
        };
      }
      
      if (cached.results.length > bestFreshResults.length) {
        bestFreshResults = cached.results;
        bestFreshRadius = radius;
        bestFreshFetchedAt = cached.fetched_at;
      }
      
      if (radius === ESCALATION_RADII[ESCALATION_RADII.length - 1]) {
        diagnostics.cache_hit = true;
        (diagnostics as any).radius_used = bestFreshRadius;
        (diagnostics as any).escalation_used = bestFreshRadius > ESCALATION_RADII[0];
        return {
          results: bestFreshResults,
          fetched_at: bestFreshFetchedAt,
          from_cache: true,
          diagnostics,
        };
      }
      
      escalationUsed = true;
      continue;
    }
    
    console.log(`[POI] Fetching fresh data from Google Places at ${location.lat}, ${location.lng} with radius ${radius}m`);
    anyApiFetchAttempted = true;
    const fetchResult = await fetchFromGooglePlaces(location.lat, location.lng, category, radius);

    diagnostics.places_request_url = fetchResult.requestUrl;
    diagnostics.places_http_status = fetchResult.httpStatus;
    diagnostics.places_error_message = fetchResult.errorMessage;
    diagnostics.places_api_error_code = fetchResult.errorCode;

    if (!fetchResult.success) {
      diagnostics.failure_reason = fetchResult.failureReason;
      
      console.error('[POI] Structured failure log:', {
        timestamp: new Date().toISOString(),
        scheme_id: schemeId,
        category,
        radius,
        lat: location.lat,
        lng: location.lng,
        http_status: fetchResult.httpStatus,
        api_status: fetchResult.errorCode,
        error_message: fetchResult.errorMessage,
        failure_reason: fetchResult.failureReason,
      });

      continue;
    }

    allApiFetchesFailed = false;
    anyFreshDataAvailable = true;
    let results = fetchResult.results;
    
    if (results.length === 0) {
      await storePOICache(schemeId, category, [], radius);
      console.log(`[POI] Cached empty results at ${radius}m`);
      escalationUsed = true;
      continue;
    }
    
    console.log(`[POI] Fetching travel times for ${results.length} places`);
    results = await fetchTravelTimes(location.lat, location.lng, results);
    await storePOICache(schemeId, category, results, radius);
    console.log(`[POI] Cached ${results.length} results at ${radius}m`);
    
    if (results.length > bestFreshResults.length) {
      bestFreshResults = results;
      bestFreshRadius = radius;
      bestFreshFetchedAt = new Date();
    }

    if (results.length >= MIN_RESULTS_THRESHOLD) {
      (diagnostics as any).radius_used = radius;
      (diagnostics as any).escalation_used = escalationUsed;
      return {
        results,
        fetched_at: new Date(),
        from_cache: false,
        diagnostics,
      };
    }
    
    escalationUsed = true;
  }

  if (anyApiFetchAttempted && allApiFetchesFailed) {
    const staleCache = await findBestStaleCache(schemeId, category);
    if (staleCache && staleCache.results.length > 0) {
      console.log('[POI] All API fetches failed, returning stale cache with', staleCache.results.length, 'results');
      diagnostics.is_stale_cache = true;
      (diagnostics as any).radius_used = bestFreshRadius;
      (diagnostics as any).escalation_used = escalationUsed;
      return {
        results: staleCache.results,
        fetched_at: staleCache.fetched_at,
        from_cache: true,
        is_stale: true,
        diagnostics,
      };
    }
  }

  if (bestFreshResults.length === 0 && anyFreshDataAvailable) {
    diagnostics.failure_reason = 'no_places_results';
    (diagnostics as any).radius_used = bestFreshRadius;
    (diagnostics as any).escalation_used = escalationUsed;
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  if (bestFreshResults.length === 0) {
    diagnostics.failure_reason = 'no_places_results';
  }
  
  (diagnostics as any).radius_used = bestFreshRadius;
  (diagnostics as any).escalation_used = escalationUsed;

  return {
    results: bestFreshResults,
    fetched_at: bestFreshFetchedAt,
    from_cache: false,
    diagnostics,
  };
}

export interface FormatPOIOptions {
  developmentName?: string;
  category: POICategory;
  limit?: number;
  sessionSeed?: number;
  schemeId?: string;
}

const INTRO_VARIANTS: Record<string, string[]> = {
  amenities: [
    "You're well placed here for everyday essentials.",
    "There's a nice mix of options close by for that.",
    "You'll find what you need without going far.",
    "The area has some handy spots for that.",
    "You've got good access to local amenities here.",
    "There are a few reliable options in the neighbourhood.",
    "It's a convenient spot for day-to-day needs.",
    "You're in a good location for that.",
  ],
  supermarket: [
    "You're well placed for everyday shopping here – there's a good mix of supermarkets close by, from larger chains to smaller speciality stores.",
    "For groceries, you've got plenty of options nearby.",
    "There's a nice selection of supermarkets within easy reach.",
    "You're in a great spot for food shopping – several stores are close by.",
    "Grocery shopping won't be a problem – there are good options nearby.",
    "You'll have no trouble finding groceries here – a few supermarkets are within reach.",
    "The area is well served for food shopping, with a mix of stores nearby.",
    "For everyday shopping, you've got some solid choices close by.",
  ],
  pharmacy: [
    "For pharmacy needs, you've got a few good options nearby.",
    "There are pharmacies within easy reach if you need one.",
    "You're well placed for pharmacies – a few are close by.",
    "You've got convenient access to local pharmacies here.",
    "There are a couple of reliable pharmacies in the area.",
    "Pharmacy-wise, you're in a handy spot.",
    "You won't have to go far for pharmacy needs.",
    "The area has a few pharmacies you can get to easily.",
  ],
  schools: [
    "The area is well served by schools – there's a good mix of primary and secondary options.",
    "You've got access to some good schools nearby.",
    "For schools, the area has some solid options.",
    "There are schools nearby that serve the local community.",
    "You're in a good catchment area for schools.",
    "The neighbourhood has a few well-regarded schools.",
    "For families, there are school options within easy reach.",
    "You'll find both primary and secondary schools in the area.",
  ],
  transport: [
    "Public transport links are good here – you've got options nearby.",
    "Getting around is straightforward – there are transport links close by.",
    "You're well connected for public transport.",
    "There are good transport options within reach.",
    "The area has reliable public transport access.",
    "For getting around, you've got some handy links nearby.",
    "Transport-wise, you're in a convenient spot.",
    "You've got good access to buses and trains from here.",
  ],
  bar: [
    "There are a few good spots for a drink nearby.",
    "You've got some nice pubs close by.",
    "For a pint, you've got options within easy reach.",
    "There are pubs and bars in the local area.",
    "You're well placed for a night out – there are bars nearby.",
    "The area has a few locals you could try.",
    "For drinks, you've got some handy options close by.",
    "There are a few pubs within reach.",
  ],
  convenience_store: [
    "There are a few handy shops nearby for everyday bits.",
    "You've got local shops close by for quick essentials.",
    "For convenience stores, you're in a good spot.",
    "There are some local shops within easy reach.",
    "You've got options nearby for quick errands.",
    "The area has a few corner shops close by.",
    "For milk, bread, and essentials, there are shops nearby.",
    "There are convenience stores within reach.",
  ],
  golf_course: [
    "If you're into golf, there are courses within a short drive.",
    "You've got golf options within reach of the area.",
    "For golfers, there are a few courses you can get to easily.",
    "The area has some golf courses within driving distance.",
    "You're well placed for golf, there are courses nearby.",
    "If you enjoy a round of golf, you've got options close enough.",
    "There are golf clubs within a reasonable drive.",
    "For golf, you've got a few courses to choose from.",
  ],
  cinema: [
    "For a night at the cinema, there are options within reach.",
    "You've got cinema options not too far away.",
    "There are a few cinemas you can get to from here.",
    "If you fancy catching a film, there are cinemas nearby.",
    "The area has cinema options within driving distance.",
    "For films, you've got a few screens to choose from.",
    "There are cinemas within easy reach of the area.",
    "You're well placed if you enjoy a trip to the pictures.",
  ],
};

function getVariedIntro(category: POICategory, developmentName?: string, sessionSeed?: number): string {
  let variantKey = 'amenities';
  if (category === 'supermarket') variantKey = 'supermarket';
  else if (category === 'pharmacy') variantKey = 'pharmacy';
  else if (category === 'primary_school' || category === 'secondary_school') variantKey = 'schools';
  else if (category === 'train_station' || category === 'bus_stop') variantKey = 'transport';
  else if (category === 'bar') variantKey = 'bar';
  else if (category === 'convenience_store') variantKey = 'convenience_store';
  else if (category === 'golf_course') variantKey = 'golf_course';
  else if (category === 'cinema') variantKey = 'cinema';
  
  const variants = INTRO_VARIANTS[variantKey] || INTRO_VARIANTS.amenities;
  const seed = sessionSeed ?? Math.floor(Math.random() * variants.length);
  const selected = variants[seed % variants.length];
  
  const schemeName = developmentName || 'your new home';
  return selected.replace('{schemeName}', schemeName);
}

const DRIVE_ONLY_CATEGORIES: POICategory[] = ['golf_course', 'hospital', 'sports', 'leisure'];

function isDriveOnlyCategory(category: POICategory): boolean {
  return DRIVE_ONLY_CATEGORIES.includes(category);
}

function formatBulletItem(poi: POIResult, driveOnly: boolean = false): string {
  let line = `- ${poi.name}`;
  
  if (poi.address) {
    line += `, ${poi.address}`;
  }
  
  const extras: string[] = [];
  
  if (driveOnly) {
    if (poi.drive_time_min) {
      extras.push(`approx. ${poi.drive_time_min} min drive`);
    } else if (poi.distance_km) {
      extras.push(`approx. ${Math.round(poi.distance_km * 2)} min drive`);
    }
  } else {
    if (poi.drive_time_min) {
      extras.push(`approx. ${poi.drive_time_min} min drive`);
    } else if (poi.walk_time_min) {
      extras.push(`approx. ${poi.walk_time_min} min walk`);
    }
  }
  
  if (poi.open_now !== undefined) {
    extras.push(poi.open_now ? 'open now' : 'currently closed');
  }
  
  if (extras.length > 0) {
    line += ` (${extras.join(', ')})`;
  }
  
  return line;
}

function getSourceHint(fetchedAt: Date): string {
  const dateStr = fetchedAt.toLocaleDateString('en-IE', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
  return `\n\nBased on Google Places, last updated ${dateStr}.`;
}

export function formatPOIResponse(data: POICacheResult, options: FormatPOIOptions | POICategory, limit: number = 5): string {
  const opts: FormatPOIOptions = typeof options === 'string' 
    ? { category: options, limit } 
    : { ...options, limit: options.limit ?? limit };
  
  const { developmentName, category, sessionSeed } = opts;
  const resultLimit = opts.limit ?? 5;

  if (data.results.length === 0) {
    if (isLocationMissingReason(data.diagnostics?.failure_reason)) {
      return `The development location hasn't been set up yet, so I'm not able to search for nearby places at the moment. Your developer should be able to sort that out.`;
    }
    return `I couldn't find any ${formatCategoryName(category)} immediately nearby. There may be options a bit further afield, or I can help with other local amenities if you'd like.`;
  }

  const topResults = data.results.slice(0, resultLimit);
  
  const intro = getVariedIntro(category, developmentName, sessionSeed);
  
  const driveOnly = isDriveOnlyCategory(category);
  const bullets = topResults.map(poi => formatBulletItem(poi, driveOnly)).join('\n');
  
  const sourceHint = getSourceHint(data.fetched_at);
  
  return `${intro}\n\n${bullets}${sourceHint}`;
}

function getQualitativeDistance(km: number): string {
  if (km <= 0.5) return 'a short walk away';
  if (km <= 1) return 'within walking distance';
  if (km <= 2) return 'nearby';
  if (km <= 5) return 'a short drive away';
  return 'a few kilometres away';
}

function getConversationalOpener(category: POICategory, placeAck: string): string {
  const openers: Record<POICategory, string> = {
    supermarket: `${placeAck}'ve good options for grocery shopping nearby.\n\n`,
    pharmacy: `${placeAck}'ve several pharmacies within easy reach.\n\n`,
    gp: `${placeAck}'ve some GP surgeries in the area.\n\n`,
    hospital: `${placeAck}'ve hospital access nearby.\n\n`,
    childcare: `${placeAck}'ve childcare options in the area.\n\n`,
    primary_school: `${placeAck}'ve some primary schools nearby.\n\n`,
    secondary_school: `${placeAck}'ve secondary schools in the area.\n\n`,
    train_station: `${placeAck}'ve good train access.\n\n`,
    bus_stop: `${placeAck}'ve bus stops within easy reach.\n\n`,
    park: `${placeAck}'ve parks and green spaces nearby.\n\n`,
    playground: `${placeAck}'ve playgrounds close by for children.\n\n`,
    gym: `${placeAck}'ve several gyms to choose from.\n\n`,
    leisure: `${placeAck}'ve leisure facilities in the area.\n\n`,
    cafe: `${placeAck}'ve cafes nearby.\n\n`,
    restaurant: `${placeAck}'ve dining options nearby.\n\n`,
    sports: `${placeAck}'ve sports facilities in the area.\n\n`,
    bar: `${placeAck}'ve some good pubs and bars nearby.\n\n`,
    convenience_store: `${placeAck}'ve local shops close by.\n\n`,
    golf_course: `${placeAck}'ve golf courses within a short drive.\n\n`,
    cinema: `${placeAck}'ve cinemas within reach.\n\n`,
  };
  return openers[category] || `${placeAck}'ve some ${formatCategoryName(category)} nearby.\n\n`;
}

function getFollowUp(category: POICategory): string {
  const followUps: Record<POICategory, string> = {
    supermarket: "\n\nIf you're looking for something specific like convenience stores or cafes, I can help with that too.",
    pharmacy: "\n\nIf you need GP information or anything else, just let me know.",
    gp: "\n\nI can also point out pharmacies or hospitals if that would help.",
    hospital: "\n\nLet me know if you'd like GP or pharmacy information too.",
    childcare: "\n\nI can also help with schools in the area if you'd like.",
    primary_school: "\n\nIf you'd like secondary school information as well, just ask.",
    secondary_school: "\n\nLet me know if there's anything else about the area you'd like to know.",
    train_station: "\n\nI can also look up bus routes if that would be helpful.",
    bus_stop: "\n\nIf you need train station information, I can help with that too.",
    park: "\n\nI can also point out playgrounds if you have young children.",
    playground: "\n\nLet me know if you'd like to know about parks or other family amenities.",
    gym: "\n\nI can also look up sports facilities or leisure centres if you'd like.",
    leisure: "\n\nLet me know if there's anything else about the area I can help with.",
    cafe: "\n\nIf you're also interested in restaurants, I can help with that.",
    restaurant: "\n\nLet me know if there's anything else about the local area you'd like to know.",
    sports: "\n\nI can also point out gyms or leisure centres if you're interested.",
    bar: "\n\nIf you'd like restaurant or cafe recommendations too, just ask.",
    convenience_store: "\n\nI can also help with supermarkets or pharmacies if you need.",
    golf_course: "\n\nI can also look up other sports facilities or leisure centres if you'd like.",
    cinema: "\n\nI can also help with restaurants or bars nearby if you'd like.",
  };
  return followUps[category] || "\n\nLet me know if there's anything else about the area I can help with.";
}

function formatCategoryName(category: POICategory): string {
  const names: Record<POICategory, string> = {
    supermarket: 'supermarkets',
    pharmacy: 'pharmacies',
    gp: 'GP surgeries',
    hospital: 'hospitals',
    childcare: 'childcare facilities',
    primary_school: 'primary schools',
    secondary_school: 'secondary schools',
    train_station: 'train stations',
    bus_stop: 'bus stops',
    park: 'parks',
    playground: 'playgrounds',
    gym: 'gyms',
    leisure: 'leisure facilities',
    cafe: 'cafes',
    restaurant: 'restaurants',
    sports: 'sports facilities',
    bar: 'pubs and bars',
    convenience_store: 'local shops',
    golf_course: 'golf courses',
    cinema: 'cinemas',
  };
  return names[category] || category;
}

export interface GroupedSchoolsData {
  primary: POIResult[];
  secondary: POIResult[];
  fetchedAt: Date;
  diagnostics?: PlacesDiagnostics;
}

export function formatGroupedSchoolsResponse(data: GroupedSchoolsData, developmentName?: string, sessionSeed?: number): string {
  const hasPrimary = data.primary.length > 0;
  const hasSecondary = data.secondary.length > 0;
  
  if (!hasPrimary && !hasSecondary) {
    if (isLocationMissingReason(data.diagnostics?.failure_reason)) {
      return `The development location hasn't been set up yet, so I'm not able to search for nearby schools at the moment. Your developer should be able to sort that out.`;
    }
    return `I couldn't find any schools close by – it's possible there aren't any within a reasonable distance, or the data just isn't available at the moment.`;
  }

  const intro = getVariedIntro('primary_school', developmentName, sessionSeed);
  
  let body = '';
  
  if (hasPrimary) {
    body += 'Primary schools:\n';
    body += data.primary.slice(0, 3).map(poi => formatBulletItem(poi)).join('\n');
  } else {
    body += 'Primary schools:\nNone found close by.';
  }
  
  body += '\n\n';
  
  if (hasSecondary) {
    body += 'Secondary schools:\n';
    body += data.secondary.slice(0, 3).map(poi => formatBulletItem(poi)).join('\n');
  } else {
    body += 'Secondary schools:\nNone found close by.';
  }
  
  const sourceHint = getSourceHint(data.fetchedAt);
  
  return `${intro}\n\n${body}${sourceHint}`;
}

export function formatSchoolsResponse(data: POICacheResult, developmentName?: string, sessionSeed?: number): string {
  if (data.results.length === 0) {
    if (isLocationMissingReason(data.diagnostics?.failure_reason)) {
      return `The development location hasn't been set up yet, so I'm not able to search for nearby schools at the moment. Your developer should be able to sort that out.`;
    }
    return `I couldn't find any schools close by – it's possible there aren't any within a reasonable distance, or the data just isn't available at the moment.`;
  }

  const topResults = data.results.slice(0, 5);
  const intro = getVariedIntro('primary_school', developmentName, sessionSeed);
  const bullets = topResults.map(poi => formatBulletItem(poi)).join('\n');
  const sourceHint = getSourceHint(data.fetched_at);
  
  return `${intro}\n\n${bullets}${sourceHint}`;
}

export function formatShopsResponse(data: POICacheResult, developmentName?: string, sessionSeed?: number): string {
  if (data.results.length === 0) {
    if (isLocationMissingReason(data.diagnostics?.failure_reason)) {
      return `The development location hasn't been set up yet, so I'm not able to search for nearby shops at the moment. Your developer should be able to sort that out.`;
    }
    return `I couldn't find any shops close by – it's possible there aren't any within a reasonable distance, or the data just isn't available at the moment.`;
  }

  const topResults = data.results.slice(0, 5);
  const intro = getVariedIntro('supermarket', developmentName, sessionSeed);
  const bullets = topResults.map(poi => formatBulletItem(poi)).join('\n');
  const sourceHint = getSourceHint(data.fetched_at);
  
  return `${intro}\n\n${bullets}${sourceHint}`;
}

export interface GroupedAmenitiesData {
  supermarket: POIResult[];
  pharmacy: POIResult[];
  gp: POIResult[];
  transport: POIResult[];
  cafe: POIResult[];
  fetchedAt: Date;
  diagnostics?: PlacesDiagnostics;
  schemeName?: string;
}

const LOCAL_AMENITIES_INTROS = [
  "You're well placed here for everyday essentials. Here's what's nearby:",
  "The area has a nice mix of amenities within reach:",
  "You've got good access to local services. Here's an overview:",
  "For day-to-day needs, you're in a convenient spot:",
  "There's plenty close by for everyday life:",
];

export function formatLocalAmenitiesResponse(data: GroupedAmenitiesData, developmentName?: string, sessionSeed?: number): string {
  const hasAnyResults = data.supermarket.length > 0 || data.pharmacy.length > 0 || 
                        data.gp.length > 0 || data.transport.length > 0 || data.cafe.length > 0;
  
  if (!hasAnyResults) {
    if (isLocationMissingReason(data.diagnostics?.failure_reason)) {
      return `The development location hasn't been set up yet, so I'm not able to search for nearby amenities at the moment. Your developer should be able to sort that out.`;
    }
    return `I couldn't find nearby amenities at the moment. You could try Google Maps for a wider search around the area.`;
  }
  
  const seed = sessionSeed ?? Math.floor(Math.random() * LOCAL_AMENITIES_INTROS.length);
  const intro = LOCAL_AMENITIES_INTROS[seed % LOCAL_AMENITIES_INTROS.length];
  
  const sortedSupermarket = sortByQuality(data.supermarket);
  const sortedPharmacy = sortByQuality(data.pharmacy);
  const sortedGp = sortByQuality(data.gp);
  const sortedTransport = sortByQuality(data.transport);
  const sortedCafe = sortByQuality(data.cafe);
  
  const sections: string[] = [];
  let totalItems = 0;
  
  const addSection = (title: string, items: POIResult[], maxItems: number = LOCAL_AMENITIES_MAX_PER_CATEGORY) => {
    if (items.length === 0 || totalItems >= LOCAL_AMENITIES_MAX_TOTAL) return;
    
    const remaining = LOCAL_AMENITIES_MAX_TOTAL - totalItems;
    const limit = Math.min(maxItems, remaining, items.length);
    if (limit <= 0) return;
    
    const selected = items.slice(0, limit);
    sections.push(`**${title}**\n${selected.map(poi => formatBulletItem(poi)).join('\n')}`);
    totalItems += selected.length;
  };
  
  addSection('Groceries & Shopping', sortedSupermarket, 3);
  addSection('Pharmacy', sortedPharmacy, 2);
  addSection('Healthcare', sortedGp, 2);
  addSection('Public Transport', sortedTransport, 2);
  addSection('Cafes & Coffee', sortedCafe, 2);
  
  const sourceHint = getSourceHint(data.fetchedAt);
  
  return `${intro}\n\n${sections.join('\n\n')}${sourceHint}`;
}

export type ExpandedIntent = 'schools' | 'shops' | 'local_amenities';

export interface POICategoryResult {
  category: POICategory | null;
  expandedIntent?: ExpandedIntent;
  categories?: POICategory[];
  dynamicKeyword?: string; // For amenities not in our predefined list
}

export function detectPOICategory(query: string): POICategory | null {
  return detectPOICategoryExpanded(query).category;
}

export function detectPOICategoryExpanded(query: string): POICategoryResult {
  const q = query.toLowerCase();
  
  // Check for expanded intents first
  
  // GENERAL "local amenities" / "amenities in my area" = multi-category search
  // Must come BEFORE specific category checks to catch broad amenity queries
  if (/\b(what|which)\s+(amenities|facilities|services)\b.*\b(local|my|area|near|nearby|around)\b/i.test(q) ||
      /\b(local|nearby)\s+(amenities|facilities|services)\b/i.test(q) ||
      /\bamenities\s+(in|around|near)\s+(my|the|this)\s+(area|local|locality|neighbourhood|neighborhood)\b/i.test(q) ||
      /\b(what('s|is)?|tell me|show me)\s+(in|around|near)\s+(my|the)?\s*(local|area|neighbourhood|neighborhood)\b/i.test(q)) {
    return { 
      category: 'supermarket', 
      expandedIntent: 'local_amenities',
      categories: ['supermarket', 'pharmacy', 'gp', 'bus_stop', 'cafe']
    };
  }
  
  // "schools" = primary + secondary by default
  if (/\bschools?\b/i.test(q) && !/primary|secondary|national|high|post.?primary/i.test(q)) {
    return { 
      category: 'primary_school', 
      expandedIntent: 'schools',
      categories: ['primary_school', 'secondary_school']
    };
  }
  
  // "shops" (generic) = convenience stores (Irish colloquial: "local shop", "corner shop")
  // Only match truly generic shop requests, NOT compound phrases like "coffee shop", "bike shop"
  if (/\b(local\s+shop|corner\s+shop)\b/i.test(q)) {
    return { category: 'convenience_store' };
  }
  
  // Generic "shops" or "shop" as standalone (without preceding noun like "coffee")
  // Match: "any shops", "nearby shops", "where's a shop", but NOT "coffee shop"
  if (/(?:^|\s)(shops?)\s*(?:\?|$|near|around|close|by)/i.test(q) && 
      !/supermarket|grocery|grocer|coffee|bike|pet|book|gift|flower/i.test(q)) {
    return { 
      category: 'convenience_store', 
      expandedIntent: 'shops',
      categories: ['supermarket', 'convenience_store']
    };
  }
  
  // IRISH/COLLOQUIAL NORMALISATION - pub, bar, pint
  if (/\b(pub|pubs|local\s*pub|pint|place\s*for\s*a\s*drink|bar|bars)\b/i.test(q)) {
    return { category: 'bar' };
  }
  
  // GOLF - explicit concrete amenity (never trigger clarification)
  if (/\b(golf|golf\s*course|golf\s*club|driving\s*range)\b/i.test(q)) {
    return { category: 'golf_course' };
  }
  
  // CINEMA - explicit concrete amenity
  if (/\b(cinema|movie\s*theat(?:re|er)|pictures|films?)\b/i.test(q)) {
    return { category: 'cinema' };
  }
  
  // Specific category detection
  if (/supermarket|grocery|grocer|tesco|aldi|lidl|dunnes|spar/i.test(q)) {
    return { category: 'supermarket' };
  }
  
  // IRISH NORMALISATION - chemist → pharmacy (already handled, but explicit)
  if (/pharmac|chemist|boots|lloyds/i.test(q)) return { category: 'pharmacy' };
  
  if (/\bhospital\b/i.test(q)) return { category: 'hospital' };
  if (/\b(gp|doctor|surgery|clinic|medical|health\s*cent)/i.test(q)) return { category: 'gp' };
  
  // IRISH NORMALISATION - crèche, childcare
  if (/childcare|cr[eè]che|montessori|nursery|daycare|preschool/i.test(q)) return { category: 'childcare' };
  
  if (/primary\s*school|national\s*school/i.test(q)) return { category: 'primary_school' };
  if (/secondary\s*school|high\s*school|post.?primary|college/i.test(q)) return { category: 'secondary_school' };
  if (/train|rail|dart|luas|station/i.test(q)) return { category: 'train_station' };
  if (/bus|bus\s*stop|transit/i.test(q)) return { category: 'bus_stop' };
  if (/\bplayground\b|play\s*area|play\s*ground/i.test(q)) return { category: 'playground' };
  if (/\bpark\b/i.test(q)) return { category: 'park' };
  if (/\bgym\b|fitness|workout/i.test(q)) return { category: 'gym' };
  if (/leisure|swimming|pool|spa/i.test(q)) return { category: 'leisure' };
  if (/\bcafe\b|coffee/i.test(q)) return { category: 'cafe' };
  
  // IRISH NORMALISATION - takeaway, food nearby → restaurant
  if (/restaurant|takeaway|take\s*away|food\s*nearby|dining|eat/i.test(q)) return { category: 'restaurant' };
  
  // Convenience store explicit match
  if (/convenience\s*store|centra|mace|costcutter|londis/i.test(q)) return { category: 'convenience_store' };
  
  if (/sports?\s*(facility|facilities|centre|center)/i.test(q)) return { category: 'sports' };
  
  if (/near(by|est)?\s+(amenities|facilities|services)/i.test(q)) return { category: 'supermarket' };
  
  // DYNAMIC FALLBACK: Extract amenity keyword for unknown place types
  // This allows handling of any amenity query like "bowling", "laser tag", "escape room", etc.
  const dynamicKeyword = extractAmenityKeyword(q);
  if (dynamicKeyword) {
    return { category: null, dynamicKeyword };
  }
  
  return { category: null };
}

// Extract the amenity/place type keyword from a query for dynamic search
function extractAmenityKeyword(query: string): string | null {
  const q = query.toLowerCase().trim();
  
  // Common patterns for amenity queries
  const patterns = [
    /(?:where(?:'s| is| are)?|find|closest|nearest|any|looking for(?: a)?)\s+(?:the\s+)?(?:nearest\s+)?(.+?)(?:\s+near(?:by)?|\s+close|\s+around|\?|$)/i,
    /(?:is there|are there)\s+(?:a|an|any)\s+(.+?)\s+(?:near(?:by)?|close|around|\?|$)/i,
    /(.+?)\s+(?:near(?:by)?|close by|around here|in the area)/i,
  ];
  
  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match && match[1]) {
      let keyword = cleanKeyword(match[1]);
      if (keyword) return keyword;
    }
  }
  
  // FALLBACK: For simple noun phrases like "bowling alley", "laser tag", "escape room"
  // If the query looks like a simple amenity request, use the whole query as keyword
  let cleaned = q
    .replace(/\?+$/g, '')
    .replace(/^(where(?:'s| is| are)?|find(?: me)?|show(?: me)?|looking for|is there|are there|any|nearest|closest)\s*/gi, '')
    .replace(/^(the|a|an|some)\s+/gi, '')
    .replace(/\s+(near(?:by)?|close(?:\s*by)?|around(?:\s*here)?|in the area)$/gi, '')
    .replace(/\s+(please|thanks|thank you)$/gi, '')
    .trim();
  
  // If after cleaning we have something that looks like an amenity (2+ chars, not a question word)
  if (cleaned.length >= 3 && 
      !/^(how|what|when|why|who|which|can|do|does|is|are|will|would|should|could)$/i.test(cleaned) &&
      !/^(it|me|us|here|there|this|that|one|ones)$/i.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

function cleanKeyword(raw: string): string | null {
  let keyword = raw.trim()
    .replace(/^(the|a|an|some|any)\s+/i, '')
    .replace(/\s+(here|there|me|us)$/i, '')
    .replace(/\s+to\s+.+$/i, '')
    .replace(/\?+$/g, '')
    .trim();
  
  // Skip if it's too short or too generic
  if (keyword.length < 3) return null;
  if (/^(it|me|us|here|there|place|thing|stuff)$/i.test(keyword)) return null;
  
  // Skip if it looks like a non-amenity question
  if (/^(how|what|when|why|who|which)$/i.test(keyword)) return null;
  
  return keyword;
}

export const SUPPORTED_CATEGORIES = Object.keys(CATEGORY_MAPPINGS) as POICategory[];

// Dynamic keyword-based search for amenities not in our predefined categories
export async function searchNearbyByKeyword(
  schemeId: string,
  keyword: string
): Promise<POICacheResult> {
  console.log(`[POI] searchNearbyByKeyword called for scheme=${schemeId}, keyword="${keyword}"`);

  const diagnostics: PlacesDiagnostics = {
    scheme_id: schemeId,
    category: `dynamic:${keyword}`,
    cache_hit: false,
    is_stale_cache: false,
    scheme_location_present: false,
    timestamp: new Date().toISOString(),
  };

  const location = await getSchemeLocation(schemeId);
  
  if (!location) {
    diagnostics.failure_reason = 'places_no_location';
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  diagnostics.scheme_location_present = true;
  diagnostics.scheme_lat = location.lat;
  diagnostics.scheme_lng = location.lng;

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    diagnostics.failure_reason = 'google_places_request_denied';
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  // Use Google Places Text Search for more flexible keyword matching
  // Default radius for text search is 5000m (5km)
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('query', `${keyword} near ${location.address || `${location.lat},${location.lng}`}`);
  url.searchParams.set('location', `${location.lat},${location.lng}`);
  url.searchParams.set('radius', '5000');
  url.searchParams.set('key', apiKey);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS);

    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await response.json();

    console.log('[POI] Text Search API response:', {
      keyword,
      status: data.status,
      resultCount: data.results?.length || 0,
    });

    if (data.status === 'OK' && data.results) {
      let results: POIResult[] = data.results.slice(0, MAX_RESULTS).map((place: any) => ({
        name: place.name,
        address: place.formatted_address || place.vicinity || '',
        place_id: place.place_id,
        distance_km: calculateDistance(location.lat, location.lng, place.geometry.location.lat, place.geometry.location.lng),
        rating: place.rating,
        open_now: place.opening_hours?.open_now,
      }));

      results.sort((a, b) => a.distance_km - b.distance_km);

      // Fetch travel times
      if (results.length > 0) {
        results = await fetchTravelTimes(location.lat, location.lng, results);
      }

      return {
        results,
        fetched_at: new Date(),
        from_cache: false,
        diagnostics,
      };
    }

    diagnostics.failure_reason = 'no_places_results';
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  } catch (error: any) {
    console.error('[POI] Keyword search error:', error);
    diagnostics.failure_reason = 'google_places_network_error';
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }
}

// Format response for dynamic keyword searches
export function formatDynamicPOIResponse(
  data: POICacheResult,
  keyword: string,
  developmentName?: string,
  sessionSeed?: number
): string {
  if (data.results.length === 0) {
    if (isLocationMissingReason(data.diagnostics?.failure_reason)) {
      return `The development location hasn't been set up yet, so I'm not able to search for ${keyword} at the moment. Your developer should be able to sort that out.`;
    }
    return `I couldn't find any ${keyword} immediately nearby. There may be options a bit further afield, or I can help with other local amenities if you'd like.`;
  }

  const topResults = data.results.slice(0, 5);
  
  const intros = [
    `For ${keyword}, here's what I found nearby.`,
    `You've got some options for ${keyword} in the area.`,
    `There are a few ${keyword} within reach.`,
    `Looking for ${keyword}? Here's what's close by.`,
    `I found some ${keyword} options near you.`,
  ];
  
  const seed = sessionSeed ?? Math.floor(Math.random() * intros.length);
  const intro = intros[seed % intros.length];
  
  // Use standard formatting (not drive-only since we don't know the amenity type)
  const bullets = topResults.map(poi => formatBulletItem(poi, false)).join('\n');
  
  const sourceHint = getSourceHint(data.fetched_at);
  
  return `${intro}\n\n${bullets}${sourceHint}`;
}

export async function testPlacesHealth(schemeId: string): Promise<{
  hasLocation: boolean;
  lat?: number;
  lng?: number;
  apiKeyConfigured: boolean;
  liveCallSuccess: boolean;
  liveCallStatus?: string;
  liveCallError?: string;
  cacheExists: boolean;
  cacheCategories?: string[];
}> {
  const location = await getSchemeLocation(schemeId);
  const apiKeyConfigured = isApiKeyConfigured();
  
  let liveCallSuccess = false;
  let liveCallStatus: string | undefined;
  let liveCallError: string | undefined;

  if (location && apiKeyConfigured) {
    const testResult = await fetchFromGooglePlaces(location.lat, location.lng, 'supermarket');
    liveCallSuccess = testResult.success;
    liveCallStatus = testResult.errorCode;
    if (!testResult.success) {
      liveCallError = testResult.errorMessage;
    }
  }

  const cached = await db
    .select({ category: poi_cache.category })
    .from(poi_cache)
    .where(eq(poi_cache.scheme_id, schemeId));

  return {
    hasLocation: !!location,
    lat: location?.lat,
    lng: location?.lng,
    apiKeyConfigured,
    liveCallSuccess,
    liveCallStatus,
    liveCallError,
    cacheExists: cached.length > 0,
    cacheCategories: cached.map(c => c.category),
  };
}

export const FOLLOW_UP_CAPABILITY_MAP: Record<string, POICategory[]> = {
  'convenience stores': ['convenience_store'],
  'convenience store': ['convenience_store'],
  'local shops': ['convenience_store'],
  'shops': ['convenience_store'],
  'corner shop': ['convenience_store'],
  'shop': ['convenience_store'],
  'supermarkets': ['supermarket'],
  'supermarket': ['supermarket'],
  'groceries': ['supermarket'],
  'pharmacies': ['pharmacy'],
  'pharmacy': ['pharmacy'],
  'chemist': ['pharmacy'],
  'coffee': ['cafe'],
  'cafes': ['cafe'],
  'cafe': ['cafe'],
  'restaurants': ['restaurant'],
  'dining': ['restaurant'],
  'takeaway': ['restaurant'],
  'food': ['restaurant'],
  'parks': ['park'],
  'park': ['park'],
  'schools': ['primary_school', 'secondary_school'],
  'primary schools': ['primary_school'],
  'secondary schools': ['secondary_school'],
  'gyms': ['gym'],
  'gym': ['gym'],
  'fitness': ['gym'],
  'hospital': ['hospital'],
  'hospitals': ['hospital'],
  'gp': ['gp'],
  'doctors': ['gp'],
  'bus stops': ['bus_stop'],
  'bus routes': ['bus_stop'],
  'train stations': ['train_station'],
  'train': ['train_station'],
  'transport': ['train_station', 'bus_stop'],
  'childcare': ['childcare'],
  'creche': ['childcare'],
  'crèche': ['childcare'],
  'playgrounds': ['playground'],
  'playground': ['playground'],
  'pub': ['bar'],
  'pubs': ['bar'],
  'bar': ['bar'],
  'bars': ['bar'],
  'pint': ['bar'],
  'drink': ['bar'],
  'golf': ['golf_course'],
  'golf course': ['golf_course'],
  'golf courses': ['golf_course'],
  'golf club': ['golf_course'],
};

export async function canAnswerFollowUp(followUpPhrase: string, schemeId: string): Promise<boolean> {
  const normalizedPhrase = followUpPhrase.toLowerCase().trim();
  
  const categories = FOLLOW_UP_CAPABILITY_MAP[normalizedPhrase];
  if (!categories || categories.length === 0) {
    return false;
  }
  
  const location = await getSchemeLocation(schemeId);
  if (!location) {
    return false;
  }
  
  if (!isApiKeyConfigured()) {
    return false;
  }
  
  return true;
}

export function getFollowUpCategories(followUpPhrase: string): POICategory[] | null {
  const normalizedPhrase = followUpPhrase.toLowerCase().trim();
  return FOLLOW_UP_CAPABILITY_MAP[normalizedPhrase] || null;
}
