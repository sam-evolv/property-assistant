/* ─── UI-layer types for OpenHouse Agent PWA ─── */
/* Pipeline types (PipelineUnit, Alert, DevelopmentSummary) live in lib/agent/agentPipelineService.ts */
/* Database-layer types (AgentScheme, AgentUnit, AgentBuyer) live in lib/agent/types.ts */

export type BadgeStatus =
  | 'contracts_out'
  | 'reserved'
  | 'exchanged'
  | 'available'
  | 'confirmed'
  | 'pending'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Buyer {
  id: string;
  name: string;
  initials: string;
  unit: string;
  price: number;
  status: BadgeStatus;
  depositDate: string | null;
  contractsDate: string | null;
  signedDate: string | null;
  closingDate: string | null;
  daysOverdue: number;
  isUrgent: boolean;
  schemeName?: string;
}

export interface Scheme {
  id: string;
  name: string;
  developer: string;
  location: string;
  totalUnits: number;
  sold: number;
  reserved: number;
  available: number;
  percentSold: number;
  activeBuyers: number;
  urgentCount: number;
  buyers: Buyer[];
}

export type StatModalType = 'sold' | 'active' | 'urgent' | null;
