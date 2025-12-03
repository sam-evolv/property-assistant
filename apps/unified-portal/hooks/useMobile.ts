'use client';

import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

function detectMobileUA(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const uaData = (navigator as any).userAgentData;
  if (uaData?.mobile !== undefined) {
    return uaData.mobile;
  }
  
  const ua = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isNarrowViewport = window.innerWidth < MOBILE_BREAKPOINT;
      const isMobileUA = detectMobileUA();
      setIsMobile(isNarrowViewport || isMobileUA);
    };

    checkMobile();

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handleChange = () => checkMobile();
    
    mediaQuery.addEventListener('change', handleChange);
    window.addEventListener('resize', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      window.removeEventListener('resize', handleChange);
    };
  }, []);

  return isMobile;
}

export function getIsMobileSSR(): boolean {
  if (typeof window === 'undefined') return false;
  const isNarrowViewport = window.innerWidth < MOBILE_BREAKPOINT;
  const isMobileUA = detectMobileUA();
  return isNarrowViewport || isMobileUA;
}

export function useIsMobileWithSSR(): { isMobile: boolean; mounted: boolean } {
  const [state, setState] = useState({ isMobile: false, mounted: false });

  useEffect(() => {
    const isNarrowViewport = window.innerWidth < MOBILE_BREAKPOINT;
    const isMobileUA = detectMobileUA();
    setState({ isMobile: isNarrowViewport || isMobileUA, mounted: true });
  }, []);

  return state;
}

export const MOBILE_BREAKPOINT_PX = MOBILE_BREAKPOINT;
