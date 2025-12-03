/**
 * Geocoding Utility - Converts addresses to lat/lng coordinates using Google Geocoding API
 */

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address?: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      console.error('[Geocode] No Google Maps API key configured');
      return null;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    
    console.log(`[Geocode] Geocoding address: ${address}`);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results?.length) {
      console.warn(`[Geocode] Failed to geocode address: ${address}, status: ${data.status}`);
      return null;
    }

    const location = data.results[0].geometry.location;
    const result: GeocodeResult = {
      lat: location.lat,
      lng: location.lng,
      formatted_address: data.results[0].formatted_address,
    };

    console.log(`[Geocode] Successfully geocoded: ${address} -> (${result.lat}, ${result.lng})`);
    
    return result;
  } catch (error) {
    console.error('[Geocode] Error geocoding address:', error);
    return null;
  }
}

/**
 * Build full address string from unit fields
 */
export function buildFullAddress(unit: {
  address_line_1: string;
  address_line_2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
}): string {
  const parts = [
    unit.address_line_1,
    unit.address_line_2,
    unit.city,
    unit.state_province,
    unit.postal_code,
    unit.country,
  ].filter(Boolean);

  return parts.join(', ');
}
