'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Building2, Beer, Coffee, Hammer, Dog, School, Zap, Fuel as FuelIcon, ShoppingCart, Trees, Store, X, Phone, Globe, Clock, Star, MapPin, Loader2 } from 'lucide-react';

interface OptimizedMapsTabProps {
  address: string;
  eircode?: string;
  developmentName: string;
  latitude?: number | null;
  longitude?: number | null;
  isDarkMode: boolean;
  selectedLanguage: string;
}

interface FilterCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  placeType: string;
}

interface FavoritePlace {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const FILTER_CATEGORIES: FilterCategory[] = [
  { id: 'banking', label: 'Banking', icon: <Building2 className="w-4 h-4" />, placeType: 'bank' },
  { id: 'bars', label: 'Bars', icon: <Beer className="w-4 h-4" />, placeType: 'bar' },
  { id: 'cafes', label: 'Cafés', icon: <Coffee className="w-4 h-4" />, placeType: 'cafe' },
  { id: 'diy', label: 'DIY', icon: <Hammer className="w-4 h-4" />, placeType: 'hardware_store' },
  { id: 'dog_parks', label: 'Dog Parks', icon: <Dog className="w-4 h-4" />, placeType: 'park' },
  { id: 'schools', label: 'Schools', icon: <School className="w-4 h-4" />, placeType: 'school' },
  { id: 'ev_charging', label: 'EV Charging', icon: <Zap className="w-4 h-4" />, placeType: 'electric_vehicle_charging_station' },
  { id: 'fuel', label: 'Fuel', icon: <FuelIcon className="w-4 h-4" />, placeType: 'gas_station' },
  { id: 'groceries', label: 'Groceries', icon: <ShoppingCart className="w-4 h-4" />, placeType: 'supermarket' },
  { id: 'restaurants', label: 'Restaurants', icon: <Store className="w-4 h-4" />, placeType: 'restaurant' },
  { id: 'gyms', label: 'Gyms', icon: <Trees className="w-4 h-4" />, placeType: 'gym' },
];


const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Already loaded?
    if (window.google?.maps?.Map) {
      resolve();
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Missing Google Maps API key'));
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // Wait for it to load
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 15 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google?.maps?.Map) {
          reject(new Error('Google Maps timeout'));
        }
      }, 15000);
      return;
    }

    // Create global callback
    const callbackName = 'initGoogleMaps_' + Date.now();
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve();
    };

    // Load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
};

const MapSkeleton = memo(function MapSkeleton({ isDarkMode }: { isDarkMode: boolean }) {
  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`flex-1 relative ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'} animate-pulse`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`}>
              <Loader2 className={`w-8 h-8 animate-spin ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
            </div>
            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading map...
            </p>
          </div>
        </div>
        <div className="absolute top-4 left-4 right-4">
          <div className={`h-10 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
        </div>
        <div className="absolute bottom-4 left-4 right-4 overflow-x-auto">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`h-8 w-20 rounded-full shrink-0 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-300'}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function OptimizedMapsTab({
  address,
  eircode,
  developmentName,
  latitude,
  longitude,
  isDarkMode,
  selectedLanguage,
}: OptimizedMapsTabProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  
  const mapInstanceRef = useRef<any>(null);
  const placesServiceRef = useRef<any>(null);
  const placeMarkersRef = useRef<any[]>([]);
  const favoriteMarkersRef = useRef<Map<string, any>>(new Map());
  const homeMarkerRef = useRef<any>(null);

  useEffect(() => {
    const savedFavorites = localStorage.getItem('map_favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Failed to load favorites:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('map_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    let mounted = true;

    const initializeMap = async () => {
      try {
        await loadGoogleMapsScript();
        if (!mounted) return;
        setScriptLoaded(true);
      } catch (error) {
        console.error('[Maps] Failed to load script:', error);
        if (mounted) setMapError(true);
      }
    };

    initializeMap();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!scriptLoaded || !mapRef.current) return;
    
    // Already have a map? Just update it
    if (mapInstanceRef.current) {
      const mapLat = latitude || 53.2707;
      const mapLng = longitude || -6.2728;
      mapInstanceRef.current.setOptions({
        styles: isDarkMode ? getDarkStyles() : getLightStyles(),
      });
      mapInstanceRef.current.setCenter({ lat: mapLat, lng: mapLng });
      if (homeMarkerRef.current) {
        homeMarkerRef.current.setPosition({ lat: mapLat, lng: mapLng });
      }
      return;
    }

    // Create new map
    if (!window.google?.maps?.Map) {
      setMapError(true);
      return;
    }

    const mapLat = latitude || 53.2707;  // Default: Dublin
    const mapLng = longitude || -6.2728;

    try {
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: mapLat, lng: mapLng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
        styles: isDarkMode ? getDarkStyles() : getLightStyles(),
      });

      const homeMarker = new window.google.maps.Marker({
        position: { lat: mapLat, lng: mapLng },
        map: map,
        title: developmentName,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: '#F59E0B',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 2,
          anchor: new window.google.maps.Point(12, 22),
        },
        animation: window.google.maps.Animation.DROP,
      });

      // Places service for nearby search
      if (window.google.maps.places) {
        placesServiceRef.current = new window.google.maps.places.PlacesService(map);
      }
      
      mapInstanceRef.current = map;
      homeMarkerRef.current = homeMarker;
      setMapLoaded(true);
    } catch (error) {
      console.error('[Maps] Error:', error);
      setMapError(true);
    }
  }, [scriptLoaded, latitude, longitude, developmentName, isDarkMode]);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;
    
    favorites.forEach(fav => {
      if (!favoriteMarkersRef.current.has(fav.place_id)) {
        const marker = new window.google.maps.Marker({
          position: { lat: fav.lat, lng: fav.lng },
          map: mapInstanceRef.current,
          title: fav.name,
          icon: {
            path: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
            fillColor: '#EF4444',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1.2,
            anchor: new window.google.maps.Point(12, 21),
          },
        });
        favoriteMarkersRef.current.set(fav.place_id, marker);
      }
    });

    favoriteMarkersRef.current.forEach((marker, placeId) => {
      if (!favorites.some(f => f.place_id === placeId)) {
        marker.setMap(null);
        favoriteMarkersRef.current.delete(placeId);
      }
    });
  }, [favorites, mapLoaded]);

  const searchNearbyPlaces = useCallback((category: FilterCategory, filterId: string) => {
    if (!mapInstanceRef.current || !placesServiceRef.current) {
      console.log('[Maps] Search skipped - no map or places service');
      return;
    }

    // Clear old markers immediately
    placeMarkersRef.current.forEach(marker => marker.setMap(null));
    placeMarkersRef.current = [];
    setLocations([]); // Clear list while searching

    const mapLat = latitude || 53.2707;
    const mapLng = longitude || -6.2728;

    console.log('[Maps] Searching for', category.placeType, 'near', mapLat, mapLng);

    const request = {
      location: new window.google.maps.LatLng(mapLat, mapLng),
      radius: 3000,
      type: category.placeType,
    };

    placesServiceRef.current.nearbySearch(request, (results: any[], status: any) => {
      console.log('[Maps] Search results:', status, results?.length || 0, 'places');
      
      // Only update if this filter is still selected (prevent race conditions)
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const newLocations = results.map(place => ({
          ...place,
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
          categoryId: filterId, // Track which category these results belong to
        }));
        
        setLocations(newLocations);
        console.log('[Maps] Updated locations list with', newLocations.length, 'places for', filterId);

        // Create gold markers for each result
        results.forEach((place, index) => {
          if (place.geometry?.location) {
            const marker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: mapInstanceRef.current,
              title: place.name,
              icon: {
                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                fillColor: '#F59E0B',
                fillOpacity: 1,
                strokeColor: '#92400E',
                strokeWeight: 2,
                scale: 1.5,
                anchor: new window.google.maps.Point(12, 22),
              },
              animation: index < 5 ? window.google.maps.Animation.DROP : undefined,
              zIndex: 1000 + index,
            });

            marker.addListener('click', () => {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const infoWindow = new window.google.maps.InfoWindow({
                content: `
                  <div style="padding: 16px 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 300px; min-width: 220px;">
                    <div style="font-weight: 700; font-size: 16px; color: #1f2937; margin-bottom: 6px; line-height: 1.3;">${place.name}</div>
                    <div style="font-size: 13px; color: #6b7280; margin-bottom: 10px; line-height: 1.4;">${place.vicinity || ''}</div>
                    ${place.rating ? `
                      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 14px;">
                        <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: linear-gradient(135deg, #fbbf24, #f59e0b); border-radius: 4px;">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        </span>
                        <span style="font-size: 14px; font-weight: 600; color: #d97706;">${place.rating}</span>
                      </div>
                    ` : '<div style="margin-bottom: 14px;"></div>'}
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 20px; 
                              background: linear-gradient(135deg, #f59e0b, #d97706); 
                              color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;
                              box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35); transition: all 0.2s; width: 100%; text-align: center;">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>
                      Navigate
                    </a>
                  </div>
                `,
              });
              infoWindow.open(mapInstanceRef.current, marker);
            });

            placeMarkersRef.current.push(marker);
          }
        });
        
        console.log('[Maps] Created', placeMarkersRef.current.length, 'gold markers');
      } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        console.log('[Maps] No results found for', category.placeType);
        setLocations([]);
      }
    });
  }, [latitude, longitude]);

  const handleFilterClick = useCallback((category: FilterCategory) => {
    if (selectedFilter === category.id) {
      // Deselect - clear everything
      setSelectedFilter(null);
      placeMarkersRef.current.forEach(marker => marker.setMap(null));
      placeMarkersRef.current = [];
      setLocations([]);
    } else {
      // Select new filter
      setSelectedFilter(category.id);
      searchNearbyPlaces(category, category.id);
    }
  }, [selectedFilter, searchNearbyPlaces]);

  if (mapError) {
    return (
      <div className={`h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="text-center p-6">
          <MapPin className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
          <p className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Unable to load map
          </p>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Please check your connection and try again
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Map container - takes remaining space */}
      <div className="relative flex-1 min-h-0">
        {/* Always render the map container so mapRef is available for the Google Maps initialization */}
        <div ref={mapRef} className="absolute inset-0" />
        
        {/* Show loading overlay while map is loading */}
        {!mapLoaded && (
          <div className="absolute inset-0 z-10">
            <MapSkeleton isDarkMode={isDarkMode} />
          </div>
        )}
      </div>
      
      {/* Filter bar - Fixed at bottom, always visible */}
      <div className={`flex-shrink-0 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} px-3 py-2`}>
        <div className="overflow-x-auto pb-1 -mb-1">
          <div className="flex gap-2 w-max">
            {FILTER_CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleFilterClick(category)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shadow-sm ${
                  selectedFilter === category.id
                    ? 'bg-gold-500 text-white shadow-gold-500/30'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {category.icon}
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {locations.length > 0 && (
        <div className={`max-h-56 overflow-y-auto border-t ${isDarkMode ? 'border-gray-700 bg-gray-800/95' : 'border-gray-200 bg-white/95'} backdrop-blur-sm`}>
          {locations.slice(0, 8).map((place, idx) => (
            <a
              key={place.place_id || idx}
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-4 px-4 py-3.5 border-b last:border-b-0 transition-all duration-150 ${
                isDarkMode 
                  ? 'border-gray-700/60 hover:bg-gray-700/80 active:bg-gray-600' 
                  : 'border-gray-100 hover:bg-gold-50/50 active:bg-gold-100/50'
              }`}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${
                isDarkMode 
                  ? 'bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/30' 
                  : 'bg-gradient-to-br from-gold-50 to-gold-100 border border-gold-200'
              }`}>
                <MapPin className={`w-5 h-5 ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm truncate leading-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {place.name}
                </p>
                <p className={`text-xs truncate mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {place.vicinity}
                </p>
              </div>
              {place.rating && (
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                  isDarkMode ? 'bg-gold-500/20' : 'bg-gold-50 border border-gold-200'
                }`}>
                  <Star className={`w-3.5 h-3.5 ${isDarkMode ? 'text-gold-400 fill-gold-400' : 'text-gold-500 fill-gold-500'}`} />
                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-gold-400' : 'text-gold-600'}`}>{place.rating}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function getDarkStyles() {
  return [
    { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2937' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#374151' }] },
  ];
}

function getLightStyles() {
  return [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
  ];
}
