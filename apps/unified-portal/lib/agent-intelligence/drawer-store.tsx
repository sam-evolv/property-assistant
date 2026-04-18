'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { AgenticSkillEnvelope } from './tools/agentic-skills';

export type DraftStatus =
  | 'pending'
  | 'approving'
  | 'approved'
  | 'discarding'
  | 'discarded'
  | 'errored';

interface DrawerState {
  envelope: AgenticSkillEnvelope | null;
  isOpen: boolean;
  draftStates: Record<string, DraftStatus>;
  open(envelope: AgenticSkillEnvelope): void;
  close(): void;
  setDraftStatus(draftId: string, status: DraftStatus): void;
  resetDraftStates(): void;
}

const DrawerContext = createContext<DrawerState | null>(null);

export function ApprovalDrawerProvider({ children }: { children: ReactNode }) {
  const [envelope, setEnvelope] = useState<AgenticSkillEnvelope | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draftStates, setDraftStates] = useState<Record<string, DraftStatus>>({});

  const open = useCallback((env: AgenticSkillEnvelope) => {
    setEnvelope(env);
    setDraftStates({});
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setDraftStatus = useCallback((draftId: string, status: DraftStatus) => {
    setDraftStates(prev => ({ ...prev, [draftId]: status }));
  }, []);

  const resetDraftStates = useCallback(() => {
    setDraftStates({});
  }, []);

  return (
    <DrawerContext.Provider value={{ envelope, isOpen, draftStates, open, close, setDraftStatus, resetDraftStates }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useApprovalDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useApprovalDrawer must be used within ApprovalDrawerProvider');
  return ctx;
}
