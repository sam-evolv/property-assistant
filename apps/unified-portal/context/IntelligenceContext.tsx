'use client';
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { HistoryItem } from '@/lib/agent/types';

interface IntelligenceContextValue {
  history: HistoryItem[];
  addToHistory: (item: HistoryItem) => void;
}

const IntelligenceContext = createContext<IntelligenceContextValue>({
  history: [],
  addToHistory: () => {},
});

export function IntelligenceProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('agent_intel_history');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('agent_intel_history', JSON.stringify(history));
    } catch {}
  }, [history]);

  const addToHistory = useCallback((item: HistoryItem) => {
    setHistory(prev => [...prev, item]);
  }, []);

  return (
    <IntelligenceContext.Provider value={{ history, addToHistory }}>
      {children}
    </IntelligenceContext.Provider>
  );
}

export function useIntelligenceContext() {
  return useContext(IntelligenceContext);
}
