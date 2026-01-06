# Google Places POI Engine

The POI (Points of Interest) Engine provides cache-first location search for scheme amenities using Google Places API.

## Overview

The engine queries Google Places Nearby Search to find amenities near a development scheme, caches results in the `poi_cache` table for 30 days, and optionally enriches results with walking/driving times using Google Distance Matrix API.

## Environment Variables

The following environment variables are required:

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps API key with Places and Distance Matrix enabled | Yes |
| `GOOGLE_MAPS_API_KEY` | Fallback API key (server-side only) | Optional |

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Places API (Nearby Search)
   - Distance Matrix API
   - Maps JavaScript API (for frontend map components)
3. Create an API key with appropriate restrictions
4. Add the key to your environment

## Supported Categories

| Category | Google Places Types | Keywords Filter |
|----------|---------------------|-----------------|
| `supermarket` | supermarket, grocery_or_supermarket | - |
| `pharmacy` | pharmacy | - |
| `gp` | doctor | - |
| `childcare` | school | creche, montessori, preschool, daycare, childcare, nursery |
| `primary_school` | primary_school, school | primary, national school, n.s., ns |
| `secondary_school` | secondary_school, school | secondary, college, post-primary, high school |
| `train_station` | train_station | - |
| `bus_stop` | bus_station, transit_station | - |

## API Usage

### Server-Side Function

```typescript
import { getNearbyPOIs, formatPOIResponse } from '@/lib/places/poi';

// Fetch POIs for a scheme
const poiData = await getNearbyPOIs(schemeId, 'supermarket');

// Format for user-facing response
const formattedResponse = formatPOIResponse(poiData, 'supermarket', 5);
```

### Response Shape

Each POI result contains:

```typescript
interface POIResult {
  name: string;           // Place name
  address: string;        // Vicinity or formatted address
  place_id: string;       // Google Places ID
  distance_km: number;    // Distance from scheme (straight-line)
  walk_time_min?: number; // Walking time (if available)
  drive_time_min?: number;// Driving time (if available)
  open_now?: boolean;     // Current open status (if provided by Google)
  rating?: number;        // Google rating (if available)
}

interface POICacheResult {
  results: POIResult[];   // Up to 10 results
  fetched_at: Date;       // When data was fetched
  from_cache: boolean;    // Whether result came from cache
}
```

## Location Resolution

The POI engine supports multiple methods to determine scheme location:

1. **Supabase Project Address** - Looks up the project's address and geocodes it using Google Geocoding API
2. **scheme_profile coordinates** - Uses stored lat/lng from the Developer Setup Form
3. **developments table** - Falls back to Drizzle developments table coordinates

### Geocoding Fallback

If the Supabase project has an address but no explicit coordinates, the engine will automatically geocode the address to get lat/lng coordinates. This ensures POI lookups work even if developers haven't explicitly set coordinates.

## Cache Behavior

- **TTL**: 30 days (configurable via `ttl_days` column)
- **Max Results**: 10 per category per scheme
- **Storage**: `poi_cache` table in PostgreSQL
- **Cache Key**: (scheme_id, category)

### Known Limitation: Cache FK Constraint

The `poi_cache` table has a foreign key to `scheme_profile(id)`. Since the chat system uses Supabase project IDs (not scheme_profile IDs), caching may fail silently if the scheme_profile record doesn't exist. The engine handles this gracefully by catching FK errors and continuing without caching.

**To enable full caching:**
1. Ensure each Supabase project has a corresponding `scheme_profile` record with matching ID
2. Or update the poi_cache table to remove the FK constraint

### Cache Flow

1. Check `poi_cache` for (schemeId, category) where `fetched_at` is within TTL
2. If fresh cache exists, return cached results
3. If cache is stale or missing:
   - Resolve location (geocoding if needed)
   - Fetch from Google Places Nearby Search
   - Optionally enrich with Distance Matrix times
   - Attempt to store in `poi_cache` (may fail due to FK constraint)
   - Return fresh results

## Assistant Integration

The chat API automatically detects location/amenities questions and routes them through the POI engine:

1. Intent classifier detects `location_amenities` intent
2. Category detector identifies which POI category the user is asking about
3. POI engine fetches/caches results
4. Response is formatted with "Last updated" timestamp

### Example Queries

- "Where is the nearest supermarket?"
- "What pharmacies are nearby?"
- "Is there a train station close by?"
- "Find me local schools"

## Database Schema

```sql
CREATE TABLE poi_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES scheme_profile(id),
    category TEXT NOT NULL,
    provider TEXT DEFAULT 'google_places' NOT NULL,
    results_json JSONB NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ttl_days INTEGER DEFAULT 30 NOT NULL
);

CREATE INDEX poi_cache_scheme_category_idx ON poi_cache(scheme_id, category);
```

## Error Handling

- If Google Places API fails, returns empty results with current timestamp
- If scheme has no lat/lng coordinates, returns empty results with helpful message
- If Distance Matrix fails, results still include straight-line distance
- Errors are logged but don't crash the request

## Cost Optimization

- Cache-first approach minimizes API calls
- Distance Matrix is called once per fetch (not per place)
- Only top 10 results are stored to reduce storage
- 30-day TTL balances freshness vs. cost
