import 'server-only';

/**
 * Server-side Google Places Details fetcher.
 *
 * Resolves a placeId returned by the JS Places autocomplete on the address
 * entry screen into the canonical address components + geometry we store.
 * Uses GOOGLE_MAPS_API_KEY (server-side, restricted to backend IPs) when
 * present, falling back to NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. This matches the
 * convention in lib/places/poi.ts and lib/transport/routes.ts.
 *
 * Returns null on any failure — orchestrator handles that as "address could
 * not be verified" and surfaces it to the UI.
 */

const PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const TIMEOUT_MS = 4000;

export type ResolvedAddress = {
  line1: string;
  line2?: string;
  town?: string;
  county?: string;
  eircode?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
};

type PlaceComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type PlacesDetailsResponse = {
  status: string;
  result?: {
    address_components?: PlaceComponent[];
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  };
  error_message?: string;
};

function getServerKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    || null
  );
}

export async function fetchPlaceDetails(
  placeId: string,
): Promise<ResolvedAddress | null> {
  const key = getServerKey();
  if (!key) {
    console.warn('[lettings-lookup][places] no google maps key configured');
    return null;
  }

  const url = new URL(PLACES_DETAILS_URL);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'address_components,formatted_address,geometry');
  url.searchParams.set('region', 'ie');
  url.searchParams.set('key', key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      console.warn(`[lettings-lookup][places] http status=${res.status}`);
      return null;
    }
    const json = (await res.json()) as PlacesDetailsResponse;
    if (json.status !== 'OK' || !json.result) {
      console.warn(
        `[lettings-lookup][places] places status=${json.status} error=${json.error_message ?? 'n/a'}`,
      );
      return null;
    }

    const components = json.result.address_components ?? [];
    const findComponent = (type: string) =>
      components.find((c) => c.types.includes(type));

    const streetNumber = findComponent('street_number')?.long_name;
    const route = findComponent('route')?.long_name;
    const subLocality = findComponent('sublocality')?.long_name
      ?? findComponent('neighborhood')?.long_name;
    const town =
      findComponent('postal_town')?.long_name
      ?? findComponent('locality')?.long_name
      ?? findComponent('administrative_area_level_3')?.long_name;
    const county = findComponent('administrative_area_level_1')?.long_name
      ?? findComponent('administrative_area_level_2')?.long_name;
    const eircode = findComponent('postal_code')?.long_name;

    const line1 = [streetNumber, route].filter(Boolean).join(' ').trim()
      || subLocality
      || json.result.formatted_address?.split(',')[0]
      || '';

    const result: ResolvedAddress = {
      line1,
      line2: streetNumber && route && subLocality ? subLocality : undefined,
      town,
      county,
      eircode: eircode ? eircode.toUpperCase() : undefined,
      lat: json.result.geometry?.location?.lat,
      lng: json.result.geometry?.location?.lng,
      formattedAddress: json.result.formatted_address,
    };

    console.log(
      `[lettings-lookup][places] ok eircode=${result.eircode ?? 'null'} duration_ms=${Date.now() - started}`,
    );
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[lettings-lookup][places] error reason=${message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function addressFromEircodeOnly(eircode: string): ResolvedAddress {
  // Without a paid Eircode API subscription we don't get street/town/lat
  // from an eircode alone. The agent will fill those on the review screen;
  // BER lookup still proceeds because eircode alone is enough for SEAI.
  // TODO Session 6.5: integrate Eircode API for free-text -> coordinate
  // resolution.
  return {
    line1: '',
    eircode: eircode.toUpperCase(),
  };
}
