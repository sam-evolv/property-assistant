/**
 * Sales-tracker parsing for the developer "drop your spreadsheet" import.
 *
 * Pure functions — no DB, no network — so the whole mapping pipeline is
 * testable offline. Understands the de-facto Irish development tracker
 * (Address of Dwelling, Property Designation, Phase, Release, Price, Status,
 * Solicitor's Information, SADRL, Proof of Funds, Deposit, Receipt,
 * Sale Agreed & Loan Approved, contract dates, Projected Handover,
 * Snagging Start, Mortgage Expiration, Comments…) under any reasonable
 * header spelling. Unrecognised headers are reported, never guessed silently.
 */

import * as xlsx from 'xlsx';

export type CanonicalField =
  // unit
  | 'unit_identifier'
  | 'house_type'
  | 'property_designation'
  | 'phase'
  | 'bedrooms'
  | 'eircode'
  // purchaser
  | 'purchaser_name'
  | 'purchaser_email'
  | 'purchaser_phone'
  // sale / pipeline
  | 'sale_price'
  | 'status'
  | 'sale_type'
  | 'housing_agency'
  | 'solicitor_name'
  | 'solicitor_email'
  | 'solicitor_phone'
  | 'release_date'
  | 'sale_agreed_date'
  | 'proof_of_funds_date'
  | 'sadrl_date'
  | 'deposit_date'
  | 'deposit_receipt_date'
  | 'loan_approved_date'
  | 'contracts_issued_date'
  | 'queries_raised_date'
  | 'queries_replied_date'
  | 'signed_contracts_date'
  | 'counter_signed_date'
  | 'one_part_returned_date'
  | 'projected_handover_date'
  | 'snagging_start_date'
  | 'snag_date'
  | 'drawdown_date'
  | 'handover_date'
  | 'mortgage_expiry_date'
  | 'comments';

export const DATE_FIELDS: CanonicalField[] = [
  'release_date', 'sale_agreed_date', 'proof_of_funds_date', 'sadrl_date',
  'deposit_date', 'deposit_receipt_date', 'loan_approved_date',
  'contracts_issued_date', 'queries_raised_date', 'queries_replied_date',
  'signed_contracts_date', 'counter_signed_date', 'one_part_returned_date',
  'projected_handover_date', 'snagging_start_date', 'snag_date',
  'drawdown_date', 'handover_date', 'mortgage_expiry_date',
];

export interface HeaderMapping {
  field: CanonicalField;
  header: string;
  via: 'heuristic' | 'llm';
}

export interface ParsedHome {
  rowNum: number;
  unit_identifier: string;
  house_type: string | null;
  property_designation: string | null;
  phase: string | null;
  bedrooms: number | null;
  eircode: string | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  sale_price: number | null;
  status: string | null;
  sale_type: 'private' | 'social' | null;
  housing_agency: string | null;
  solicitor_name: string | null;
  solicitor_email: string | null;
  solicitor_phone: string | null;
  dates: Partial<Record<CanonicalField, string>>;
  /** Date-ish columns whose cell said "Yes"/"Received" etc. — preserved as
   *  flags rather than fabricating a date. */
  flags: Partial<Record<CanonicalField, string>>;
  comments: string | null;
}

export interface NormaliseResult {
  homes: ParsedHome[];
  errors: string[];
}

function clean(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/\s+/g, ' ').trim();
}

/** "Solicitor's Information" -> "solicitors_information" */
export function normHeader(h: unknown): string {
  return clean(h)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// ---------------------------------------------------------------------------
// Header mapping
// ---------------------------------------------------------------------------

const SYNONYMS: Record<CanonicalField, string[]> = {
  unit_identifier: [
    'unit_number', 'unit', 'unit_no', 'no', 'number', 'address',
    'address_of_dwelling', 'dwelling_address', 'address_line_1', 'plot',
    'plot_no', 'plot_number', 'house_no', 'house_number', 'site', 'site_no',
    'property', 'dwelling', 'house',
  ],
  house_type: [
    'unit_type', 'house_type_code', 'house_type', 'type', 'house_design',
    'design', 'style',
  ],
  property_designation: ['property_designation', 'designation', 'unit_designation'],
  phase: ['phase', 'phase_no', 'phase_number'],
  bedrooms: ['bedrooms', 'beds', 'bed', 'no_of_beds', 'bedroom_count', 'number_of_bedrooms'],
  eircode: ['eircode', 'eir_code', 'postcode', 'post_code', 'zip'],
  purchaser_name: [
    'purchaser_information', 'purchaser_info', 'purchaser_name', 'purchaser',
    'purchasers', 'purchaser_details', 'owner', 'owner_name', 'buyer_name',
    'buyer', 'customer_name', 'customer', 'client',
  ],
  purchaser_email: ['purchaser_email', 'email', 'email_address', 'buyer_email', 'contact_email'],
  purchaser_phone: ['purchaser_phone', 'phone', 'phone_number', 'mobile', 'contact_number', 'telephone'],
  sale_price: ['price', 'sale_price', 'purchase_price', 'agreed_price'],
  status: ['status', 'sale_status', 'current_status'],
  sale_type: ['sale_type', 'tenure'],
  housing_agency: ['housing_agency', 'agency', 'housing_body', 'approved_housing_body', 'aha_name'],
  solicitor_name: [
    'solicitors_information', 'solicitor_information', 'solicitor',
    'solicitors', 'solicitor_name', 'solicitor_details', 'purchasers_solicitor',
  ],
  solicitor_email: ['solicitor_email'],
  solicitor_phone: ['solicitor_phone'],
  release_date: ['release', 'release_date', 'released', 'date_of_release'],
  sale_agreed_date: ['sale_agreed', 'sale_agreed_date', 'date_sale_agreed', 'sa_date'],
  proof_of_funds_date: ['proof_of_funds', 'pof', 'proof_of_funds_received', 'proof_of_funds_date'],
  sadrl_date: ['sadrl', 'sadrl_date', 'sadrl_received', 'sadrl_returned'],
  deposit_date: ['deposit', 'deposit_date', 'deposit_paid', 'deposit_received', 'booking_deposit', 'full_deposit'],
  deposit_receipt_date: ['receipt', 'deposit_receipt', 'receipt_date', 'receipt_issued'],
  loan_approved_date: ['loan_approved', 'loan_approval', 'mortgage_approved', 'mortgage_approval', 'aip'],
  contracts_issued_date: [
    'date_of_contract_issue', 'contract_issue', 'contract_issue_date',
    'contracts_issued', 'contract_issued', 'contracts_out', 'date_contracts_issued',
  ],
  queries_raised_date: [
    'date_of_queries_raised', 'queries_raised', 'queries', 'pre_contract_queries',
    'queries_raised_date',
  ],
  queries_replied_date: [
    'date_of_reply_to_queries', 'reply_to_queries', 'queries_replied',
    'queries_answered', 'replies_to_queries', 'queries_replied_date',
  ],
  signed_contracts_date: [
    'date_of_receipt_of_signed_contracts', 'signed_contracts',
    'signed_contracts_date', 'contracts_signed', 'signed_contracts_received',
    'signed_contracts_returned', 'contracts_returned',
  ],
  counter_signed_date: ['counter_signed', 'countersigned', 'counterpart_signed', 'counter_signed_date'],
  one_part_returned_date: [
    'date_of_one_part_contract_returned', 'one_part_contract_returned',
    'one_part_returned', 'one_part_contract', 'part_contract_returned',
    'counterpart_returned',
  ],
  projected_handover_date: [
    'projected_handover_date', 'projected_handover', 'estimated_handover',
    'est_handover', 'target_handover', 'anticipated_handover',
    'projected_completion', 'estimated_completion',
  ],
  snagging_start_date: ['snagging_start_date', 'snagging_start', 'snag_start', 'snag_start_date'],
  snag_date: ['snagging_complete', 'snag_complete', 'snag_completed', 'de_snag_date', 'desnag_date', 'snag_date'],
  drawdown_date: ['drawdown', 'drawdown_date', 'funds_drawn', 'drawdown_of_funds'],
  handover_date: [
    'handover', 'handover_date', 'date_of_handover', 'completion', 'completion_date',
    'closing_date', 'close_date', 'closed', 'keys', 'key_handover',
  ],
  mortgage_expiry_date: [
    'mortgage_expiration_date', 'mortgage_expiration', 'mortgage_expiry',
    'mortgage_expiry_date', 'loan_offer_expiry', 'aip_expiry',
  ],
  comments: ['comments', 'comment', 'notes', 'note', 'remarks'],
};

/** One header that fills two fields: "Sale Agreed & Loan Approved". */
const COMBO_SALE_AGREED_LOAN = ['sale_agreed_loan_approved', 'sale_agreed_and_loan_approved'];

const EXACT_MAP: Map<string, CanonicalField[]> = (() => {
  const m = new Map<string, CanonicalField[]>();
  (Object.keys(SYNONYMS) as CanonicalField[]).forEach((field) => {
    for (const syn of SYNONYMS[field]) {
      if (!m.has(syn)) m.set(syn, []);
      m.get(syn)!.push(field);
    }
  });
  for (const combo of COMBO_SALE_AGREED_LOAN) {
    m.set(combo, ['sale_agreed_date', 'loan_approved_date']);
  }
  return m;
})();

/** Substring rules, checked in order, for headers the exact table misses. */
const CONTAINS_RULES: Array<{ test: (h: string) => boolean; fields: CanonicalField[] }> = [
  { test: (h) => h.includes('sale_agreed') && h.includes('loan'), fields: ['sale_agreed_date', 'loan_approved_date'] },
  { test: (h) => h.includes('projected') && h.includes('handover'), fields: ['projected_handover_date'] },
  { test: (h) => h.includes('one_part'), fields: ['one_part_returned_date'] },
  { test: (h) => h.includes('signed') && h.includes('contract'), fields: ['signed_contracts_date'] },
  { test: (h) => h.includes('contract') && h.includes('issue'), fields: ['contracts_issued_date'] },
  { test: (h) => h.includes('quer') && (h.includes('repl') || h.includes('answer')), fields: ['queries_replied_date'] },
  { test: (h) => h.includes('quer'), fields: ['queries_raised_date'] },
  { test: (h) => h.includes('mortgage') && h.includes('expir'), fields: ['mortgage_expiry_date'] },
  { test: (h) => h.includes('snag') && h.includes('start'), fields: ['snagging_start_date'] },
  { test: (h) => h.includes('proof') && h.includes('fund'), fields: ['proof_of_funds_date'] },
  { test: (h) => h.includes('deposit') && h.includes('receipt'), fields: ['deposit_receipt_date'] },
  { test: (h) => h.includes('deposit'), fields: ['deposit_date'] },
  { test: (h) => h.includes('sadrl'), fields: ['sadrl_date'] },
  { test: (h) => h.includes('solicitor') && h.includes('email'), fields: ['solicitor_email'] },
  { test: (h) => h.includes('solicitor'), fields: ['solicitor_name'] },
  { test: (h) => h.includes('purchaser') || h.includes('buyer'), fields: ['purchaser_name'] },
  { test: (h) => h.includes('handover'), fields: ['handover_date'] },
  { test: (h) => h.includes('eircode'), fields: ['eircode'] },
  { test: (h) => h.includes('price'), fields: ['sale_price'] },
  { test: (h) => h.includes('bed'), fields: ['bedrooms'] },
  { test: (h) => h.includes('address') || h.includes('plot') || h.includes('dwelling'), fields: ['unit_identifier'] },
  { test: (h) => h.includes('house') && h.includes('type'), fields: ['house_type'] },
  { test: (h) => h.includes('designation'), fields: ['property_designation'] },
  { test: (h) => h.includes('agenc') || h.includes('housing_body'), fields: ['housing_agency'] },
  { test: (h) => h.includes('comment') || h.includes('note') || h.includes('remark'), fields: ['comments'] },
];

export interface MapHeadersResult {
  mapped: HeaderMapping[];
  unmapped: string[];
}

export function mapHeaders(headers: string[]): MapHeadersResult {
  const mapped: HeaderMapping[] = [];
  const unmapped: string[] = [];
  const taken = new Set<CanonicalField>();

  const claim = (fields: CanonicalField[], header: string): boolean => {
    const free = fields.filter((f) => !taken.has(f));
    if (free.length === 0) return false;
    for (const f of free) {
      taken.add(f);
      mapped.push({ field: f, header, via: 'heuristic' });
    }
    return true;
  };

  for (const header of headers) {
    const norm = normHeader(header);
    if (!norm) continue;

    const exact = EXACT_MAP.get(norm);
    if (exact && claim(exact, header)) continue;

    const rule = CONTAINS_RULES.find((r) => r.test(norm));
    if (rule && claim(rule.fields, header)) continue;

    unmapped.push(header);
  }

  return { mapped, unmapped };
}

// ---------------------------------------------------------------------------
// Workbook parsing
// ---------------------------------------------------------------------------

export interface ParsedSheet {
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

/** Reads the first sheet into header + record rows. Tolerates title rows
 *  above the real header (picks the first row with 3+ non-empty cells). */
export function parseWorkbook(buffer: Buffer, fileName: string): ParsedSheet {
  const isCsv = fileName.toLowerCase().endsWith('.csv');
  const wb = xlsx.read(isCsv ? buffer.toString('utf-8') : buffer, {
    type: isCsv ? 'string' : 'buffer',
    cellDates: true,
  });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const matrix = xlsx.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: true,
  });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const nonEmpty = (matrix[i] || []).filter((c) => clean(c) !== '').length;
    if (nonEmpty >= 3) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { headers: [], rows: [] };

  const headers = (matrix[headerIdx] || []).map((h) => clean(h));
  const rows: Array<Record<string, unknown>> = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i] || [];
    const record: Record<string, unknown> = {};
    let hasValue = false;
    headers.forEach((h, col) => {
      if (!h) return;
      const v = cells[col];
      record[h] = v;
      if (clean(v) !== '') hasValue = true;
    });
    if (hasValue) rows.push(record);
  }
  return { headers: headers.filter(Boolean), rows };
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

const EMPTYISH = new Set(['', '-', '–', 'n/a', 'na', 'tbc', 'tbd', 'none', 'no', 'x']);
const AFFIRMATIVE = new Set(['yes', 'y', 'received', 'paid', 'complete', 'completed', 'done', 'ok', 'approved', '✓', '✔']);

function excelSerialToIso(serial: number): string | null {
  if (serial < 20000 || serial > 60000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Irish sheets are day-first. Handles Date objects, Excel serials,
 *  dd/mm/yyyy (and dd-mm / dd.mm, 2- or 4-digit years), and ISO. */
export function parseDateLoose(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    return isNaN(v.getTime()) || v.getFullYear() < 1980 ? null : v.toISOString();
  }
  if (typeof v === 'number') return excelSerialToIso(v);

  const s = clean(v);
  if (!s || EMPTYISH.has(s.toLowerCase())) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (dmy) {
    let year = +dmy[3];
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const day = +dmy[1];
    const month = +dmy[2];
    if (month > 12 || day > 31 || month < 1 || day < 1) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // "12 Jan 2026" / "Jan 12 2026" / "12 January 2026"
  const wordy = s.match(/^\d{1,2}\s+[A-Za-z]{3,9}\.?\s+\d{2,4}$|^[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{2,4}$/);
  if (wordy) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

export function isAffirmative(v: unknown): boolean {
  if (v === true) return true;
  const s = clean(v).toLowerCase();
  return AFFIRMATIVE.has(s);
}

export function parseMoney(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) && v > 0 ? v : null;
  const s = clean(v).replace(/[€£$,\s]/g, '');
  if (!s || EMPTYISH.has(s.toLowerCase())) return null;
  const n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : null;
}

function parseBedrooms(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return Math.round(v);
  const m = clean(v).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function normaliseSaleType(v: unknown, agency: string | null): 'private' | 'social' | null {
  const s = clean(v).toLowerCase();
  if (s) {
    if (/social|aha|part\s*v|approved housing|affordable/.test(s)) return 'social';
    if (/private|open market/.test(s)) return 'private';
  }
  if (agency) return 'social';
  return null;
}

// ---------------------------------------------------------------------------
// Row normalisation
// ---------------------------------------------------------------------------

export function normaliseRows(
  raw: Array<Record<string, unknown>>,
  mapping: HeaderMapping[],
): NormaliseResult {
  const errors: string[] = [];
  const homes: ParsedHome[] = [];

  const headerFor = (field: CanonicalField): string | undefined =>
    mapping.find((m) => m.field === field)?.header;

  const get = (row: Record<string, unknown>, field: CanonicalField): unknown => {
    const header = headerFor(field);
    return header === undefined ? undefined : row[header];
  };

  const getStr = (row: Record<string, unknown>, field: CanonicalField): string | null => {
    const v = clean(get(row, field));
    return v && !EMPTYISH.has(v.toLowerCase()) ? v : null;
  };

  raw.forEach((row, i) => {
    const rowNum = i + 2; // 1-based + header row, for human-readable errors
    const identifier = getStr(row, 'unit_identifier');
    if (!identifier) {
      // A row with values but no identifier is worth flagging; a fully
      // decorative row (totals, spacing) is not.
      const hasAny = Object.values(row).some((v) => clean(v) !== '');
      if (hasAny) errors.push(`Row ${rowNum}: no unit/address value — skipped`);
      return;
    }

    const agency = getStr(row, 'housing_agency');
    const dates: ParsedHome['dates'] = {};
    const flags: ParsedHome['flags'] = {};

    for (const field of DATE_FIELDS) {
      const v = get(row, field);
      if (v === undefined) continue;
      const iso = parseDateLoose(v);
      if (iso) {
        dates[field] = iso;
      } else if (isAffirmative(v)) {
        flags[field] = clean(v);
      }
    }

    homes.push({
      rowNum,
      unit_identifier: identifier,
      house_type: getStr(row, 'house_type'),
      property_designation: getStr(row, 'property_designation'),
      phase: getStr(row, 'phase'),
      bedrooms: parseBedrooms(get(row, 'bedrooms')),
      eircode: getStr(row, 'eircode'),
      purchaser_name: getStr(row, 'purchaser_name'),
      purchaser_email: getStr(row, 'purchaser_email'),
      purchaser_phone: getStr(row, 'purchaser_phone'),
      sale_price: parseMoney(get(row, 'sale_price')),
      status: getStr(row, 'status'),
      sale_type: normaliseSaleType(get(row, 'sale_type'), agency),
      housing_agency: agency,
      solicitor_name: getStr(row, 'solicitor_name'),
      solicitor_email: getStr(row, 'solicitor_email'),
      solicitor_phone: getStr(row, 'solicitor_phone'),
      dates,
      flags,
      comments: getStr(row, 'comments'),
    });
  });

  return { homes, errors };
}

/** Lowercased, whitespace-collapsed key used for duplicate detection. */
export function identifierKey(s: string): string {
  return clean(s).toLowerCase().replace(/\s+/g, ' ');
}
