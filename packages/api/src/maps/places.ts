/**
 * Google Places API Integration - Fetches Points of Interest (POIs) with smart categorization
 */

export interface PlaceSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  address?: string;
  rating?: number;
  user_ratings_total?: number;
  open_now?: boolean;
  price_level?: number;
}

export interface POIsByCategory {
  groceries: PlaceSummary[];
  schools: PlaceSummary[];
  parks: PlaceSummary[];
  cafes: PlaceSummary[];
  fitness: PlaceSummary[];
  health: PlaceSummary[];
  transport: PlaceSummary[];
}

// Smart category configuration with user-friendly labels and Google Places types
const CATEGORY_CONFIG = {
  groceries: { 
    label: 'Groceries & Essentials', 
    types: ['supermarket', 'grocery_or_supermarket', 'convenience_store'],
    icon: '🛒'
  },
  schools: { 
    label: 'Schools & Education', 
    types: ['primary_school', 'secondary_school', 'school'],
    icon: '🎓'
  },
  parks: { 
    label: 'Parks & Green Areas', 
    types: ['park'],
    icon: '🌳'
  },
  cafes: { 
    label: 'Cafés & Restaurants', 
    types: ['cafe', 'restaurant', 'bakery'],
    icon: '☕'
  },
  fitness: { 
    label: 'Gyms & Fitness', 
    types: ['gym'],
    icon: '💪'
  },
  health: { 
    label: 'Health & Pharmacy', 
    types: ['pharmacy', 'doctor', 'hospital'],
    icon: '⚕️'
  },
  transport: { 
    label: 'Public Transport', 
    types: ['bus_station', 'train_station', 'transit_station'],
    icon: '🚌'
  },
} as const;

export type CategoryKey = keyof typeof CATEGORY_CONFIG;

/**
 * Fetch nearby places for a specific category
 */
async function fetchNearbyPlaces(
  lat: number, 
  lng: number, 
  type: string, 
  radius: number = 2500
): Promise<PlaceSummary[]> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      return [];
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return [];
    }

    if (!data.results || data.results.length === 0) {
      return [];
    }

    // Take top 10 results
    const places: PlaceSummary[] = data.results.slice(0, 10).map((place: any) => ({
      id: place.place_id,
      name: place.name,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      category: type,
      address: place.vicinity,
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      open_now: place.opening_hours?.open_now,
      price_level: place.price_level,
    }));

    return places;
  } catch (error) {
    return [];
  }
}

/**
 * Fetch all POI categories around a location
 */
export async function fetchAllPOIs(lat: number, lng: number): Promise<POIsByCategory> {
  // Fetch all categories in parallel for performance
  const [groceries, schools, parks, cafes, fitness, health, transport] = await Promise.all([
    fetchNearbyPlaces(lat, lng, CATEGORY_CONFIG.groceries.types[0]),
    fetchNearbyPlaces(lat, lng, CATEGORY_CONFIG.schools.types[0]),
    fetchNearbyPlaces(lat, lng, CATEGORY_CONFIG.parks.types[0]),
    fetchNearbyPlaces(lat, lng, CATEGORY_CONFIG.cafes.types[0]),
    fetchNearbyPlaces(lat, lng, CATEGORY_CONFIG.fitness.types[0]),
    fetchNearbyPlaces(lat, lng, CATEGORY_CONFIG.health.types[0]),
    fetchNearbyPlaces(lat, lng, CATEGORY_CONFIG.transport.types[0]),
  ]);

  return {
    groceries,
    schools,
    parks,
    cafes,
    fitness,
    health,
    transport,
  };
}

/**
 * Get category configuration for UI
 */
export function getCategoryConfig() {
  return CATEGORY_CONFIG;
}
