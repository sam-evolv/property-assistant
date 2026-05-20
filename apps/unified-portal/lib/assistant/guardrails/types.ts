/**
 * Guardrail Context — shared type for all guardrail modules
 */

import { UnitInfo } from '../../unit-lookup';

export interface DocumentChunk {
  content: string;
  metadata?: {
    file_name?: string;
    page?: number;
    section?: string;
  };
  similarity?: number;
}

export interface GuardrailContext {
  query: string;
  intent: string;
  schemeFacts: string;
  retrievedChunks: DocumentChunk[];
  conversationHistory: MessageEntry[];
  language: string;
  unitInfo: UnitInfo | null;
  responseSource: string;
  requestId?: string;
  /** Known development facts for false premise detection */
  knownFacts?: {
    totalUnits?: number;
    hasPhases?: boolean;
    maxPhase?: number;
    developerName?: string;
    location?: string;
  };
}

export interface MessageEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
