/**
 * OpenHouse Agent App — Design System
 * Unified design language across Agent, Care, Developer Dashboard.
 */

// Backgrounds & surfaces
export const BG = '#FFFFFF';
export const CARD = '#FFFFFF';
export const S1 = '#F9FAFB';   // subtle lift
export const S2 = '#F3F4F6';   // recessed
export const S3 = '#E5E7EB';

// Borders
export const LINE = '#E5E7EB';
export const LINE_B = '#D1D5DB';  // border strong

// Text
export const T1 = '#111827';   // primary
export const T2 = '#6B7280';   // secondary
export const T3 = '#9CA3AF';   // muted
export const T4 = '#9CA3AF';   // muted (nav labels, inactive)

// Gold (primary accent) — used sparingly, once per card max
export const GOLD = '#D4AF37';
export const GOLD_D = '#B8934C';
export const GOLD_L = '#FFFBEB';
export const GOLD_M = '#E8D48A';

// Semantic
export const GO = '#10B981';
export const GO_L = '#ECFDF5';
export const GO_M = '#A7F3D0';

export const FLAG = '#EF4444';
export const FLAG_L = '#FEF2F2';
export const FLAG_M = '#FECACA';

export const WARN = '#F59E0B';
export const WARN_L = '#FFFBEB';
export const WARN_M = '#FDE68A';

export const INFO = '#3B82F6';
export const INFO_L = '#EFF6FF';
export const INFO_M = '#BFDBFE';

export const VIO = '#8B5CF6';
export const VIO_L = '#F5F3FF';
export const VIO_M = '#DDD6FE';

export const TEAL = '#14B8A6';
export const TEAL_L = '#F0FDFA';
export const TEAL_M = '#99F6E4';

// Card shadows (layered — never a single flat shadow)
export const SHADOW_CARD = '0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.04)';
export const SHADOW_ELEVATED = '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)';
export const SHADOW_URGENT = '0 2px 8px rgba(239,68,68,0.1), 0 1px 3px rgba(239,68,68,0.06)';

// Status badge config
export const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available:        { label: 'Available',        color: GO,     bg: GO_L,   border: GO_M },
  reserved:         { label: 'Reserved',         color: INFO,   bg: INFO_L, border: INFO_M },
  sale_agreed:      { label: 'Sale Agreed',      color: GOLD_D, bg: GOLD_L, border: GOLD_M },
  exchanged:        { label: 'Exchanged',        color: VIO,    bg: VIO_L,  border: VIO_M },
  contracts_out:    { label: 'Contracts Out',    color: FLAG,   bg: FLAG_L, border: FLAG_M },
  contracts_issued: { label: 'Contracts Issued', color: FLAG,   bg: FLAG_L, border: FLAG_M },
  contracts_signed: { label: 'Contracts Signed', color: VIO,    bg: VIO_L,  border: VIO_M },
  let_agreed:       { label: 'Let Agreed',       color: TEAL,   bg: TEAL_L, border: TEAL_M },
  enquiry:          { label: 'Enquiry',          color: T3,     bg: S1,     border: LINE },
  new_lead:         { label: 'New Lead',         color: WARN,   bg: WARN_L, border: WARN_M },
  pending:          { label: 'Pending',          color: WARN,   bg: WARN_L, border: WARN_M },
  confirmed:        { label: 'Confirmed',        color: GO,     bg: GO_L,   border: GO_M },
  sold:             { label: 'Sold',             color: GO,     bg: GO_L,   border: GO_M },
  for_sale:         { label: 'For Sale',         color: GO,     bg: GO_L,   border: GO_M },
  closing:          { label: 'Closing',          color: VIO,    bg: VIO_L,  border: VIO_M },
};
