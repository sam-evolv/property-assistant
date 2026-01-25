// =============================================================================
// Pre-Handover Portal Types
// =============================================================================

export enum PurchaseMilestone {
  SALE_AGREED = 'sale_agreed',
  CONTRACTS_SIGNED = 'contracts_signed',
  KITCHEN_SELECTION = 'kitchen_selection',
  SNAGGING = 'snagging',
  CLOSING = 'closing',
  HANDOVER = 'handover'
}

export const MILESTONE_ORDER = [
  'sale_agreed',
  'contracts_signed',
  'kitchen_selection',
  'snagging',
  'closing',
  'handover'
] as const;

export const MILESTONE_LABELS: Record<string, string> = {
  sale_agreed: 'Sale Agreed',
  contracts_signed: 'Contracts Signed',
  kitchen_selection: 'Kitchen Selection',
  snagging: 'Snagging',
  closing: 'Closing',
  handover: 'Handover'
};

export interface MilestoneDates {
  sale_agreed?: string;
  contracts_signed?: string;
  kitchen_selection?: string;
  snagging?: string;
  closing?: string;
  handover?: string;
}

export interface UnitPreHandoverData {
  unitId: string;
  propertyName: string;
  propertyType: string;
  houseType: string;
  handoverComplete: boolean;
  currentMilestone: string;
  milestoneDates: MilestoneDates;
  estSnaggingDate: string | null;
  estHandoverDate: string | null;
  documents: Document[];
  contacts: ContactInfo;
  faqs: FAQ[];
}

export interface Document {
  id: string;
  name: string;
  type: 'floor_plan' | 'contract' | 'kitchen' | 'other';
  url: string;
  size: string;
}

export interface ContactInfo {
  salesPhone?: string;
  salesEmail?: string;
  showHouseAddress?: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface PreHandoverConfig {
  milestones: {
    id: string;
    label: string;
    enabled: boolean;
  }[];
  faqs: FAQ[];
  contacts: ContactInfo;
  documents: {
    showFloorPlans: boolean;
    showContract: boolean;
    showKitchenSelections: boolean;
  };
}

export type SheetType = 'timeline' | 'docs' | 'faq' | 'contact' | 'calendar' | 'settings' | 'chat' | 'more' | null;
