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
    const win = window as any;
    
    if (win.googleMapsLoaded && win.google?.maps) {
      resolve();
      return;
    }

    if (win.googleMapsLoading) {
      let timeoutId: NodeJS.Timeout;
      const checkLoaded = setInterval(() => {
        if (win.googleMapsLoaded && win.google?.maps) {
          clearInterval(checkLoaded);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 100);
      
      timeoutId = setTimeout(() => {
        clearInterval(checkLoaded);
        win.googleMapsLoading = false;
        reject(new Error('Google Maps load timeout'));
      }, 15000);
      
      return;
    }

    win.googleMapsLoading = true;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      win.googleMapsLoading = false;
      reject(new Error('Missing API key'));
      return;
    }

    win.googleMapsCallback = () => {
      win.googleMapsLoaded = true;
      win.googleMapsLoading = false;
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=googleMapsCallback`;
    script.async = true;
    script.onerror = () => {
      win.googleMapsLoading = false;
      reject(new Error('Failed to load Google Maps'));
    };
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

    const mapLat = latitude || 51.926500;
    const mapLng = longitude || -8.453200;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({
        styles: isDarkMode ? getDarkStyles() : getLightStyles(),
      });
      mapInstanceRef.current.setCenter({ lat: mapLat, lng: mapLng });
      
      if (homeMarkerRef.current) {
        homeMarkerRef.current.setPosition({ lat: mapLat, lng: mapLng });
        homeMarkerRef.current.setTitle(developmentName);
      }
      return;
    }

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

      const placesService = new window.google.maps.places.PlacesService(map);
      
      mapInstanceRef.current = map;
      placesServiceRef.current = placesService;
      homeMarkerRef.current = homeMarker;

      setMapLoaded(true);
    } catch (error) {
      console.error('[Maps] Error creating map:', error);
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

  const searchNearbyPlaces = useCallback((category: FilterCategory) => {
    if (!mapInstanceRef.current || !placesServiceRef.current) return;

    placeMarkersRef.current.forEach(marker => marker.setMap(null));
    placeMarkersRef.current = [];

    const mapLat = latitude || 51.926500;
    const mapLng = longitude || -8.453200;

    const request = {
      location: new window.google.maps.LatLng(mapLat, mapLng),
      radius: 2000,
      type: category.placeType,
    };

    placesServiceRef.current.nearbySearch(request, (results: any[], status: any) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const newLocations = results.map(place => ({
          ...place,
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
        }));
        setLocations(newLocations);

        results.forEach(place => {
          if (place.geometry?.location) {
            const marker = new window.google.maps.Marker({
              position: place.geometry.location,
              map: mapInstanceRef.current,
              title: place.name,
              icon: {
                path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                fillColor: '#D97706',
                fillOpacity: 1,
                strokeColor: '#FFFFFF',
                strokeWeight: 1.5,
                scale: 1.2,
                anchor: new window.google.maps.Point(12, 22),
              },
            });

            marker.addListener('click', () => {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const infoWindow = new window.google.maps.InfoWindow({
                content: `
                  <div style="padding: 12px; font-family: system-ui; max-width: 280px;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${place.name}</div>
                    <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">${place.vicinity || ''}</div>
                    ${place.rating ? `<div style="font-size: 12px; color: #F59E0B; margin-bottom: 8px;">⭐ ${place.rating}</div>` : ''}
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" 
                       target="_blank" rel="noopener noreferrer"
                       style="display: inline-block; padding: 8px 16px; background: linear-gradient(to right, #F59E0B, #D97706); 
                              color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">
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
      }
    });
  }, [latitude, longitude]);

  const handleFilterClick = useCallback((category: FilterCategory) => {
    if (selectedFilter === category.id) {
      setSelectedFilter(null);
      placeMarkersRef.current.forEach(marker => marker.setMap(null));
      placeMarkersRef.current = [];
      setLocations([]);
    } else {
      setSelectedFilter(category.id);
      searchNearbyPlaces(category);
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

  if (!mapLoaded) {
    return <MapSkeleton isDarkMode={isDarkMode} />;
  }

  return (
    <div className={`h-full flex flex-col ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      <div className="relative flex-1">
        <div ref={mapRef} className="absolute inset-0" />
        
        <div className="absolute bottom-4 left-0 right-0 px-4 z-10">
          <div className="overflow-x-auto pb-2 -mb-2">
            <div className="flex gap-2 w-max">
              {FILTER_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => handleFilterClick(category)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap shadow-lg ${
                    selectedFilter === category.id
                      ? 'bg-gold-500 text-white'
                      : isDarkMode
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {category.icon}
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {locations.length > 0 && (
        <div className={`max-h-48 overflow-y-auto border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          {locations.slice(0, 5).map((place, idx) => (
            <a
              key={place.place_id || idx}
              href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 p-3 border-b last:border-b-0 ${
                isDarkMode ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <MapPin className="w-5 h-5 text-gold-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {place.name}
                </p>
                <p className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {place.vicinity}
                </p>
              </div>
              {place.rating && (
                <div className="flex items-center gap-1 text-xs text-gold-500">
                  <Star className="w-3 h-3 fill-gold-500" />
                  {place.rating}
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
