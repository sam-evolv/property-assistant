/**
 * OpenHouse Agent App — Design System
 * Tokens extracted from the designed HTML prototype.
 */

// Backgrounds & surfaces
export const BG = '#F4F4F6';
export const CARD = '#FFFFFF';
export const S1 = '#F0F0F4';
export const S2 = '#E8E8EE';
export const S3 = '#DCDCE8';

// Borders
export const LINE = '#EBEBF0';
export const LINE_B = '#DCDCE6';

// Text
export const T1 = '#0D0D18';
export const T2 = '#38384E';
export const T3 = '#86869A';
export const T4 = '#B4B4C8';

// Gold (primary accent)
export const GOLD = '#C4A44A';
export const GOLD_D = '#97791E';
export const GOLD_L = '#FAF4E4';
export const GOLD_M = '#E8D48A';

// Semantic
export const GO = '#0A7855';
export const GO_L = '#E6F5EF';
export const GO_M = '#9ADBC4';

export const FLAG = '#BF3728';
export const FLAG_L = '#FDF0EE';
export const FLAG_M = '#EDADA6';

export const WARN = '#B05208';
export const WARN_L = '#FEF4EE';
export const WARN_M = '#F5C49A';

export const INFO = '#1756A8';
export const INFO_L = '#EDF3FC';
export const INFO_M = '#ACCAEE';

export const VIO = '#5B30AC';
export const VIO_L = '#F2EEF9';
export const VIO_M = '#C4B4E8';

export const TEAL = '#0C6E8C';
export const TEAL_L = '#EDF8FB';
export const TEAL_M = '#9ED4E4';

// Status badge config
export const STATUS_STYLES: Record<string, { label: string; color: string; bg: string; border: string }> = {
  available:      { label: 'Available',      color: GO,     bg: GO_L,   border: GO_M },
  reserved:       { label: 'Reserved',       color: INFO,   bg: INFO_L, border: INFO_M },
  sale_agreed:    { label: 'Sale Agreed',    color: GOLD_D, bg: GOLD_L, border: GOLD_M },
  exchanged:      { label: 'Exchanged',      color: VIO,    bg: VIO_L,  border: VIO_M },
  contracts_out:  { label: 'Contracts Out',  color: GOLD_D, bg: GOLD_L, border: GOLD_M },
  contracts_issued: { label: 'Contracts Issued', color: GOLD_D, bg: GOLD_L, border: GOLD_M },
  contracts_signed: { label: 'Contracts Signed', color: VIO, bg: VIO_L, border: VIO_M },
  let_agreed:     { label: 'Let Agreed',     color: TEAL,   bg: TEAL_L, border: TEAL_M },
  enquiry:        { label: 'Enquiry',        color: T3,     bg: S1,     border: LINE },
  new_lead:       { label: 'New Lead',       color: WARN,   bg: WARN_L, border: WARN_M },
  pending:        { label: 'Pending',        color: WARN,   bg: WARN_L, border: WARN_M },
  confirmed:      { label: 'Confirmed',      color: GO,     bg: GO_L,   border: GO_M },
  sold:           { label: 'Sold',           color: GO,     bg: GO_L,   border: GO_M },
  for_sale:       { label: 'For Sale',       color: GO,     bg: GO_L,   border: GO_M },
  closing:        { label: 'Closing',        color: VIO,    bg: VIO_L,  border: VIO_M },
};
