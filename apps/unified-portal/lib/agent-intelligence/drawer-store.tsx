'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AgenticSkillEnvelope } from './tools/agentic-skills';

interface DrawerState {
  envelope: AgenticSkillEnvelope | null;
  isOpen: boolean;
  open(envelope: AgenticSkillEnvelope): void;
  close(): void;
}

const DrawerContext = createContext<DrawerState | null>(null);

export function ApprovalDrawerProvider({ children }: { children: ReactNode }) {
  const [envelope, setEnvelope] = useState<AgenticSkillEnvelope | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((env: AgenticSkillEnvelope) => {
    console.log('[drawer] store.open called, isOpen becoming true');
    setEnvelope(env);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <DrawerContext.Provider value={{ envelope, isOpen, open, close }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useApprovalDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useApprovalDrawer must be used within ApprovalDrawerProvider');
  return ctx;
}
