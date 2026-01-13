'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PillDefinition, 
  selectPillsForSession, 
  generateSessionId,
  PILL_DEFINITIONS
} from '@/lib/assistant/suggested-pills';

const PILLS_KEY_PREFIX = 'suggested_pills_v2';

interface SessionData {
  sessionId: string;
  pillIds: string[];
  generatedAt: string;
  schemeId: string;
}

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

function getStorageKey(schemeId: string): string {
  return `${PILLS_KEY_PREFIX}:${schemeId}`;
}

function isDev(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.includes('localhost');
}

export function useSuggestedPills(
  enabled: boolean = true,
  schemeId?: string
): {
  pills: PillDefinition[];
  sessionId: string;
  isLoading: boolean;
} {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSchemeIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const effectiveSchemeId = schemeId || 'global';
    const storageKey = getStorageKey(effectiveSchemeId);

    if (isDev()) {
      console.log('[SuggestedPills] Loading for scheme:', effectiveSchemeId, 'key:', storageKey);
    }

    if (lastSchemeIdRef.current !== effectiveSchemeId) {
      lastSchemeIdRef.current = effectiveSchemeId;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: SessionData = JSON.parse(stored);
        const generatedAt = new Date(parsed.generatedAt).getTime();
        const now = Date.now();
        
        if (
          now - generatedAt < SESSION_DURATION_MS && 
          parsed.pillIds.length === 4 &&
          parsed.schemeId === effectiveSchemeId
        ) {
          if (isDev()) {
            console.log('[SuggestedPills] Reusing cached pills:', parsed.pillIds, 'seed:', parsed.sessionId);
          }
          setSessionData(parsed);
          setIsLoading(false);
          return;
        }
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const newSessionId = `${effectiveSchemeId}-${dateStr}`;
      
      const selectedPills = selectPillsForSession({ sessionId: newSessionId, count: 4 });
      const newSessionData: SessionData = {
        sessionId: newSessionId,
        pillIds: selectedPills.map(p => p.id),
        generatedAt: new Date().toISOString(),
        schemeId: effectiveSchemeId
      };

      if (isDev()) {
        console.log('[SuggestedPills] Generated new pills:', {
          schemeId: effectiveSchemeId,
          seed: newSessionId,
          pillIds: newSessionData.pillIds
        });
      }

      localStorage.setItem(storageKey, JSON.stringify(newSessionData));
      setSessionData(newSessionData);
    } catch (error) {
      console.error('Failed to load/generate suggested pills:', error);
      const fallbackPills = selectPillsForSession({ count: 4 });
      setSessionData({
        sessionId: 'fallback',
        pillIds: fallbackPills.map(p => p.id),
        generatedAt: new Date().toISOString(),
        schemeId: schemeId || 'global'
      });
    }
    
    setIsLoading(false);
  }, [enabled, schemeId]);

  const pills = useMemo(() => {
    if (!sessionData || !enabled) return [];
    
    return sessionData.pillIds
      .map(id => PILL_DEFINITIONS.find(p => p.id === id))
      .filter((p): p is PillDefinition => p !== undefined);
  }, [sessionData, enabled]);

  return {
    pills,
    sessionId: sessionData?.sessionId || '',
    isLoading
  };
}

export function clearPillSession(schemeId?: string): void {
  try {
    if (schemeId) {
      localStorage.removeItem(getStorageKey(schemeId));
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PILLS_KEY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error('Failed to clear pill session:', error);
  }
}
