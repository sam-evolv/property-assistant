'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  PillDefinition, 
  selectPillsForSession, 
  generateSessionId,
  PILL_DEFINITIONS
} from '@/lib/assistant/suggested-pills';

const SESSION_KEY = 'suggested_pills_session';
const PILLS_KEY = 'suggested_pills_selection';

interface SessionData {
  sessionId: string;
  pillIds: string[];
  timestamp: number;
}

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

export function useSuggestedPills(enabled: boolean = true): {
  pills: PillDefinition[];
  sessionId: string;
  isLoading: boolean;
} {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(PILLS_KEY);
      if (stored) {
        const parsed: SessionData = JSON.parse(stored);
        const now = Date.now();
        
        if (now - parsed.timestamp < SESSION_DURATION_MS && parsed.pillIds.length === 4) {
          setSessionData(parsed);
          setIsLoading(false);
          return;
        }
      }

      const newSessionId = generateSessionId();
      const selectedPills = selectPillsForSession({ sessionId: newSessionId, count: 4 });
      const newSessionData: SessionData = {
        sessionId: newSessionId,
        pillIds: selectedPills.map(p => p.id),
        timestamp: Date.now()
      };

      localStorage.setItem(PILLS_KEY, JSON.stringify(newSessionData));
      setSessionData(newSessionData);
    } catch (error) {
      console.error('Failed to load/generate suggested pills:', error);
      const fallbackPills = selectPillsForSession({ count: 4 });
      setSessionData({
        sessionId: 'fallback',
        pillIds: fallbackPills.map(p => p.id),
        timestamp: Date.now()
      });
    }
    
    setIsLoading(false);
  }, [enabled]);

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

export function clearPillSession(): void {
  try {
    localStorage.removeItem(PILLS_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear pill session:', error);
  }
}
