'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, X, Check, AlertCircle } from 'lucide-react';


interface MapLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  address?: string;
  onLocationChange: (lat: number | null, lng: number | null) => void;
}

const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.maps?.Map) {
      resolve();
      return;
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Missing Google Maps API key'));
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.google?.maps?.Map) {
          reject(new Error('Google Maps timeout'));
        }
      }, 15000);
      return;
    }

    const callbackName = 'initGoogleMapsPicker_' + Date.now();
    (window as any)[callbackName] = () => {
      delete (window as any)[callbackName];
      resolve();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    document.head.appendChild(script);
  });
};

export function MapLocationPicker({ latitude, longitude, address, onLocationChange }: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [tempLocation, setTempLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const initMap = useCallback(async () => {
    if (!isOpen || !mapRef.current) return;
    
    try {
      await loadGoogleMapsScript();
      
      if (!window.google?.maps?.Map) {
        setMapError('Failed to load Google Maps');
        return;
      }

      const defaultLat = latitude || 53.3498;
      const defaultLng = longitude || -6.2603;

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: defaultLat, lng: defaultLng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      const marker = new window.google.maps.Marker({
        position: { lat: defaultLat, lng: defaultLng },
        map: map,
        draggable: true,
        title: 'Drag to set location',
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
          fillColor: '#F59E0B',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
          scale: 2,
          anchor: new window.google.maps.Point(12, 22),
        },
      });

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          setTempLocation({ lat: pos.lat(), lng: pos.lng() });
        }
      });

      map.addListener('click', (e: any) => {
        const clickedLat = e.latLng.lat();
        const clickedLng = e.latLng.lng();
        marker.setPosition({ lat: clickedLat, lng: clickedLng });
        setTempLocation({ lat: clickedLat, lng: clickedLng });
      });

      if (latitude && longitude) {
        setTempLocation({ lat: latitude, lng: longitude });
      } else {
        setTempLocation({ lat: defaultLat, lng: defaultLng });
      }

      mapInstanceRef.current = map;
      markerRef.current = marker;
      setMapLoaded(true);

      if (address && !latitude && !longitude) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address }, (results: any, status: any) => {
          if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            map.setCenter(location);
            marker.setPosition(location);
            setTempLocation({ lat: location.lat(), lng: location.lng() });
          }
        });
      }
    } catch (err: any) {
      setMapError(err.message || 'Failed to initialize map');
    }
  }, [isOpen, latitude, longitude, address]);

  useEffect(() => {
    if (isOpen) {
      initMap();
    }
  }, [isOpen, initMap]);

  const handleConfirm = () => {
    if (tempLocation) {
      onLocationChange(tempLocation.lat, tempLocation.lng);
    }
    setIsOpen(false);
  };

  const handleCancel = () => {
    setIsOpen(false);
    setTempLocation(latitude && longitude ? { lat: latitude, lng: longitude } : null);
  };

  const handleClear = () => {
    onLocationChange(null, null);
    setTempLocation(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-md hover:bg-gold-600 transition"
        >
          <MapPin className="w-4 h-4" />
          {latitude && longitude ? 'Update Location' : 'Pick Location on Map'}
        </button>
        
        {latitude && longitude && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-600 hover:text-red-600 transition"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>
      
      {latitude && longitude && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="w-4 h-4" />
          Location set: {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Location</h3>
                <p className="text-sm text-gray-500">Click on the map or drag the marker to set the location</p>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="relative">
              {mapError ? (
                <div className="h-80 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-500" />
                    <p className="text-red-600">{mapError}</p>
                  </div>
                </div>
              ) : (
                <div ref={mapRef} className="h-80 w-full" />
              )}
              
              {!mapLoaded && !mapError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
                </div>
              )}
            </div>
            
            {tempLocation && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                Selected: {tempLocation.lat.toFixed(6)}, {tempLocation.lng.toFixed(6)}
              </div>
            )}
            
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!tempLocation}
                className="px-4 py-2 bg-gold-500 text-white rounded-md hover:bg-gold-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
