import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lettings/import/suggest-mapping
 *
 * Body: { headers: string[], sampleRows: string[][] }
 *
 * Asks gpt-4o-mini to map each CSV header to one of our target fields.
 * Falls back to a regex/keyword matcher if OpenAI is unavailable so the
 * import flow never blocks on AI.
 */

const TARGET_FIELDS = [
  'address_line_1', 'address_line_2', 'city', 'county', 'eircode',
  'property_type', 'bedrooms', 'bathrooms', 'floor_area_sqm', 'ber_rating',
  'tenant_name', 'tenant_email', 'tenant_phone', 'monthly_rent_eur',
  'lease_start_date', 'lease_end_date', 'rtb_registration_number', '_skip',
] as const;

type Confidence = 'high' | 'medium' | 'low';
type Mapping = { header: string; suggestedField: string; confidence: Confidence };

const SYSTEM_PROMPT = `You are a CSV column mapper for an Irish lettings property database. Map each input header to exactly one of these target fields, using "_skip" if no good match.

Targets: ${TARGET_FIELDS.join(', ')}.

Return per-header suggestions with confidence:
- high: header text is unambiguous (e.g. "Eircode" → eircode, "Monthly Rent" → monthly_rent_eur)
- medium: clear meaning but multiple candidates (e.g. "Address" could be address_line_1 or city)
- low: best-guess only

If two headers map to the same target, pick the better fit and mark the loser as _skip.`;

const RESPONSE_SCHEMA = {
  name: 'csv_column_mapping',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      mappings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            header: { type: 'string' },
            suggestedField: { type: 'string', enum: [...TARGET_FIELDS] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['header', 'suggestedField', 'confidence'],
        },
      },
    },
    required: ['mappings'],
  },
} as const;

function regexFallback(headers: string[]): Mapping[] {
  const rules: Array<[RegExp, string]> = [
    [/^address[_\s]?line[_\s]?1$|^address$|^street$|^line[_\s]?1$/i, 'address_line_1'],
    [/^address[_\s]?line[_\s]?2$|^line[_\s]?2$/i, 'address_line_2'],
    [/^town$|^city$/i, 'city'],
    [/^county$/i, 'county'],
    [/^eir[\s]?code$|^postcode$|^post[\s]?code$/i, 'eircode'],
    [/property[_\s]?type|^type$/i, 'property_type'],
    [/^bedrooms?$|^beds?$/i, 'bedrooms'],
    [/^bathrooms?$|^baths?$/i, 'bathrooms'],
    [/floor[_\s]?area|^area$|sqm/i, 'floor_area_sqm'],
    [/ber[_\s]?rating|^ber$/i, 'ber_rating'],
    [/tenant[_\s]?name|^tenant$/i, 'tenant_name'],
    [/tenant[_\s]?email|^email$/i, 'tenant_email'],
    [/tenant[_\s]?phone|^phone$|^mobile$/i, 'tenant_phone'],
    [/rent|monthly[_\s]?rent/i, 'monthly_rent_eur'],
    [/lease[_\s]?start|start[_\s]?date/i, 'lease_start_date'],
    [/lease[_\s]?end|end[_\s]?date/i, 'lease_end_date'],
    [/rtb/i, 'rtb_registration_number'],
  ];
  return headers.map((h) => {
    for (const [re, target] of rules) {
      if (re.test(h)) return { header: h, suggestedField: target, confidence: 'medium' as Confidence };
    }
    return { header: h, suggestedField: '_skip', confidence: 'low' as Confidence };
  });
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try {
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookies() });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!agentProfile) return NextResponse.json({ error: 'No agent profile' }, { status: 403 });

    const body = await req.json().catch(() => null);
    const headers: string[] = Array.isArray(body?.headers) ? body.headers.filter((h: unknown): h is string => typeof h === 'string') : [];
    const sampleRows: string[][] = Array.isArray(body?.sampleRows)
      ? body.sampleRows.slice(0, 5).map((r: unknown) => Array.isArray(r) ? r.map((c) => String(c ?? '')) : [])
      : [];
    if (headers.length === 0) {
      return NextResponse.json({ error: 'No headers provided' }, { status: 400 });
    }

    console.log(`[lettings-import-mapping] start headers=${headers.length}`);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('[lettings-import-mapping] OPENAI_API_KEY missing — using regex fallback');
      return NextResponse.json({ mappings: regexFallback(headers) });
    }

    try {
      const openai = new OpenAI({ apiKey, timeout: 20_000 });
      const sampleText = sampleRows
        .map((r, i) => `Row ${i + 1}: ${headers.map((h, j) => `${h}=${r[j] ?? ''}`).join(' | ')}`)
        .join('\n');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Headers: ${headers.join(', ')}\n\nSample rows:\n${sampleText}` },
        ],
      });
      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) throw new Error('Empty completion');
      const parsed = JSON.parse(raw) as { mappings: Mapping[] };
      console.log(`[lettings-import-mapping] ai_ok duration_ms=${Date.now() - started}`);
      return NextResponse.json({ mappings: parsed.mappings });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[lettings-import-mapping] ai_failed_fallback reason=${msg}`);
      return NextResponse.json({ mappings: regexFallback(headers) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[lettings-import-mapping] error reason=${message}`);
    return NextResponse.json({ error: 'Mapping suggestion failed' }, { status: 500 });
  }
}
