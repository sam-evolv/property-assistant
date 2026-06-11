/**
 * External snag-list parsing: a snag engineer's own spreadsheet, organised.
 *
 * Pure functions over the same workbook reader as the sales-tracker import.
 * Typical sheets are simple — Room | Item | Description | (No. | Trade |
 * Status) — under any spelling. Plus one optional, fail-soft batch LLM call
 * that assigns trade + severity to each row so the list arrives organised.
 */

import { normHeader } from '@/lib/home-import/parse';

export type SnagField =
  | 'unit_identifier'
  | 'room'
  | 'title'
  | 'description'
  | 'trade'
  | 'severity'
  | 'status'
  | 'date';

export interface SnagHeaderMapping {
  field: SnagField;
  header: string;
}

export interface ParsedSnagRow {
  rowNum: number;
  unit_identifier: string | null;
  room: string | null;
  title: string;
  description: string | null;
  trade: string | null;
  severity: string | null;
  resolved: boolean;
}

const SYNONYMS: Record<SnagField, string[]> = {
  unit_identifier: [
    'unit', 'unit_no', 'unit_number', 'house', 'house_no', 'house_number',
    'plot', 'plot_no', 'plot_number', 'address', 'property', 'site', 'dwelling', 'no',
  ],
  room: ['room', 'location', 'area', 'zone', 'space', 'room_area'],
  title: ['item', 'snag', 'issue', 'defect', 'title', 'summary', 'snag_item'],
  description: [
    'description', 'details', 'notes', 'comment', 'comments', 'observation',
    'defect_description', 'snag_description', 'works_required', 'action_required',
  ],
  trade: ['trade', 'contractor', 'responsibility', 'responsible', 'assigned_to', 'sub_contractor', 'subcontractor'],
  severity: ['severity', 'priority', 'grade', 'category'],
  status: ['status', 'complete', 'completed', 'done', 'closed', 'fixed', 'resolved', 'signed_off'],
  date: ['date', 'date_raised', 'raised', 'logged', 'date_logged', 'inspection_date'],
};

const EXACT_MAP: Map<string, SnagField> = (() => {
  const m = new Map<string, SnagField>();
  (Object.keys(SYNONYMS) as SnagField[]).forEach((field) => {
    for (const syn of SYNONYMS[field]) {
      if (!m.has(syn)) m.set(syn, field);
    }
  });
  return m;
})();

const CONTAINS_RULES: Array<{ test: (h: string) => boolean; field: SnagField }> = [
  { test: (h) => h.includes('descript') || h.includes('detail') || h.includes('works'), field: 'description' },
  { test: (h) => h.includes('room') || h.includes('location') || h.includes('area'), field: 'room' },
  { test: (h) => h.includes('snag') || h.includes('defect') || h.includes('item') || h.includes('issue'), field: 'title' },
  { test: (h) => h.includes('trade') || h.includes('contractor') || h.includes('responsib'), field: 'trade' },
  { test: (h) => h.includes('priorit') || h.includes('severit'), field: 'severity' },
  { test: (h) => h.includes('status') || h.includes('complete') || h.includes('closed'), field: 'status' },
  { test: (h) => h.includes('house') || h.includes('plot') || h.includes('unit') || h.includes('address'), field: 'unit_identifier' },
  { test: (h) => h.includes('date'), field: 'date' },
];

export function mapSnagHeaders(headers: string[]): { mapped: SnagHeaderMapping[]; unmapped: string[] } {
  const mapped: SnagHeaderMapping[] = [];
  const unmapped: string[] = [];
  const taken = new Set<SnagField>();

  for (const header of headers) {
    const norm = normHeader(header);
    if (!norm) continue;
    const exact = EXACT_MAP.get(norm);
    if (exact && !taken.has(exact)) {
      taken.add(exact);
      mapped.push({ field: exact, header });
      continue;
    }
    const rule = CONTAINS_RULES.find((r) => !taken.has(r.field) && r.test(norm));
    if (rule) {
      taken.add(rule.field);
      mapped.push({ field: rule.field, header });
      continue;
    }
    unmapped.push(header);
  }
  return { mapped, unmapped };
}

const EMPTYISH = new Set(['', '-', '–', 'n/a', 'na', 'none']);
const RESOLVED_VALUES = new Set([
  'done', 'complete', 'completed', 'closed', 'fixed', 'resolved', 'yes', 'y',
  'signed off', 'signed_off', 'ok', '✓', '✔',
]);

export function normaliseSnagRows(
  raw: Array<Record<string, unknown>>,
  mapping: SnagHeaderMapping[],
): { rows: ParsedSnagRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: ParsedSnagRow[] = [];

  const headerFor = (field: SnagField) => mapping.find((m) => m.field === field)?.header;
  const getStr = (row: Record<string, unknown>, field: SnagField): string | null => {
    const header = headerFor(field);
    if (header === undefined) return null;
    const v = String(row[header] ?? '').replace(/\s+/g, ' ').trim();
    return v && !EMPTYISH.has(v.toLowerCase()) ? v : null;
  };

  raw.forEach((row, i) => {
    const rowNum = i + 2;
    const titleRaw = getStr(row, 'title');
    const description = getStr(row, 'description');
    const body = titleRaw || description;
    if (!body) {
      const hasAny = Object.values(row).some((v) => String(v ?? '').trim() !== '');
      if (hasAny) errors.push(`Row ${rowNum}: no snag text — skipped`);
      return;
    }
    const title = (titleRaw || description!).slice(0, 120);
    const statusRaw = (getStr(row, 'status') || '').toLowerCase();

    rows.push({
      rowNum,
      unit_identifier: getStr(row, 'unit_identifier'),
      room: getStr(row, 'room'),
      title,
      description: description && description !== title ? description.slice(0, 4000) : null,
      trade: getStr(row, 'trade'),
      severity: getStr(row, 'severity'),
      resolved: RESOLVED_VALUES.has(statusRaw),
    });
  });

  return { rows, errors };
}

// ---------------------------------------------------------------------------
// Optional batch classification — one call organises the whole list.
// ---------------------------------------------------------------------------

const TRADES = [
  'plumbing', 'electrical', 'carpentry', 'painting', 'plastering', 'tiling',
  'roofing', 'windows_doors', 'kitchen', 'flooring', 'heating_ventilation',
  'landscaping', 'bricklaying', 'general',
];
const SEVERITIES = ['low', 'medium', 'high', 'urgent'];
const BATCH_LIMIT = 100;
const TIMEOUT_MS = 15_000;

export interface SnagClassification {
  trade: string | null;
  severity: string | null;
}

/** Index-keyed classifications for up to BATCH_LIMIT rows. Failure -> {}. */
export async function classifySnagBatch(
  rows: ParsedSnagRow[],
): Promise<Record<number, SnagClassification>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || rows.length === 0) return {};

  const batch = rows.slice(0, BATCH_LIMIT);
  const lines = batch.map((r, i) => {
    const text = [r.room, r.title, r.description].filter(Boolean).join(' — ');
    return `${i}: ${text.slice(0, 200)}`;
  });

  const prompt = [
    'These are snags (defects) from a new-build Irish housing development, one per line as "index: text".',
    `For each, assign trade (one of: ${TRADES.join('|')}) and severity (one of: ${SEVERITIES.join('|')}).`,
    'Cosmetic finishes = low; functional defects = medium/high; gas, exposed wiring, water near electrics, structural or fall risks = urgent.',
    'Reply with one JSON object: { "items": [{ "i": <index>, "trade": "...", "severity": "..." }, ...] }.',
    '',
    ...lines,
  ].join('\n');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.SNAG_ANALYSIS_MODEL || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return {};

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') return {};
    const parsed = JSON.parse(content) as { items?: Array<{ i: number; trade?: string; severity?: string }> };

    const out: Record<number, SnagClassification> = {};
    for (const item of parsed.items || []) {
      if (typeof item.i !== 'number' || item.i < 0 || item.i >= batch.length) continue;
      const trade = typeof item.trade === 'string' && TRADES.includes(item.trade) ? item.trade : null;
      const severity = typeof item.severity === 'string' && SEVERITIES.includes(item.severity) ? item.severity : null;
      out[item.i] = { trade, severity };
    }
    return out;
  } catch {
    return {};
  }
}
