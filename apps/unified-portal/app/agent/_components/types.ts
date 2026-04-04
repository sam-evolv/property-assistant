/* ─── Shared types for OpenHouse Agent PWA ─── */

export type BadgeStatus =
  | 'contracts_out'
  | 'reserved'
  | 'exchanged'
  | 'available'
  | 'confirmed'
  | 'pending';

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

export interface Viewing {
  id: string;
  time: string;
  buyerName: string;
  schemeName: string;
  unit: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  note?: string;
}

export interface Document {
  id: string;
  name: string;
  type: 'ber' | 'brochure' | 'form' | 'price_list' | 'contract';
  schemeName: string;
  schemeId: string;
  updatedAt: string;
  size: string;
}

export type StatModalType = 'sold' | 'active' | 'urgent' | null;
