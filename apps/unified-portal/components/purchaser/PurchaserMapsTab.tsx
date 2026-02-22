'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Building2, Beer, Coffee, Hammer, Dog, School, Zap, Fuel as FuelIcon, ShoppingCart, Trees, Cross, Store, X, Phone, Globe, Clock, Star, Search, Heart } from 'lucide-react';
import { getTranslations } from '../../lib/translations';

interface FavoritePlace {
  place_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface PurchaserMapsTabProps {
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

interface PlaceData {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: any;
  rating?: number;
  user_ratings_total?: number;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: any;
  reviews?: any[];
  photos?: any[];
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

// Premium Info Panel Component
const PremiumInfoPanel = ({ place, isDarkMode, onClose }: { place: any; isDarkMode: boolean; onClose: () => void }) => (
  <div className={`w-full rounded-xl shadow-xl border ${isDarkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'}`}>
    {/* Header with close button */}
    <div className="flex items-start justify-between px-4 py-3 border-b border-[#2A2A2A]">
      <div className="flex-1">
        <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {place.name}
        </h3>
        <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#B0B0B0]' : 'text-gray-600'}`}>
          {place.formatted_address || place.vicinity}
        </p>
      </div>
      <button onClick={onClose} className={`p-1 rounded-lg transition ${isDarkMode ? 'hover:bg-[#252525]' : 'hover:bg-gray-100'}`}>
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Photo */}
    {place.photos?.[0] && (
      <div className="px-4 pt-3">
        <img src={place.photos[0].getUrl?.({ maxWidth: 400, maxHeight: 200 })} alt={place.name} className="w-full h-40 object-cover rounded-lg" />
      </div>
    )}

    {/* Rating & Details */}
    <div className="px-4 py-3 space-y-2">
      {place.rating && (
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-gold-400 fill-gold-400" />
          <span className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {place.rating} <span className={`text-xs ${isDarkMode ? 'text-[#B0B0B0]' : 'text-gray-600'}`}>({place.user_ratings_total} reviews)</span>
          </span>
        </div>
      )}

      {place.formatted_phone_number && (
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-gold-500" />
          <a href={`tel:${place.formatted_phone_number}`} className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-gold-300' : 'text-gold-500 hover:text-gold-600'}`}>
            {place.formatted_phone_number}
          </a>
        </div>
      )}

      {place.opening_hours && (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gold-500" />
          <span className={`text-sm ${place.opening_hours.isOpen?.() ? 'text-green-500' : 'text-red-500'} font-medium`}>
            {place.opening_hours.isOpen?.() ? 'Open now' : 'Closed'}
          </span>
        </div>
      )}

      {place.website && (
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gold-500" />
          <a href={place.website} target="_blank" rel="noopener noreferrer" className={`text-sm ${isDarkMode ? 'text-blue-400 hover:text-gold-300' : 'text-gold-500 hover:text-gold-600'}`}>
            Website
          </a>
        </div>
      )}
    </div>

    {/* Navigate Button */}
    {place.geometry?.location && (
      <div className="px-4 pb-3">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${place.geometry.location.lat()},${place.geometry.location.lng()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2 px-3 bg-gradient-to-r from-gold-500 to-gold-600 text-white text-sm font-semibold rounded-lg hover:from-gold-600 hover:to-gold-700 transition text-center"
        >
          Navigate
        </a>
      </div>
    )}
  </div>
);

export default function PurchaserMapsTab({
  address,
  eircode,
  developmentName,
  latitude,
  longitude,
  isDarkMode,
  selectedLanguage,
}: PurchaserMapsTabProps) {
  // Get translations based on selected language
  const t = useMemo(() => getTranslations(selectedLanguage), [selectedLanguage]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const placesServiceRef = useRef<any>(null);
  const placeMarkersRef = useRef<any[]>([]);
  const markerRefsMap = useRef<Map<string, any>>(new Map());
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const infoWindowRef = useRef<any>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const autocompleteServiceRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  const favoriteMarkersRef = useRef<Map<string, any>>(new Map());

  // Load favorites from localStorage
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

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('map_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addToFavorites = useCallback((place: FavoritePlace) => {
    setFavorites(prev => {
      if (prev.some(f => f.place_id === place.place_id)) {
        return prev;
      }
      return [...prev, place];
    });
  }, []);

  const removeFromFavorites = useCallback((placeId: string) => {
    setFavorites(prev => prev.filter(f => f.place_id !== placeId));
    const marker = favoriteMarkersRef.current.get(placeId);
    if (marker) {
      marker.setMap(null);
      favoriteMarkersRef.current.delete(placeId);
    }
  }, []);

  const isFavorite = useCallback((placeId: string) => {
    return favorites.some(f => f.place_id === placeId);
  }, [favorites]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('[Maps] Starting map initialization...');

    const initMap = async () => {
      try {
        const mapLat = latitude || 51.926500;
        const mapLng = longitude || -8.453200;

        // DEBUG: Check API key status (without exposing the key itself)
        // Check both possible env var names - NEXT_PUBLIC_ prefix is required for client-side
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || (typeof window !== 'undefined' && (window as any).__GOOGLE_MAPS_API_KEY);
        console.log('🗺️ MAPS DEBUG:');
        console.log('- NEXT_PUBLIC_GOOGLE_MAPS_API_KEY Exists?', !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
        console.log('- Key Length:', apiKey ? apiKey.length : 0);
        console.log('[Maps] Coordinates:', { mapLat, mapLng });

        // If no API key, show error state with more helpful message
        if (!apiKey || apiKey.length < 10) {
          console.error('[Maps] Google Maps API key is missing or invalid');
          console.error('[Maps] Ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in Vercel environment variables');
          setMapError(true);
          return;
        }

        if (!window.google) {
          console.log('[Maps] Google Maps not loaded, loading script...');
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
          script.async = true;
          script.defer = true;
          
          script.onload = () => {
            console.log('[Maps] Script loaded, initializing map...');
            initializeMap(mapLat, mapLng);
          };
          
          script.onerror = (error) => {
            console.error('[Maps] Failed to load Google Maps script:', error);
            setMapError(true);
          };
          
          document.head.appendChild(script);
        } else {
          console.log('[Maps] Google Maps already loaded');
          initializeMap(mapLat, mapLng);
        }
      } catch (error) {
        console.error('[Maps] Map initialization error:', error);
        setMapError(true);
      }
    };

    const initializeMap = (lat: number, lng: number) => {
      console.log('[Maps] initializeMap called', { lat, lng, mapRef: !!mapRef.current, hasExisting: !!mapInstanceRef.current });
      if (!mapRef.current) {
        console.error('[Maps] mapRef.current is null');
        return;
      }
      if (mapInstanceRef.current) {
        console.log('[Maps] Map already exists, skipping');
        return;
      }

      // Check if Google Maps API is fully loaded
      if (!window.google?.maps?.Map) {
        console.error('[Maps] Google Maps API not fully loaded');
        setMapError(true);
        return;
      }

      try {
        console.log('[Maps] Creating new map instance...');
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: isDarkMode ? [
            { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2937' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
            {
              featureType: 'water',
              elementType: 'geometry',
              stylers: [{ color: '#374151' }]
            }
          ] : [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'simplified' }]
            }
          ]
        });

        // Listen for map errors
        map.addListener('error', (error: any) => {
          console.error('[Maps] Map error event:', error);
        });

        // Premium gold pin marker for home location
        new window.google.maps.Marker({
          position: { lat, lng },
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

        // Initialize Places Service and Autocomplete Service
        placesServiceRef.current = new window.google.maps.places.PlacesService(map);
        autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
        mapInstanceRef.current = map;
        console.log('[Maps] Map created successfully, setting mapLoaded to true');
        setMapLoaded(true);
      } catch (error) {
        console.error('[Maps] Error creating map instance:', error);
        setMapError(true);
      }
    };

    initMap();
  }, [latitude, longitude, developmentName, isDarkMode]);

  // Display favorite pins when map loads or favorites change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    // Add markers for favorites that don't have markers yet
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

        marker.addListener('click', () => {
          const navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${fav.lat},${fav.lng}`;
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; font-family: system-ui; max-width: 280px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="font-weight: 600; font-size: 15px; color: #1f2937;">
                    ${fav.name}
                  </div>
                  <span style="color: #EF4444; font-size: 12px;">Favourite</span>
                </div>
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                  ${fav.address}
                </div>
                <div style="display: flex; gap: 8px;">
                  <a href="${navigateUrl}" target="_blank" rel="noopener noreferrer"
                     style="flex: 1; padding: 8px; background: linear-gradient(to right, #D4AF37, #B8934C); 
                            color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600; 
                            text-align: center;">
                    Navigate
                  </a>
                </div>
              </div>
            `,
          });
          infoWindow.open(mapInstanceRef.current, marker);
        });

        favoriteMarkersRef.current.set(fav.place_id, marker);
      }
    });

    // Remove markers for removed favorites
    favoriteMarkersRef.current.forEach((marker, placeId) => {
      if (!favorites.some(f => f.place_id === placeId)) {
        marker.setMap(null);
        favoriteMarkersRef.current.delete(placeId);
      }
    });
  }, [favorites, mapLoaded]);

  const searchNearbyPlaces = (category: FilterCategory) => {
    if (!mapInstanceRef.current || !placesServiceRef.current) return;

    // Clear existing markers
    placeMarkersRef.current.forEach(marker => marker.setMap(null));
    placeMarkersRef.current = [];

    const mapLat = latitude || 51.926500;
    const mapLng = longitude || -8.453200;

    const request = {
      location: new window.google.maps.LatLng(mapLat, mapLng),
      radius: 2000, // 2km radius
      type: category.placeType,
    };

    placesServiceRef.current.nearbySearch(request, (results: any[], status: any) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        results.forEach(place => {
          if (place.geometry && place.geometry.location) {
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

            // Fetch place details when marker is clicked
            marker.addListener('click', () => {
              if (!placesServiceRef.current || !place.place_id) {
                // Fallback to basic info if no place_id
                const basicInfoWindow = new window.google.maps.InfoWindow({
                  content: `
                    <div style="padding: 12px; font-family: system-ui; max-width: 300px;">
                      <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
                        ${place.name}
                      </div>
                      <div style="font-size: 12px; color: #6b7280;">
                        ${place.vicinity || ''}
                      </div>
                    </div>
                  `,
                });
                basicInfoWindow.open(mapInstanceRef.current, marker);
                return;
              }

              // Request detailed place information
              const detailsRequest = {
                placeId: place.place_id,
                fields: ['name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'opening_hours', 'reviews', 'photos', 'geometry']
              };

              placesServiceRef.current.getDetails(detailsRequest, (placeDetails: any, status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && placeDetails) {
                  const lat = placeDetails.geometry?.location?.lat() || 0;
                  const lng = placeDetails.geometry?.location?.lng() || 0;
                  const navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

                  // Build opening hours section
                  let openingHoursHTML = '';
                  if (placeDetails.opening_hours?.weekday_text) {
                    const isOpen = placeDetails.opening_hours.isOpen?.() ? 
                      '<span style="color: #10b981; font-weight: 600;">Open now</span>' : 
                      '<span style="color: #ef4444; font-weight: 600;">Closed</span>';
                    openingHoursHTML = `
                      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                        <div style="font-size: 12px; margin-bottom: 4px;">${isOpen}</div>
                        <details style="font-size: 11px; color: #6b7280; cursor: pointer;">
                          <summary style="margin-bottom: 4px;">View hours</summary>
                          ${placeDetails.opening_hours.weekday_text.map((day: string) => 
                            `<div style="margin: 2px 0;">${day}</div>`
                          ).join('')}
                        </details>
                      </div>
                    `;
                  }

                  // Build reviews section
                  let reviewsHTML = '';
                  if (placeDetails.reviews && placeDetails.reviews.length > 0) {
                    const review = placeDetails.reviews[0];
                    reviewsHTML = `
                      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                        <div style="font-size: 11px; color: #6b7280; line-height: 1.4;">
                          "${review.text?.substring(0, 100)}${review.text?.length > 100 ? '...' : ''}"
                        </div>
                        <div style="font-size: 10px; color: #9ca3af; margin-top: 4px;">
                          - ${review.author_name}
                        </div>
                      </div>
                    `;
                  }

                  // Build photo section
                  let photoHTML = '';
                  if (placeDetails.photos && placeDetails.photos.length > 0) {
                    const photoUrl = placeDetails.photos[0].getUrl({ maxWidth: 300, maxHeight: 150 });
                    photoHTML = `
                      <img src="${photoUrl}" alt="${placeDetails.name}" 
                           style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;" />
                    `;
                  }

                  const detailedInfoWindow = new window.google.maps.InfoWindow({
                    content: `
                      <div style="padding: 12px; font-family: system-ui; max-width: 300px;">
                        ${photoHTML}
                        <div style="font-weight: 600; font-size: 15px; color: #1f2937; margin-bottom: 4px;">
                          ${placeDetails.name}
                        </div>
                        ${placeDetails.rating ? `
                          <div style="font-size: 13px; color: #F59E0B; margin-bottom: 4px;">
                            ${placeDetails.rating} (${placeDetails.user_ratings_total || 0} reviews)
                          </div>
                        ` : ''}
                        <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
                          ${placeDetails.formatted_address || place.vicinity || ''}
                        </div>
                        ${placeDetails.formatted_phone_number ? `
                          <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
                            ${placeDetails.formatted_phone_number}
                          </div>
                        ` : ''}
                        ${placeDetails.website ? `
                          <div style="font-size: 12px; margin-bottom: 4px;">
                            <a href="${placeDetails.website}" target="_blank" rel="noopener noreferrer" 
                               style="color: #F59E0B; text-decoration: none;">
                              Website
                            </a>
                          </div>
                        ` : ''}
                        ${openingHoursHTML}
                        ${reviewsHTML}
                        <div style="margin-top: 12px;">
                          <a href="${navigateUrl}" target="_blank" rel="noopener noreferrer"
                             style="display: inline-block; padding: 8px 16px; background: linear-gradient(to right, #F59E0B, #D97706); 
                                    color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; 
                                    text-align: center; width: 100%; box-sizing: border-box;">
                            Navigate
                          </a>
                        </div>
                      </div>
                    `,
                  });
                  detailedInfoWindow.open(mapInstanceRef.current, marker);
                } else {
                  // Fallback to basic info if details fetch fails
                  const fallbackInfoWindow = new window.google.maps.InfoWindow({
                    content: `
                      <div style="padding: 12px; font-family: system-ui; max-width: 300px;">
                        <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
                          ${place.name}
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                          ${place.vicinity || ''}
                        </div>
                      </div>
                    `,
                  });
                  fallbackInfoWindow.open(mapInstanceRef.current, marker);
                }
              });
            });

            placeMarkersRef.current.push(marker);
          }
        });
      }
    });
  };

  const handleFilterClick = (category: FilterCategory) => {
    if (selectedFilter === category.id) {
      // Deselect - clear markers
      placeMarkersRef.current.forEach(marker => marker.setMap(null));
      placeMarkersRef.current = [];
      setSelectedFilter(null);
    } else {
      // Select new filter
      setSelectedFilter(category.id);
      searchNearbyPlaces(category);
    }
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    
    if (!value.trim() || !autocompleteServiceRef.current) {
      setSearchResults([]);
      return;
    }

    const mapLat = latitude || 51.926500;
    const mapLng = longitude || -8.453200;

    const request = {
      input: value,
      location: new window.google.maps.LatLng(mapLat, mapLng),
      radius: 5000,
    };

    autocompleteServiceRef.current.getPlacePredictions(
      request,
      (predictions: any[], status: any) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          setSearchResults(predictions.slice(0, 8));
        } else {
          setSearchResults([]);
        }
      }
    );
  };

  // Register global callback for favorite toggle from info windows
  useEffect(() => {
    (window as any).toggleMapFavorite = (placeId: string, name: string, address: string, lat: number, lng: number, buttonElement?: HTMLElement) => {
      const isCurrentlyFavorite = favorites.some(f => f.place_id === placeId);
      if (isCurrentlyFavorite) {
        removeFromFavorites(placeId);
        if (buttonElement) {
          const svg = buttonElement.querySelector('svg');
          if (svg) {
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#9CA3AF');
          }
          buttonElement.title = 'Add to favourites';
        }
      } else {
        addToFavorites({ place_id: placeId, name, address, lat, lng });
        if (buttonElement) {
          const svg = buttonElement.querySelector('svg');
          if (svg) {
            svg.setAttribute('fill', '#EF4444');
            svg.setAttribute('stroke', '#EF4444');
          }
          buttonElement.title = 'Remove from favourites';
        }
      }
    };
    return () => {
      delete (window as any).toggleMapFavorite;
    };
  }, [favorites, addToFavorites, removeFromFavorites]);

  const handleSearchResultClick = (placeId: string, description: string) => {
    if (!placesServiceRef.current) return;

    const detailsRequest = {
      placeId: placeId,
      fields: ['geometry', 'name', 'formatted_address', 'formatted_phone_number', 'website', 'rating', 'user_ratings_total', 'opening_hours', 'photos']
    };

    placesServiceRef.current.getDetails(detailsRequest, (place: any, status: any) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
        // Clear existing markers (but not favorite markers)
        placeMarkersRef.current.forEach(marker => marker.setMap(null));
        placeMarkersRef.current = [];
        setSelectedFilter(null);

        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        // Add new marker at search result
        const marker = new window.google.maps.Marker({
          position: place.geometry.location,
          map: mapInstanceRef.current,
          title: place.name,
          icon: {
            path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
            fillColor: '#D4AF37',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
            scale: 1.5,
            anchor: new window.google.maps.Point(12, 22),
          },
        });

        // Pan map to location
        mapInstanceRef.current?.panTo(place.geometry.location);
        mapInstanceRef.current?.setZoom(15);

        // Show info window with favorite button
        const showInfoWindow = () => {
          const navigateUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
          const escapedName = (place.name || '').replace(/'/g, "\\'");
          const escapedAddress = (place.formatted_address || '').replace(/'/g, "\\'");
          const isFav = isFavorite(placeId);

          const infoContent = `
            <div style="padding: 12px; font-family: system-ui; max-width: 300px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div style="font-weight: 600; font-size: 15px; color: #1f2937; flex: 1;">
                  ${place.name}
                </div>
                <button onclick="window.toggleMapFavorite('${placeId}', '${escapedName}', '${escapedAddress}', ${lat}, ${lng}, this);"
                  style="background: none; border: none; cursor: pointer; padding: 4px; margin-left: 8px;"
                  title="${isFav ? 'Remove from favourites' : 'Add to favourites'}">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? '#EF4444' : 'none'}" stroke="${isFav ? '#EF4444' : '#9CA3AF'}" stroke-width="2">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                  </svg>
                </button>
              </div>
              ${place.rating ? `
                <div style="font-size: 13px; color: #D4AF37; margin-bottom: 4px;">
                  ⭐ ${place.rating} (${place.user_ratings_total || 0} reviews)
                </div>
              ` : ''}
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
                ${place.formatted_address || ''}
              </div>
              ${place.formatted_phone_number ? `
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
                  ${place.formatted_phone_number}
                </div>
              ` : ''}
              <div style="margin-top: 12px;">
                <a href="${navigateUrl}" target="_blank" rel="noopener noreferrer"
                   style="display: inline-block; padding: 8px 16px; background: linear-gradient(to right, #D4AF37, #B8934C); 
                          color: white; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600; 
                          text-align: center; width: 100%; box-sizing: border-box;">
                  🧭 Navigate
                </a>
              </div>
            </div>
          `;

          const infoWindow = new window.google.maps.InfoWindow({ content: infoContent });
          infoWindow.open(mapInstanceRef.current, marker);
        };

        marker.addListener('click', showInfoWindow);
        showInfoWindow(); // Show immediately

        placeMarkersRef.current.push(marker);
        setSearchResults([]);
        setSearchQuery('');
      }
    });
  };

  if (mapError) {
    return (
      <div className={`flex items-center justify-center h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
        <div className="text-center p-6">
          <div className="text-4xl mb-4 flex justify-center"><Building2 className="w-12 h-12 text-gray-400" /></div>
          <h3 className="text-lg font-semibold mb-2">{t.common.error}</h3>
          <p className="text-sm text-gray-500 mb-4">
            {t.maps.noPlacesFound}
          </p>
          {/* Visible error box for API key issues */}
          <div className="bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded-lg max-w-md mx-auto">
            <p className="font-bold text-sm">⚠️ Configuration Required</p>
            <p className="text-xs mt-1">
              Google Maps API Key may be missing. Please ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in Replit Secrets.
            </p>
          </div>
        </div>
      </div>
    );
  }

  console.log('[Maps] Rendering PurchaserMapsTab', { isDarkMode, mapLoaded, mapError, address, latitude, longitude });
  
  return (
    <div className={`flex flex-col md:flex-row gap-4 md:gap-0 p-4 md:p-0 ${isDarkMode ? 'bg-[#0F0F0F]' : 'bg-white'}`} style={{ height: '100%', minHeight: 'calc(100vh - 150px)' }}>
      {/* LEFT PANEL: Filter Categories (Desktop: Left Side, Mobile: Top) */}
      <div className={`w-full md:w-80 md:border-r md:overflow-y-auto flex flex-col ${isDarkMode ? 'md:bg-[#0F0F0F] md:border-[#2A2A2A]' : 'md:bg-gray-50 md:border-gray-200'}`}>
        {/* Filter Header */}
        <div className={`px-4 py-3 md:border-b ${isDarkMode ? 'md:border-[#2A2A2A]' : 'md:border-gray-200'}`}>
          <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Nearby Places
          </h3>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#B0B0B0]' : 'text-gray-600'}`}>
            Select a category to explore
          </p>
        </div>

        {/* Category Grid - 2 columns on mobile, 1 column on desktop */}
        <div className={`px-4 py-3 md:py-4 overflow-x-auto md:overflow-x-visible`}>
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2 md:gap-2 md:pr-2">
            {FILTER_CATEGORIES.map(category => (
              <button
                key={category.id}
                onClick={() => handleFilterClick(category)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedFilter === category.id
                    ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md'
                    : isDarkMode
                      ? 'bg-[#1A1A1A] text-[#E0E0E0] hover:bg-[#252525] border border-[#2A2A2A]'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span className={`flex-shrink-0 ${selectedFilter === category.id ? 'text-white' : isDarkMode ? 'text-[#808080]' : 'text-gray-500'}`}>
                  {category.icon}
                </span>
                <span className="text-left">{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Favourites Section */}
        {favorites.length > 0 && (
          <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-[#2A2A2A]' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-red-500 fill-red-500" />
              <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Favourites ({favorites.length})
              </h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {favorites.map(fav => (
                <div
                  key={fav.place_id}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                    isDarkMode
                      ? 'bg-[#1A1A1A] hover:bg-[#252525] border border-[#2A2A2A]'
                      : 'bg-white hover:bg-gray-50 border border-gray-200'
                  }`}
                  onClick={() => {
                    mapInstanceRef.current?.panTo({ lat: fav.lat, lng: fav.lng });
                    mapInstanceRef.current?.setZoom(16);
                  }}
                >
                  <Heart className="w-4 h-4 text-red-500 fill-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {fav.name}
                    </div>
                    <div className={`text-xs truncate ${isDarkMode ? 'text-[#B0B0B0]' : 'text-gray-500'}`}>
                      {fav.address}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromFavorites(fav.place_id);
                    }}
                    className={`p-1 rounded hover:bg-red-100 ${isDarkMode ? 'hover:bg-red-900/30' : ''}`}
                    title="Remove from favourites"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Map Canvas (Desktop: Right Side, Mobile: Bottom) */}
      <div className={`flex-1 flex flex-col relative rounded-xl overflow-hidden ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-gray-100'} shadow-lg border-2 border-[#D4AF37]`} style={{ minHeight: '500px' }}>
        {/* Search Bar */}
        <div className={`p-4 border-b ${isDarkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'}`} style={{ zIndex: 10 }}>
          <div className="relative">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${isDarkMode ? 'border-[#2A2A2A] bg-[#252525]' : 'border-gold-400 bg-white'}`}>
              <Search className="w-4 h-4 text-gold-500" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t.maps.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                className={`flex-1 outline-none text-sm ${isDarkMode ? 'bg-[#252525] text-white placeholder:text-[#808080]' : 'bg-white text-gray-900 placeholder:text-gray-500'}`}
              />
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className={`absolute top-full left-0 right-0 mt-1 rounded-lg shadow-lg border z-50 ${isDarkMode ? 'bg-[#1A1A1A] border-[#2A2A2A]' : 'bg-white border-gray-200'}`}>
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearchResultClick(result.place_id, result.description)}
                    className={`w-full text-left px-3 py-2 text-sm transition ${
                      idx === 0
                        ? (isDarkMode ? 'bg-[#D4AF37]/10' : 'bg-gold-50')
                        : (isDarkMode ? 'hover:bg-[#252525]' : 'hover:bg-gray-50')
                    } ${isDarkMode ? 'text-[#E0E0E0]' : 'text-gray-900'}`}
                  >
                    <div className="font-medium">{result.structured_formatting?.main_text || result.description}</div>
                    <div className={`text-xs ${isDarkMode ? 'text-[#B0B0B0]' : 'text-gray-500'}`}>
                      {result.structured_formatting?.secondary_text || ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map Container with Fixed Height */}
        <div 
          ref={mapRef} 
          className="flex-1 w-full"
          style={{ 
            minHeight: '500px',
            maxHeight: '650px',
            backgroundColor: isDarkMode ? '#1A1A1A' : '#f3f4f6'
          }}
        />

        {/* Loading Overlay */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-95 dark:bg-gray-800 dark:bg-opacity-95 rounded-xl">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-500 mx-auto mb-4"></div>
              <p className={isDarkMode ? 'text-gray-300' : 'text-gray-600'}>{t.common.loading}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
