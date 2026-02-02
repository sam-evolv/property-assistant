'use client';

const SESSION_KEY_PREFIX = 'house_token_';
const COOKIE_MAX_AGE = 86400;

let inMemoryTokens: Record<string, string> = {};

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function setCookie(key: string, value: string): void {
  try {
    const expires = new Date(Date.now() + COOKIE_MAX_AGE * 1000).toUTCString();
    document.cookie = `${key}=${encodeURIComponent(value)}; path=/; expires=${expires}; SameSite=Strict`;
  } catch (e) {
    console.warn('[PurchaserSession] Cookie set failed:', e);
  }
}

function getCookie(key: string): string | null {
  try {
    const match = document.cookie.split('; ').find(c => c.startsWith(`${key}=`));
    if (match) {
      return decodeURIComponent(match.split('=')[1]);
    }
  } catch (e) {
    console.warn('[PurchaserSession] Cookie get failed:', e);
  }
  return null;
}

function deleteCookie(key: string): void {
  try {
    document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  } catch (e) {
    console.warn('[PurchaserSession] Cookie delete failed:', e);
  }
}

export function storeToken(unitUid: string, token: string): void {
  const key = `${SESSION_KEY_PREFIX}${unitUid}`;
  
  inMemoryTokens[key] = token;
  
  try {
    sessionStorage.setItem(key, token);
  } catch (e) {
    console.warn('[PurchaserSession] sessionStorage set failed:', e);
  }
  
  try {
    localStorage.setItem(key, token);
  } catch (e) {
    console.warn('[PurchaserSession] localStorage set failed:', e);
  }
  
  if (isIOS()) {
    setCookie(key, token);
  }
}

export function getToken(unitUid: string): string | null {
  const key = `${SESSION_KEY_PREFIX}${unitUid}`;
  
  if (inMemoryTokens[key]) {
    return inMemoryTokens[key];
  }
  
  try {
    const sessionToken = sessionStorage.getItem(key);
    if (sessionToken) {
      inMemoryTokens[key] = sessionToken;
      return sessionToken;
    }
  } catch (e) {
    console.warn('[PurchaserSession] sessionStorage get failed:', e);
  }
  
  try {
    const localToken = localStorage.getItem(key);
    if (localToken) {
      inMemoryTokens[key] = localToken;
      try {
        sessionStorage.setItem(key, localToken);
      } catch (e) {}
      return localToken;
    }
  } catch (e) {
    console.warn('[PurchaserSession] localStorage get failed:', e);
  }
  
  if (isIOS()) {
    const cookieToken = getCookie(key);
    if (cookieToken) {
      inMemoryTokens[key] = cookieToken;
      try {
        sessionStorage.setItem(key, cookieToken);
      } catch (e) {}
      return cookieToken;
    }
  }
  
  return null;
}

export function clearToken(unitUid: string): void {
  const key = `${SESSION_KEY_PREFIX}${unitUid}`;
  
  delete inMemoryTokens[key];
  
  try {
    sessionStorage.removeItem(key);
  } catch (e) {}
  
  try {
    localStorage.removeItem(key);
  } catch (e) {}
  
  deleteCookie(key);
}

export function getEffectiveToken(unitUid: string): string {
  return getToken(unitUid) || unitUid;
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      Object.keys(inMemoryTokens).forEach(key => {
        const token = inMemoryTokens[key];
        try {
          const current = sessionStorage.getItem(key);
          if (!current && token) {
            sessionStorage.setItem(key, token);
          }
        } catch (e) {}
      });
    }
  });
}
