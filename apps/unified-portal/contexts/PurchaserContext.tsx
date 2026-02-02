'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { storeToken, clearToken } from '@/lib/purchaserSession';

interface PurchaserSession {
  unitId: string;
  unitUid: string;
  developmentId: string;
  developmentName: string;
  developmentLogoUrl: string | null;
  purchaserName: string;
  address: string;
  houseType: string;
  latitude: number | null;
  longitude: number | null;
  token: string;
}

interface PurchaserContextValue {
  session: PurchaserSession | null;
  isLoading: boolean;
  login: (session: PurchaserSession) => void;
  logout: () => void;
}

const PurchaserContext = createContext<PurchaserContextValue | undefined>(undefined);

const STORAGE_KEY = 'purchaser_session';

export function PurchaserProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PurchaserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSession(parsed);
        if (parsed.unitUid && parsed.token) {
          storeToken(parsed.unitUid, parsed.token);
        }
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newSession: PurchaserSession) => {
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
    if (newSession.unitUid && newSession.token) {
      storeToken(newSession.unitUid, newSession.token);
    }
  };

  const logout = () => {
    if (session?.unitUid) {
      clearToken(session.unitUid);
    }
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <PurchaserContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </PurchaserContext.Provider>
  );
}

export function usePurchaserSession() {
  const context = useContext(PurchaserContext);
  if (context === undefined) {
    throw new Error('usePurchaserSession must be used within a PurchaserProvider');
  }
  return context;
}
