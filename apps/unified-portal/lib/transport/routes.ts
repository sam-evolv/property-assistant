/**
 * Transport for Ireland — Route Enrichment
 *
 * Uses Google Directions API (transit mode) to discover which public transport
 * routes serve a development. Results are cached in poi_cache for 7 days.
 *
 * Requires: Directions API enabled on the Google Maps API key.
 */

import { db, scheme_profile, poi_cache } from '@openhouse/db';
import { eq, and } from 'drizzle-orm';

export interface TransitRoute {
  line_short_name: string;   // "202"
  line_name: string;         // "202 - Ballyvolane"
  vehicle_type: 'BUS' | 'RAIL' | 'TRAM' | 'SUBWAY' | 'FERRY' | 'OTHER';
  headsign: string;          // "Cork City Centre"
  departure_stop: string;    // "Ballyvolane SC"
  journey_min?: number;      // 25
  num_stops?: number;        // 8
}

export interface TransitRoutesResult {
  routes: TransitRoute[];
  destination: string;
  fetched_at: Date;
  from_cache: boolean;
  enabled: boolean; // false if Directions API not available
}

const TRANSIT_ROUTES_TTL_DAYS = 7;
const DIRECTIONS_TIMEOUT_MS = 10000;

function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
}

// Map county keywords to their city centre destinations for Directions API queries
const COUNTY_TO_CITY_CENTRE: Record<string, string> = {
  'cork': 'Cork City Centre, Cork, Ireland',
  'dublin': "O'Connell Street, Dublin 1, Ireland",
  'limerick': "O'Connell Street, Limerick, Ireland",
  'galway': 'Eyre Square, Galway, Ireland',
  'waterford': 'The Quay, Waterford, Ireland',
  'kilkenny': 'High Street, Kilkenny, Ireland',
  'wexford': 'Main Street, Wexford, Ireland',
  'wicklow': 'Main Street, Wicklow Town, Ireland',
  'kildare': 'Market Square, Naas, Kildare, Ireland',
  'meath': 'Market Square, Navan, Meath, Ireland',
  'louth': 'Clanbrassil Street, Dundalk, Louth, Ireland',
  'tipperary': 'Main Street, Clonmel, Tipperary, Ireland',
  'kerry': 'Main Street, Tralee, Kerry, Ireland',
  'clare': 'O\'Connell Street, Ennis, Clare, Ireland',
  'mayo': 'Shop Street, Castlebar, Mayo, Ireland',
  'sligo': "O'Connell Street, Sligo, Ireland",
  'roscommon': 'Main Street, Roscommon Town, Ireland',
  'longford': 'Main Street, Longford, Ireland',
  'westmeath': 'Pearse Street, Athlone, Westmeath, Ireland',
  'offaly': 'Main Street, Tullamore, Offaly, Ireland',
  'laois': 'Main Street, Portlaoise, Laois, Ireland',
  'carlow': 'Tullow Street, Carlow, Ireland',
  'monaghan': 'The Diamond, Monaghan, Ireland',
  'cavan': 'Main Street, Cavan, Ireland',
  'leitrim': 'Main Street, Carrick-on-Shannon, Leitrim, Ireland',
  'donegal': 'The Diamond, Donegal Town, Ireland',
};

function inferDestination(address: string | null | undefined): string {
  if (!address) return 'nearest city centre, Ireland';

  const lower = address.toLowerCase();
  for (const [county, destination] of Object.entries(COUNTY_TO_CITY_CENTRE)) {
    if (lower.includes(county)) return destination;
  }

  // Fallback: use "city centre" near the address
  return `city centre near ${address.split(',').slice(-2).join(',').trim()}`;
}

async function getSchemeLocation(schemeId: string): Promise<{ lat: number; lng: number; address?: string | null } | null> {
  const schemes = await db
    .select({ lat: scheme_profile.scheme_lat, lng: scheme_profile.scheme_lng, address: scheme_profile.scheme_address })
    .from(scheme_profile)
    .where(eq(scheme_profile.id, schemeId))
    .limit(1);

  if (schemes.length > 0 && schemes[0].lat && schemes[0].lng) {
    return { lat: schemes[0].lat, lng: schemes[0].lng, address: schemes[0].address };
  }
  return null;
}

// Returns a Unix timestamp for next weekday 9am — ensures transit schedules are active
function getNextWeekdayMorning(): number {
  const now = new Date();
  const target = new Date(now);
  const day = now.getDay();

  // If weekend, move to Monday
  if (day === 6) target.setDate(now.getDate() + 2);
  else if (day === 0) target.setDate(now.getDate() + 1);

  // If already past 10am on a weekday, use next weekday
  if (target.getDay() !== 0 && target.getDay() !== 6 && now.getHours() >= 10) {
    target.setDate(target.getDate() + 1);
    if (target.getDay() === 6) target.setDate(target.getDate() + 2);
    if (target.getDay() === 0) target.setDate(target.getDate() + 1);
  }

  target.setHours(9, 0, 0, 0);
  return Math.floor(target.getTime() / 1000);
}

async function getCachedTransitRoutes(schemeId: string, cacheKey: string): Promise<TransitRoutesResult | null> {
  try {
    const cached = await db
      .select()
      .from(poi_cache)
      .where(and(eq(poi_cache.scheme_id, schemeId), eq(poi_cache.category, cacheKey)))
      .limit(1);

    if (cached.length === 0) return null;

    const record = cached[0];
    const now = new Date();
    const fetchedAt = new Date(record.fetched_at);
    const ttlMs = record.ttl_days * 24 * 60 * 60 * 1000;
    if (now.getTime() - fetchedAt.getTime() > ttlMs) return null;

    const data = record.results_json as any;
    if (!data?.routes) return null;

    return { routes: data.routes, destination: data.destination, fetched_at: fetchedAt, from_cache: true, enabled: true };
  } catch {
    return null;
  }
}

async function storeTransitRoutesCache(
  schemeId: string,
  cacheKey: string,
  result: Omit<TransitRoutesResult, 'from_cache' | 'enabled'>
): Promise<void> {
  try {
    const existing = await db
      .select({ id: poi_cache.id })
      .from(poi_cache)
      .where(and(eq(poi_cache.scheme_id, schemeId), eq(poi_cache.category, cacheKey)))
      .limit(1);

    const payload = { routes: result.routes, destination: result.destination };
    const now = new Date();

    if (existing.length > 0) {
      await db.update(poi_cache)
        .set({ results_json: payload, fetched_at: now, ttl_days: TRANSIT_ROUTES_TTL_DAYS })
        .where(eq(poi_cache.id, existing[0].id));
    } else {
      await db.insert(poi_cache).values({
        scheme_id: schemeId,
        category: cacheKey,
        provider: 'google_directions_transit',
        results_json: payload,
        fetched_at: now,
        ttl_days: TRANSIT_ROUTES_TTL_DAYS,
      });
    }
  } catch (err) {
    console.error('[Transit] Cache store failed:', err);
  }
}

function parseTransitRoutes(directionsData: any): TransitRoute[] {
  const routesSeen = new Set<string>();
  const routes: TransitRoute[] = [];

  const allLegs = (directionsData.routes || []).flatMap((r: any) => r.legs || []);

  for (const leg of allLegs) {
    for (const step of leg.steps || []) {
      if (step.travel_mode !== 'TRANSIT') continue;

      const td = step.transit_details;
      if (!td?.line) continue;

      const shortName = td.line.short_name || td.line.name || 'Unknown';
      if (routesSeen.has(shortName)) continue;
      routesSeen.add(shortName);

      const vehicleType = (td.line.vehicle?.type || 'BUS').toUpperCase();
      const normalised: TransitRoute['vehicle_type'] =
        ['BUS', 'RAIL', 'TRAM', 'SUBWAY', 'FERRY'].includes(vehicleType)
          ? (vehicleType as TransitRoute['vehicle_type'])
          : 'OTHER';

      routes.push({
        line_short_name: shortName,
        line_name: td.line.name || shortName,
        vehicle_type: normalised,
        headsign: td.headsign || '',
        departure_stop: td.departure_stop?.name || '',
        journey_min: leg.duration ? Math.round(leg.duration.value / 60) : undefined,
        num_stops: td.num_stops,
      });
    }
  }

  // Sort: rail first, then by route name
  return routes.sort((a, b) => {
    const rank = (t: string) => t === 'RAIL' || t === 'SUBWAY' || t === 'TRAM' ? 0 : 1;
    if (rank(a.vehicle_type) !== rank(b.vehicle_type)) return rank(a.vehicle_type) - rank(b.vehicle_type);
    return a.line_short_name.localeCompare(b.line_short_name, undefined, { numeric: true });
  });
}

/**
 * Fetch transit routes serving a development's location.
 * Falls back gracefully if Directions API is not enabled on the key.
 */
export async function getTransitRoutes(schemeId: string): Promise<TransitRoutesResult> {
  const empty = (enabled = true): TransitRoutesResult => ({
    routes: [], destination: '', fetched_at: new Date(), from_cache: false, enabled,
  });

  const location = await getSchemeLocation(schemeId);
  if (!location) return empty();

  const destination = inferDestination(location.address);
  const cacheKey = `transit_routes:v1:${destination.substring(0, 40)}`;

  const cached = await getCachedTransitRoutes(schemeId, cacheKey);
  if (cached) {
    console.log('[Transit] Cache hit:', schemeId);
    return cached;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) return empty(false);

  const departureTime = getNextWeekdayMorning();

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${location.lat},${location.lng}`);
  url.searchParams.set('destination', destination);
  url.searchParams.set('mode', 'transit');
  url.searchParams.set('departure_time', departureTime.toString());
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('key', apiKey);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DIRECTIONS_TIMEOUT_MS);
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    const data = await response.json();
    console.log('[Transit] Directions API:', data.status, `(${data.routes?.length ?? 0} routes)`);

    // NOT_FOUND or REQUEST_DENIED likely means Directions API not enabled yet
    if (data.status === 'REQUEST_DENIED' || data.status === 'NOT_FOUND') {
      console.warn('[Transit] Directions API not available:', data.error_message);
      return empty(false);
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Transit] Directions API error:', data.status);
      return empty();
    }

    const routes = parseTransitRoutes(data);
    const result: TransitRoutesResult = { routes, destination, fetched_at: new Date(), from_cache: false, enabled: true };

    await storeTransitRoutesCache(schemeId, cacheKey, result);
    return result;
  } catch (error: any) {
    console.error('[Transit] Request failed:', error.message);
    return empty();
  }
}

function formatVehicleLabel(type: TransitRoute['vehicle_type']): string {
  switch (type) {
    case 'RAIL': return 'train';
    case 'TRAM': return 'tram/LUAS';
    case 'SUBWAY': return 'DART/Metro';
    case 'FERRY': return 'ferry';
    default: return 'bus';
  }
}

/**
 * Format a transport response combining route data (from Directions API)
 * with nearby stop data (from Google Places).
 */
export function formatTransitRoutesResponse(
  result: TransitRoutesResult,
  nearbyStops: Array<{ name: string; walk_time_min?: number; drive_time_min?: number }>,
): string {
  // If Directions API isn't enabled yet, fall back to basic stop list
  if (!result.enabled || result.routes.length === 0) {
    if (nearbyStops.length === 0) {
      return `I wasn't able to find public transport information for this area right now. Check routes and timetables at journeyplanner.transportforireland.ie or the TFI Live app.`;
    }

    const stopLines = nearbyStops.slice(0, 4).map(s => {
      let line = `- ${s.name}`;
      if (s.walk_time_min) line += ` (approx. ${s.walk_time_min} min walk)`;
      else if (s.drive_time_min) line += ` (approx. ${s.drive_time_min} min drive)`;
      return line;
    });

    return [
      `There are bus and rail stops nearby:`,
      '',
      ...stopLines,
      '',
      `For timetables and real-time departures, use the TFI Live app or journeyplanner.transportforireland.ie.`,
    ].join('\n');
  }

  const shortCity = result.destination.split(',')[0];
  const routeLines = result.routes.slice(0, 6).map(route => {
    const vehicle = formatVehicleLabel(route.vehicle_type);
    let line = `- **Route ${route.line_short_name}** (${vehicle})`;
    if (route.headsign) line += ` → ${route.headsign}`;
    if (route.departure_stop) line += `, from ${route.departure_stop}`;
    if (route.journey_min) line += ` — approx. ${route.journey_min} min journey`;
    if (route.num_stops) line += ` (${route.num_stops} stops)`;
    return line;
  });

  const dateStr = result.fetched_at.toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' });

  return [
    `You're well connected here. Routes serving this area toward ${shortCity}:`,
    '',
    ...routeLines,
    '',
    `Based on Google Maps transit data, last checked ${dateStr}.`,
    `For real-time departures and full timetables, use the **TFI Live app** or journeyplanner.transportforireland.ie.`,
  ].join('\n');
}
