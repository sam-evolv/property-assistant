import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { LayoutClient } from './layout-client';

export const metadata: Metadata = {
  title: 'OpenHouse AI - Unified Portal',
  description: 'Multi-tenant property assistance platform',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OpenHouse AI',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  // `interactiveWidget: 'resizes-content'` tells Android Chrome (and the TWA wrapper
  // that ships this site as a Play Store app) to shrink the layout viewport when the
  // soft keyboard appears instead of overlaying the page. Without it, the default
  // `overlays-content` behavior is what caused the chat input bar to float mid-screen
  // in the Android TWA when the user swiped — the bar's `bottom: calc(env(safe-area-inset-bottom)
  // + tab-bar-height)` was resolved against a viewport that didn't shorten for the keyboard.
  // iOS Safari / iOS Capacitor ignore this meta (they use VisualViewport + safe-area
  // insets), so the existing isIOSNative code path in PurchaserChatTab is unaffected.
  // Supported by Next Viewport type since 14.1; we're on ^14.2.18.
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1A1A' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Establish connections to Google Maps early — eliminates DNS + TLS latency when Maps tab opens */}
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        <link rel="dns-prefetch" href="https://maps.gstatic.com" />
      </head>
      <body className="font-sans">
        {/* Preload Google Maps JS as soon as the app hydrates — before the user even taps Maps tab.
            strategy="afterInteractive" = loads after Next.js hydration, non-blocking.
            OptimizedMapsTab checks window.google?.maps?.Map and skips its own script injection
            when this is already loaded, saving the full sequential load chain. */}
        <Script
          id="google-maps-preload"
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="afterInteractive"
        />
        <LayoutClient>
          {children}
        </LayoutClient>
      </body>
    </html>
  );
}
