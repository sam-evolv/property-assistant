import { useState, useEffect } from 'react';
import { breakpoints } from '@/lib/design-system';

/**
 * Media query hook - subscribes to derived boolean state
 * Only re-renders when boolean changes, not on every resize
 * @param query - CSS media query string
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);

    // Update state only when match status changes
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    mediaQuery.addEventListener('change', handler);

    // Sync initial state
    setMatches(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}

/**
 * Convenience hooks for common breakpoints
 * Uses derived state pattern for optimal performance
 */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${breakpoints.md})`);
}

export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${breakpoints.md}) and (max-width: ${breakpoints.lg})`
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${breakpoints.lg})`);
}

/**
 * Prefers reduced motion - important for accessibility
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Dark mode preference
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}
