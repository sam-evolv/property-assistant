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
  | 'places_no_location';

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
  | 'sports';

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
};

const DEFAULT_TTL_DAYS = 30;
const MAX_RESULTS = 10;
const SEARCH_RADIUS_METERS = 5000;
const PLACES_TIMEOUT_MS = 10000;

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

async function getCachedPOIs(schemeId: string, category: POICategory): Promise<CacheEntry | null> {
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
  const now = new Date();
  const fetchedAt = new Date(record.fetched_at);
  const ttlMs = record.ttl_days * 24 * 60 * 60 * 1000;
  const isFresh = now.getTime() - fetchedAt.getTime() <= ttlMs;

  return {
    results: record.results_json as POIResult[],
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
  category: POICategory
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
    url.searchParams.set('radius', SEARCH_RADIUS_METERS.toString());
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
  results: POIResult[]
): Promise<void> {
  try {
    const existing = await db
      .select({ id: poi_cache.id })
      .from(poi_cache)
      .where(and(
        eq(poi_cache.scheme_id, schemeId),
        eq(poi_cache.category, category)
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
          category: category,
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

  // STEP 1: Check scheme location FIRST - this is the authoritative gate
  // If scheme_profile has no coordinates, fail deterministically (no cache fallback)
  const location = await getSchemeLocation(schemeId);
  
  // Populate diagnostics with location info
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

  // DETERMINISTIC GATE: If no location in scheme_profile, fail immediately
  // Do NOT serve cached results - this ensures consistent behavior
  if (!location) {
    console.error(`[POI] Scheme ${schemeId} has no location set in scheme_profile - returning deterministic failure`);
    diagnostics.failure_reason = 'places_no_location';
    
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  // STEP 2: Check cache only after location is confirmed
  const cached = await getCachedPOIs(schemeId, category);
  if (cached && cached.is_fresh) {
    console.log(`[POI] Returning ${cached.results.length} fresh cached results`);
    diagnostics.cache_hit = true;
    return {
      results: cached.results,
      fetched_at: cached.fetched_at,
      from_cache: true,
      diagnostics,
    };
  }

  if (!isValidCoordinate(location.lat, location.lng)) {
    diagnostics.failure_reason = 'google_places_invalid_coordinates';
    diagnostics.places_error_message = `Invalid coordinates: lat=${location.lat}, lng=${location.lng}`;
    
    if (cached && cached.results.length > 0) {
      diagnostics.is_stale_cache = true;
      return {
        results: cached.results,
        fetched_at: cached.fetched_at,
        from_cache: true,
        is_stale: true,
        diagnostics,
      };
    }

    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  console.log(`[POI] Fetching fresh data from Google Places at ${location.lat}, ${location.lng}`);
  const fetchResult = await fetchFromGooglePlaces(location.lat, location.lng, category);

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
      lat: location.lat,
      lng: location.lng,
      http_status: fetchResult.httpStatus,
      api_status: fetchResult.errorCode,
      error_message: fetchResult.errorMessage,
      failure_reason: fetchResult.failureReason,
    });

    if (cached && cached.results.length > 0) {
      console.log('[POI] API failed, returning stale cache with', cached.results.length, 'results');
      diagnostics.is_stale_cache = true;
      return {
        results: cached.results,
        fetched_at: cached.fetched_at,
        from_cache: true,
        is_stale: true,
        diagnostics,
      };
    }

    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
      diagnostics,
    };
  }

  let results = fetchResult.results;

  if (results.length === 0) {
    diagnostics.failure_reason = 'no_places_results';
    
    if (cached && cached.results.length > 0) {
      console.log('[POI] No new results, returning stale cache');
      diagnostics.is_stale_cache = true;
      return {
        results: cached.results,
        fetched_at: cached.fetched_at,
        from_cache: true,
        is_stale: true,
        diagnostics,
      };
    }
  }

  if (results.length > 0) {
    console.log(`[POI] Fetching travel times for ${results.length} places`);
    results = await fetchTravelTimes(location.lat, location.lng, results);
    await storePOICache(schemeId, category, results);
    console.log(`[POI] Cached ${results.length} results`);
  }

  return {
    results,
    fetched_at: new Date(),
    from_cache: false,
    diagnostics,
  };
}

export interface FormatPOIOptions {
  developmentName?: string;
  category: POICategory;
  limit?: number;
}

export function formatPOIResponse(data: POICacheResult, options: FormatPOIOptions | POICategory, limit: number = 5): string {
  // Handle legacy signature
  const opts: FormatPOIOptions = typeof options === 'string' 
    ? { category: options, limit } 
    : { ...options, limit: options.limit ?? limit };
  
  const { developmentName, category } = opts;
  const resultLimit = opts.limit ?? 5;

  if (data.results.length === 0) {
    if (data.diagnostics?.failure_reason === 'places_no_location') {
      return `Nearby amenities are not enabled for this scheme yet because the development location has not been set. Ask the developer or admin to set the scheme location in Scheme Setup.`;
    }
    const placeAck = developmentName ? `Living in ${developmentName}, ` : '';
    return `${placeAck}I was not able to find any ${formatCategoryName(category)} within the local area. This may mean there are none within a reasonable distance, or the data is temporarily unavailable.`;
  }

  const topResults = data.results.slice(0, resultLimit);
  
  // Format each venue with qualitative distance when road distance unavailable
  const lines = topResults.map((poi) => {
    let distancePhrase: string;
    
    // Prefer road-based time over raw distance
    if (poi.drive_time_min) {
      distancePhrase = `${poi.drive_time_min} min drive`;
    } else if (poi.walk_time_min) {
      distancePhrase = `${poi.walk_time_min} min walk`;
    } else {
      // Fallback to qualitative phrasing when no road distance
      distancePhrase = getQualitativeDistance(poi.distance_km);
    }
    
    let line = `${poi.name} (${distancePhrase})`;
    
    if (poi.address) {
      line += `\n   ${poi.address}`;
    }
    
    return line;
  });

  // Acknowledge the place first
  const placeAck = developmentName ? `Living in ${developmentName}, you` : 'You';
  const header = getConversationalOpener(category, placeAck);
  
  // Group information meaningfully
  const body = lines.join('\n\n');
  
  // Gentle follow-up
  const followUp = getFollowUp(category);
  
  return header + body + followUp;
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
  };
  return openers[category] || `${placeAck}'ve some ${formatCategoryName(category)} nearby.\n\n`;
}

function getFollowUp(category: POICategory): string {
  const followUps: Record<POICategory, string> = {
    supermarket: '\n\nWould you like to know about local shops or convenience stores as well?',
    pharmacy: '\n\nLet me know if you need directions or GP information.',
    gp: '\n\nWould you like information on nearby pharmacies or hospitals?',
    hospital: '\n\nLet me know if you need GP or urgent care information.',
    childcare: '\n\nWould you like to know about nearby primary schools too?',
    primary_school: '\n\nWould you like information on secondary schools in the area?',
    secondary_school: '\n\nLet me know if you need information on other local amenities.',
    train_station: '\n\nWould you like to know about bus routes as well?',
    bus_stop: '\n\nWould you like to know about train stations nearby?',
    park: '\n\nWould you like to know about playgrounds for children?',
    playground: '\n\nLet me know if you need information on other family amenities.',
    gym: '\n\nWould you like to know about other leisure facilities?',
    leisure: '\n\nLet me know if you need any other local information.',
    cafe: '\n\nWould you like restaurant recommendations as well?',
    restaurant: '\n\nLet me know if you need any other local information.',
    sports: '\n\nWould you like to know about gyms or leisure centres?',
  };
  return followUps[category] || '\n\nLet me know if you need any other local information.';
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
  };
  return names[category] || category;
}

export function formatSchoolsResponse(data: POICacheResult, developmentName?: string): string {
  if (data.results.length === 0) {
    if (data.diagnostics?.failure_reason === 'places_no_location') {
      return `Nearby amenities are not enabled for this scheme yet because the development location has not been set. Ask the developer or admin to set the scheme location in Scheme Setup.`;
    }
    const placeAck = developmentName ? `Living in ${developmentName}, ` : '';
    return `${placeAck}I was not able to find any schools within the local area. This may mean there are none within a reasonable distance, or the data is temporarily unavailable.`;
  }

  const topResults = data.results.slice(0, 5);
  
  const lines = topResults.map((poi) => {
    let distancePhrase: string;
    
    if (poi.drive_time_min) {
      distancePhrase = `${poi.drive_time_min} min drive`;
    } else if (poi.walk_time_min) {
      distancePhrase = `${poi.walk_time_min} min walk`;
    } else {
      distancePhrase = getQualitativeDistance(poi.distance_km);
    }
    
    let line = `${poi.name} (${distancePhrase})`;
    
    if (poi.address) {
      line += `\n   ${poi.address}`;
    }
    
    return line;
  });

  const placeAck = developmentName ? `Living in ${developmentName}, you` : 'You';
  const header = `${placeAck}'ve schools nearby, including both primary and secondary options.\n\n`;
  
  const body = lines.join('\n\n');
  
  const followUp = '\n\nWould you like more details on any particular school, or information on childcare options?';
  
  return header + body + followUp;
}

export function formatShopsResponse(data: POICacheResult, developmentName?: string): string {
  if (data.results.length === 0) {
    if (data.diagnostics?.failure_reason === 'places_no_location') {
      return `Nearby amenities are not enabled for this scheme yet because the development location has not been set. Ask the developer or admin to set the scheme location in Scheme Setup.`;
    }
    const placeAck = developmentName ? `Living in ${developmentName}, ` : '';
    return `${placeAck}I was not able to find any shops within the local area. This may mean there are none within a reasonable distance, or the data is temporarily unavailable.`;
  }

  const topResults = data.results.slice(0, 5);
  
  const lines = topResults.map((poi) => {
    let distancePhrase: string;
    
    if (poi.drive_time_min) {
      distancePhrase = `${poi.drive_time_min} min drive`;
    } else if (poi.walk_time_min) {
      distancePhrase = `${poi.walk_time_min} min walk`;
    } else {
      distancePhrase = getQualitativeDistance(poi.distance_km);
    }
    
    let line = `${poi.name} (${distancePhrase})`;
    
    if (poi.address) {
      line += `\n   ${poi.address}`;
    }
    
    return line;
  });

  const placeAck = developmentName ? `Living in ${developmentName}, you` : 'You';
  const header = `${placeAck}'ve good shopping options nearby.\n\n`;
  
  const body = lines.join('\n\n');
  
  const followUp = '\n\nWould you like more specific information on supermarkets or other local amenities?';
  
  return header + body + followUp;
}

export type ExpandedIntent = 'schools' | 'shops';

export interface POICategoryResult {
  category: POICategory | null;
  expandedIntent?: ExpandedIntent;
  categories?: POICategory[];
}

export function detectPOICategory(query: string): POICategory | null {
  return detectPOICategoryExpanded(query).category;
}

export function detectPOICategoryExpanded(query: string): POICategoryResult {
  const q = query.toLowerCase();
  
  // Check for expanded intents first
  // "schools" = primary + secondary by default
  if (/\bschools?\b/i.test(q) && !/primary|secondary|national|high|post.?primary/i.test(q)) {
    return { 
      category: 'primary_school', 
      expandedIntent: 'schools',
      categories: ['primary_school', 'secondary_school']
    };
  }
  
  // "shops" = supermarkets + convenience
  if (/\bshops?\b/i.test(q) && !/supermarket|grocery|grocer/i.test(q)) {
    return { 
      category: 'supermarket', 
      expandedIntent: 'shops',
      categories: ['supermarket']
    };
  }
  
  // Specific category detection
  if (/supermarket|grocery|grocer|tesco|aldi|lidl|dunnes|spar/i.test(q)) {
    return { category: 'supermarket' };
  }
  if (/pharmac|chemist|boots|lloyds/i.test(q)) return { category: 'pharmacy' };
  if (/\bhospital\b/i.test(q)) return { category: 'hospital' };
  if (/\b(gp|doctor|surgery|clinic|medical|health\s*cent)/i.test(q)) return { category: 'gp' };
  if (/childcare|creche|montessori|nursery|daycare|preschool/i.test(q)) return { category: 'childcare' };
  if (/primary\s*school|national\s*school/i.test(q)) return { category: 'primary_school' };
  if (/secondary\s*school|high\s*school|post.?primary|college/i.test(q)) return { category: 'secondary_school' };
  if (/train|rail|dart|luas|station/i.test(q)) return { category: 'train_station' };
  if (/bus|bus\s*stop|transit/i.test(q)) return { category: 'bus_stop' };
  if (/\bplayground\b|play\s*area|play\s*ground/i.test(q)) return { category: 'playground' };
  if (/\bpark\b/i.test(q)) return { category: 'park' };
  if (/\bgym\b|fitness|workout/i.test(q)) return { category: 'gym' };
  if (/leisure|swimming|pool|spa/i.test(q)) return { category: 'leisure' };
  if (/\bcafe\b|coffee/i.test(q)) return { category: 'cafe' };
  if (/restaurant|takeaway|food|dining|eat/i.test(q)) return { category: 'restaurant' };
  if (/sports?\s*(facility|facilities|centre|center)/i.test(q)) return { category: 'sports' };
  
  if (/near(by|est)?\s+(amenities|facilities|services)/i.test(q)) return { category: 'supermarket' };
  
  return { category: null };
}

export const SUPPORTED_CATEGORIES = Object.keys(CATEGORY_MAPPINGS) as POICategory[];

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
