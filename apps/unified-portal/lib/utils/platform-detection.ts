/**
 * Platform Detection Utilities
 * 
 * Detects iOS Safari for QR routing interstitial logic.
 * Used to determine when to show iOS app install prompt.
 */

export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isIOSSafari: boolean;
  isDesktop: boolean;
  isMobile: boolean;
}

export function detectPlatform(userAgent: string): PlatformInfo {
  const ua = userAgent.toLowerCase();
  
  const isIOS = /iphone|ipad|ipod/.test(ua);
  
  const isAndroid = /android/.test(ua);
  
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua) && !/crios/.test(ua) && !/fxios/.test(ua);
  
  const isIOSSafari = isIOS && isSafari;
  
  const isMobile = isIOS || isAndroid || /mobile/.test(ua);
  
  const isDesktop = !isMobile;
  
  return {
    isIOS,
    isAndroid,
    isSafari,
    isIOSSafari,
    isDesktop,
    isMobile,
  };
}

export function detectPlatformFromHeaders(headers: Headers): PlatformInfo {
  const userAgent = headers.get('user-agent') || '';
  return detectPlatform(userAgent);
}

export function parseHomeGuid(url: string): string | null {
  const match = url.match(/\/homes\/([a-f0-9-]{36})/i);
  if (match && isValidUUID(match[1])) {
    return match[1];
  }
  return null;
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function buildAppStoreUrl(): string {
  return 'https://apps.apple.com/app/openhouse-ai/id6504372916';
}

export function buildPlayStoreUrl(): string {
  return 'https://play.google.com/store/apps/details?id=com.openhouseai.portal';
}
