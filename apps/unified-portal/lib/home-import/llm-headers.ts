/**
 * Optional LLM assist for spreadsheet headers the heuristics couldn't map.
 * One small JSON call; any failure, timeout, or missing key returns {} and
 * the heuristic result stands — this must never block an import.
 */

import type { CanonicalField } from './parse';

const CANONICAL_FIELDS: CanonicalField[] = [
  'unit_identifier', 'house_type', 'property_designation', 'phase', 'bedrooms',
  'eircode', 'purchaser_name', 'purchaser_email', 'purchaser_phone',
  'sale_price', 'status', 'sale_type', 'housing_agency', 'solicitor_name',
  'solicitor_email', 'solicitor_phone', 'release_date', 'sale_agreed_date',
  'proof_of_funds_date', 'sadrl_date', 'deposit_date', 'deposit_receipt_date',
  'loan_approved_date', 'contracts_issued_date', 'queries_raised_date',
  'queries_replied_date', 'signed_contracts_date', 'counter_signed_date',
  'one_part_returned_date', 'projected_handover_date', 'snagging_start_date',
  'snag_date', 'drawdown_date', 'handover_date', 'mortgage_expiry_date',
  'comments',
];

const TIMEOUT_MS = 5000;

export async function suggestHeaderMappings(
  unmappedHeaders: string[],
  sampleValues: Record<string, string[]>,
  alreadyMapped: CanonicalField[],
): Promise<Partial<Record<string, CanonicalField>>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || unmappedHeaders.length === 0) return {};

  const available = CANONICAL_FIELDS.filter((f) => !alreadyMapped.includes(f));
  if (available.length === 0) return {};

  const prompt = [
    'You map spreadsheet column headers from an Irish housing development sales tracker to canonical fields.',
    `Canonical fields: ${available.join(', ')}`,
    'Headers to map (with sample values):',
    ...unmappedHeaders.map(
      (h) => `- "${h}" (samples: ${(sampleValues[h] || []).slice(0, 3).join(' | ') || 'none'})`,
    ),
    'Reply with a JSON object mapping each header string to a canonical field, omitting headers that match nothing.',
    'Never map two headers to the same field. Dates in these sheets are day-first (Irish).',
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
        model: process.env.IMPORT_MAPPING_MODEL || 'gpt-4.1-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return {};

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return {};
    const parsed = JSON.parse(content) as Record<string, unknown>;

    const out: Partial<Record<string, CanonicalField>> = {};
    const used = new Set<CanonicalField>(alreadyMapped);
    for (const header of unmappedHeaders) {
      const field = parsed[header];
      if (
        typeof field === 'string' &&
        (available as string[]).includes(field) &&
        !used.has(field as CanonicalField)
      ) {
        out[header] = field as CanonicalField;
        used.add(field as CanonicalField);
      }
    }
    return out;
  } catch {
    return {};
  }
}
