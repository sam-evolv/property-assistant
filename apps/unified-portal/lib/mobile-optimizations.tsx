'use client';

import React, { memo, Suspense, lazy, ComponentType } from 'react';
import dynamic from 'next/dynamic';

export const MOBILE_BREAKPOINT = 768;

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function createMobileOptimizedComponent<P extends object>(
  DesktopComponent: ComponentType<P>,
  MobileComponent: ComponentType<P>,
  LoadingFallback?: React.ReactNode
) {
  return memo(function MobileOptimizedWrapper(props: P) {
    const [isMobile, setIsMobile] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      
      const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!mounted) {
      return LoadingFallback ? <>{LoadingFallback}</> : null;
    }

    return isMobile ? <MobileComponent {...props} /> : <DesktopComponent {...props} />;
  });
}

interface MobileGuardProps {
  children: React.ReactNode;
  mobileFallback?: React.ReactNode;
  showOnMobile?: boolean;
}

export const MobileGuard = memo(function MobileGuard({ 
  children, 
  mobileFallback = null,
  showOnMobile = false 
}: MobileGuardProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!mounted) return null;

  if (showOnMobile) {
    return isMobile ? <>{children}</> : <>{mobileFallback}</>;
  }

  return isMobile ? <>{mobileFallback}</> : <>{children}</>;
});

export const StaticMapPlaceholder = memo(function StaticMapPlaceholder({ 
  onRequestMap,
  height = 300,
  className = ''
}: { 
  onRequestMap?: () => void;
  height?: number;
  className?: string;
}) {
  return (
    <div 
      className={`relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:from-gray-200 hover:to-gray-300 transition-colors ${className}`}
      style={{ height, minHeight: height }}
      onClick={onRequestMap}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onRequestMap?.()}
    >
      <div className="text-center p-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gold-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-gold-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium mb-1">Tap to Open Map</p>
        <p className="text-gray-500 text-sm">Interactive map will load on demand</p>
      </div>
    </div>
  );
});

export const StaticChartPlaceholder = memo(function StaticChartPlaceholder({
  height = 250,
  title,
  value,
  className = ''
}: {
  height?: number;
  title?: string;
  value?: string | number;
  className?: string;
}) {
  return (
    <div 
      className={`bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex flex-col items-center justify-center p-6 ${className}`}
      style={{ height, minHeight: height }}
    >
      {title && <p className="text-gray-600 text-sm mb-2">{title}</p>}
      {value !== undefined && <p className="text-2xl font-bold text-gray-900">{value}</p>}
      <div className="flex gap-1 mt-4">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className="w-8 bg-gold-500/30 rounded-t"
            style={{ height: 20 + Math.random() * 40 }}
          />
        ))}
      </div>
    </div>
  );
});

export const MobileVideoPlaceholder = memo(function MobileVideoPlaceholder({
  posterSrc,
  onPlay,
  height = 400,
  className = ''
}: {
  posterSrc?: string;
  onPlay?: () => void;
  height?: number;
  className?: string;
}) {
  return (
    <div 
      className={`relative bg-gray-900 rounded-xl overflow-hidden cursor-pointer group ${className}`}
      style={{ height, minHeight: height }}
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPlay?.()}
    >
      {posterSrc && (
        <img 
          src={posterSrc} 
          alt="Video thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
        <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
          <svg className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
});

export const SimplifiedMobileCard = memo(function SimplifiedMobileCard({
  title,
  value,
  subtitle,
  icon,
  className = ''
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className="text-gold-500">{icon}</div>}
      </div>
    </div>
  );
});

export const MobileAccordion = memo(function MobileAccordion({
  title,
  children,
  defaultOpen = false,
  className = ''
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-900">{title}</span>
        <svg 
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-4 bg-white">
          {children}
        </div>
      )}
    </div>
  );
});
