'use client';

import { useState, memo } from 'react';
import dynamic from 'next/dynamic';
import { MapPin, Navigation, ChevronRight } from 'lucide-react';
import { useIsMobileWithSSR } from '@/hooks/useMobile';

interface MobileOptimizedMapsTabProps {
  address: string;
  eircode?: string;
  developmentName: string;
  latitude?: number | null;
  longitude?: number | null;
  isDarkMode: boolean;
  selectedLanguage: string;
}

const FullMapsTab = dynamic(
  () => import('./PurchaserMapsTab'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-[500px] bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl animate-pulse flex items-center justify-center">
        <span className="text-gray-500">Loading interactive map...</span>
      </div>
    )
  }
);

const StaticMapPlaceholder = memo(function StaticMapPlaceholder({
  address,
  developmentName,
  latitude,
  longitude,
  onRequestMap,
  isDarkMode
}: {
  address: string;
  developmentName: string;
  latitude?: number | null;
  longitude?: number | null;
  onRequestMap: () => void;
  isDarkMode: boolean;
}) {
  const hasCoords = latitude != null && longitude != null;
  
  return (
    <div className={`rounded-xl overflow-hidden border ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
      <div 
        className="relative h-48 cursor-pointer group"
        onClick={onRequestMap}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onRequestMap()}
        style={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, #1f2937 0%, #374151 50%, #1f2937 100%)' 
            : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 50%, #d1d5db 100%)'
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-400/30 to-gold-600/30 flex items-center justify-center backdrop-blur-sm">
            <MapPin className="w-10 h-10 text-gold-600" />
          </div>
        </div>
        
        <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg flex items-center gap-2 group-active:scale-95 transition-transform">
            <MapPin className="w-5 h-5 text-gold-600" />
            <span className="font-medium text-gray-900">Tap to Explore Area</span>
          </div>
        </div>
      </div>

      <div className={`p-4 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {developmentName}
        </h3>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {address}
        </p>
        
        {hasCoords && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 text-gold-600 hover:text-gold-700 text-sm font-medium"
          >
            <Navigation className="w-4 h-4" />
            Get Directions
            <ChevronRight className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
});

export default function MobileOptimizedMapsTab(props: MobileOptimizedMapsTabProps) {
  const { isMobile, mounted } = useIsMobileWithSSR();
  const [mapRequested, setMapRequested] = useState(false);

  if (!mounted) {
    return (
      <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl animate-pulse" />
    );
  }

  if (isMobile && !mapRequested) {
    return (
      <StaticMapPlaceholder
        address={props.address}
        developmentName={props.developmentName}
        latitude={props.latitude}
        longitude={props.longitude}
        onRequestMap={() => setMapRequested(true)}
        isDarkMode={props.isDarkMode}
      />
    );
  }

  return <FullMapsTab {...props} />;
}
