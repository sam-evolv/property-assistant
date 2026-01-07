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
  | 'sports';

const CATEGORY_MAPPINGS: Record<POICategory, { types: string[]; keywords?: string[] }> = {
  supermarket: { types: ['supermarket', 'grocery_or_supermarket'] },
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

function getGoogleMapsApiKey(): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error('Google Maps API key not configured');
  }
  return key;
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

async function getSchemeLocation(supabaseProjectId: string): Promise<{ lat: number; lng: number; schemeProfileId?: string } | null> {
  console.log('[POI] Looking up location for supabaseProjectId:', supabaseProjectId);
  
  try {
    const supabase = getSupabaseClient();
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('name, address')
      .eq('id', supabaseProjectId)
      .single();

    if (projectError || !projectData) {
      console.error('[POI] Supabase project lookup failed:', projectError);
    } else {
      console.log('[POI] Found Supabase project:', projectData.name);
      
      if (projectData.address) {
        const geocoded = await geocodeAddress(projectData.address);
        if (geocoded) {
          console.log('[POI] Geocoded address:', projectData.address, '->', geocoded.lat, geocoded.lng);
          return geocoded;
        }
      }
    }
  } catch (err) {
    console.error('[POI] Supabase lookup error:', err);
  }

  const schemes = await db
    .select({ 
      id: scheme_profile.id,
      lat: scheme_profile.scheme_lat, 
      lng: scheme_profile.scheme_lng 
    })
    .from(scheme_profile)
    .where(eq(scheme_profile.id, supabaseProjectId))
    .limit(1);

  if (schemes.length > 0 && schemes[0].lat && schemes[0].lng) {
    console.log('[POI] Found location in scheme_profile by ID');
    return {
      lat: schemes[0].lat,
      lng: schemes[0].lng,
      schemeProfileId: schemes[0].id,
    };
  }

  const devs = await db
    .select({ lat: developments.latitude, lng: developments.longitude })
    .from(developments)
    .where(eq(developments.id, supabaseProjectId))
    .limit(1);

  if (devs.length > 0 && devs[0].lat && devs[0].lng) {
    console.log('[POI] Found location in developments table');
    return {
      lat: parseFloat(devs[0].lat),
      lng: parseFloat(devs[0].lng),
    };
  }

  console.log('[POI] No location found for:', supabaseProjectId);
  return null;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const apiKey = getGoogleMapsApiKey();
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

async function getCachedPOIs(schemeId: string, category: POICategory): Promise<POICacheResult | null> {
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
  const isStale = now.getTime() - fetchedAt.getTime() > ttlMs;

  if (isStale) {
    console.log(`[POI] Cache stale for ${category} in scheme ${schemeId}`);
    return null;
  }

  return {
    results: record.results_json as POIResult[],
    fetched_at: fetchedAt,
    from_cache: true,
  };
}

async function fetchFromGooglePlaces(
  lat: number,
  lng: number,
  category: POICategory
): Promise<POIResult[]> {
  const apiKey = getGoogleMapsApiKey();
  const mapping = CATEGORY_MAPPINGS[category];
  const allResults: any[] = [];

  for (const placeType of mapping.types) {
    const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json');
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('radius', SEARCH_RADIUS_METERS.toString());
    url.searchParams.set('type', placeType);
    url.searchParams.set('key', apiKey);

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status === 'OK' && data.results) {
        allResults.push(...data.results);
      } else if (data.status !== 'ZERO_RESULTS') {
        console.error(`[POI] Google Places API error for ${placeType}:`, data.status, data.error_message);
      }
    } catch (error) {
      console.error(`[POI] Failed to fetch ${placeType}:`, error);
    }
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
  return results.slice(0, MAX_RESULTS);
}

async function fetchTravelTimes(
  originLat: number,
  originLng: number,
  places: POIResult[]
): Promise<POIResult[]> {
  if (places.length === 0) return places;

  const apiKey = getGoogleMapsApiKey();
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

  const cached = await getCachedPOIs(schemeId, category);
  if (cached) {
    console.log(`[POI] Returning ${cached.results.length} cached results`);
    return cached;
  }

  const location = await getSchemeLocation(schemeId);
  if (!location) {
    console.error(`[POI] Scheme ${schemeId} has no location set`);
    return {
      results: [],
      fetched_at: new Date(),
      from_cache: false,
    };
  }

  console.log(`[POI] Fetching fresh data from Google Places at ${location.lat}, ${location.lng}`);
  let results = await fetchFromGooglePlaces(location.lat, location.lng, category);

  if (results.length > 0) {
    console.log(`[POI] Fetching travel times for ${results.length} places`);
    results = await fetchTravelTimes(location.lat, location.lng, results);
  }

  await storePOICache(schemeId, category, results);
  console.log(`[POI] Cached ${results.length} results`);

  return {
    results,
    fetched_at: new Date(),
    from_cache: false,
  };
}

export function formatPOIResponse(data: POICacheResult, category: POICategory, limit: number = 5): string {
  if (data.results.length === 0) {
    return `I couldn't find any ${formatCategoryName(category)} nearby. The scheme may not have location coordinates set, or there are none within 5km.`;
  }

  const topResults = data.results.slice(0, limit);
  const lines = topResults.map((poi, idx) => {
    let line = `${idx + 1}. **${poi.name}** - ${poi.distance_km}km away`;
    
    const times: string[] = [];
    if (poi.walk_time_min) times.push(`${poi.walk_time_min} min walk`);
    if (poi.drive_time_min) times.push(`${poi.drive_time_min} min drive`);
    if (times.length > 0) {
      line += ` (${times.join(', ')})`;
    }
    
    if (poi.address) {
      line += `\n   ${poi.address}`;
    }
    
    if (poi.open_now !== undefined) {
      line += poi.open_now ? ' - *Open now*' : ' - *Currently closed*';
    }
    
    return line;
  });

  const header = `Here are the nearest ${formatCategoryName(category)}:\n\n`;
  const footer = `\n\n*Last updated: ${data.fetched_at.toLocaleDateString('en-IE', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  })}*`;

  return header + lines.join('\n\n') + footer;
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

export function detectPOICategory(query: string): POICategory | null {
  const q = query.toLowerCase();
  
  if (/supermarket|grocery|shop|grocer|tesco|aldi|lidl|dunnes|spar/i.test(q)) return 'supermarket';
  if (/pharmac|chemist|boots|lloyds/i.test(q)) return 'pharmacy';
  if (/\bhospital\b/i.test(q)) return 'hospital';
  if (/\b(gp|doctor|surgery|clinic|medical|health\s*cent)/i.test(q)) return 'gp';
  if (/childcare|creche|montessori|nursery|daycare|preschool/i.test(q)) return 'childcare';
  if (/primary\s*school|national\s*school/i.test(q)) return 'primary_school';
  if (/secondary\s*school|high\s*school|post.?primary|college/i.test(q)) return 'secondary_school';
  if (/train|rail|dart|luas|station/i.test(q)) return 'train_station';
  if (/bus|bus\s*stop|transit/i.test(q)) return 'bus_stop';
  if (/\bplayground\b|play\s*area|play\s*ground/i.test(q)) return 'playground';
  if (/\bpark\b/i.test(q)) return 'park';
  if (/\bgym\b|fitness|workout/i.test(q)) return 'gym';
  if (/leisure|swimming|pool|spa/i.test(q)) return 'leisure';
  if (/\bcafe\b|coffee/i.test(q)) return 'cafe';
  if (/restaurant|takeaway|food|dining|eat/i.test(q)) return 'restaurant';
  if (/sports?\s*(facility|facilities|centre|center)/i.test(q)) return 'sports';
  
  if (/school/i.test(q)) return 'primary_school';
  if (/near(by|est)?\s+(amenities|facilities|shops|services)/i.test(q)) return 'supermarket';
  
  return null;
}

export const SUPPORTED_CATEGORIES = Object.keys(CATEGORY_MAPPINGS) as POICategory[];
