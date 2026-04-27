import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/lettings/extract-lease
 *
 * Body: { documentId: string }
 *
 * Pulls a previously-uploaded lease PDF out of Supabase Storage, extracts
 * its text via pdf-parse, then asks gpt-4o-mini for the structured fields
 * the review screen needs. Updates the lettings_documents row in place
 * with ai_extracted_data + ai_extraction_status.
 *
 * Strict JSON schema response_format guarantees the response shape — no
 * eyeballed parsing, no hallucinated fields. The system prompt explicitly
 * says "do not infer; return null when not confident", and per-field
 * confidences come back so Session 8 can amber-underline anything < 0.7.
 *
 * Wraps the model call in a 30s timeout — long leases hit ~10-12s.
 */

const BUCKET = 'lettings-documents';
const MODEL = 'gpt-4o-mini';
const MAX_PDF_TEXT_CHARS = 30_000;
const OPENAI_TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are extracting structured data from an Irish residential tenancy agreement.

Strict rules:
- Do not infer values. Only extract what is explicitly stated in the document.
- If you cannot find a value with high confidence, set that field to null.
- Do not hallucinate plausible-looking values. A confidently-null field is correct;
  a guessed-wrong field is harmful.
- Return per-field confidences in fieldConfidences as numbers between 0 and 1.
  A confidence below 0.7 will be flagged in the UI for the agent to verify.
- Dates must be ISO 8601 (YYYY-MM-DD).
- Money values are euro amounts (number, not string, no currency symbol).
- leaseType is one of: fixed_term | periodic | part_4 | further_part_4 (Irish
  tenancy classifications). Return null if unclear.
- rtbRegistrationNumber is the Residential Tenancies Board registration ID,
  if present in the document.
- coTenantNames is an array — empty if there are no co-tenants. Don't put the
  primary tenant's name in here.

If the input doesn't look like a residential lease at all, set every nullable
field to null and confidences to 0. Do not refuse — just return nulls.`;

const EXTRACTION_FIELDS = [
  'primaryTenantName',
  'coTenantNames',
  'monthlyRentEur',
  'depositAmountEur',
  'leaseStartDate',
  'leaseEndDate',
  'leaseType',
  'noticePeriodDays',
  'rtbRegistrationNumber',
  'breakClauseText',
  'rentPaymentDay',
] as const;

type ExtractionField = (typeof EXTRACTION_FIELDS)[number];

type ExtractedLease = {
  primaryTenantName: string | null;
  coTenantNames: string[];
  monthlyRentEur: number | null;
  depositAmountEur: number | null;
  leaseStartDate: string | null;
  leaseEndDate: string | null;
  leaseType: 'fixed_term' | 'periodic' | 'part_4' | 'further_part_4' | null;
  noticePeriodDays: number | null;
  rtbRegistrationNumber: string | null;
  breakClauseText: string | null;
  rentPaymentDay: number | null;
  fieldConfidences: Record<ExtractionField, number>;
};

const RESPONSE_JSON_SCHEMA = {
  name: 'irish_residential_lease',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      primaryTenantName: { type: ['string', 'null'] },
      coTenantNames: { type: 'array', items: { type: 'string' } },
      monthlyRentEur: { type: ['number', 'null'] },
      depositAmountEur: { type: ['number', 'null'] },
      leaseStartDate: {
        type: ['string', 'null'],
        description: 'ISO 8601 date YYYY-MM-DD',
      },
      leaseEndDate: {
        type: ['string', 'null'],
        description: 'ISO 8601 date YYYY-MM-DD',
      },
      leaseType: {
        type: ['string', 'null'],
        enum: ['fixed_term', 'periodic', 'part_4', 'further_part_4', null],
      },
      noticePeriodDays: { type: ['integer', 'null'] },
      rtbRegistrationNumber: { type: ['string', 'null'] },
      breakClauseText: { type: ['string', 'null'] },
      rentPaymentDay: { type: ['integer', 'null'] },
      fieldConfidences: {
        type: 'object',
        additionalProperties: false,
        properties: Object.fromEntries(
          EXTRACTION_FIELDS.map((f) => [f, { type: 'number' }]),
        ),
        required: [...EXTRACTION_FIELDS],
      },
    },
    required: [...EXTRACTION_FIELDS, 'fieldConfidences'],
  },
} as const;

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    await requireRole(['developer', 'admin', 'super_admin']);

    const body = await request.json().catch(() => null);
    const documentId = typeof body?.documentId === 'string' ? body.documentId.trim() : '';
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: agentProfile } = await admin
      .from('agent_profiles')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!agentProfile) {
      return NextResponse.json({ error: 'No agent profile for this user' }, { status: 403 });
    }

    const { data: doc, error: docErr } = await admin
      .from('lettings_documents')
      .select('id, agent_id, tenant_id, file_url, doc_type, ai_extracted_data, ai_extraction_status')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (doc.agent_id !== agentProfile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (doc.doc_type !== 'lease') {
      return NextResponse.json({ error: 'Document is not a lease' }, { status: 400 });
    }

    // Cache hit: extraction already ran successfully, skip the OpenAI call
    // and return what we've got. The review screen polls this endpoint on
    // mount; without this short-circuit a back-and-forward navigation would
    // burn tokens.
    if (
      (doc.ai_extraction_status === 'success' || doc.ai_extraction_status === 'partial')
      && doc.ai_extracted_data
    ) {
      console.log(`[lettings-extract] cache_hit documentId=${documentId}`);
      return NextResponse.json({
        documentId: doc.id,
        status: doc.ai_extraction_status,
        extracted: doc.ai_extracted_data,
        cached: true,
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await admin
        .from('lettings_documents')
        .update({ ai_extraction_status: 'failed' })
        .eq('id', documentId);
      console.error('[lettings-extract] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'OpenAI not configured — set OPENAI_API_KEY in Vercel env' },
        { status: 500 },
      );
    }

    // 1. Fetch the PDF from Storage.
    const { data: download, error: dlErr } = await admin.storage
      .from(BUCKET)
      .download(doc.file_url);
    if (dlErr || !download) {
      await admin
        .from('lettings_documents')
        .update({ ai_extraction_status: 'failed' })
        .eq('id', documentId);
      console.error(`[lettings-extract] storage download failed: ${dlErr?.message ?? 'no data'}`);
      return NextResponse.json(
        { error: 'Could not fetch lease PDF from storage' },
        { status: 500 },
      );
    }
    const pdfBuffer = Buffer.from(await download.arrayBuffer());

    // 2. Extract text — same pdf-parse pattern as lib/floorplan/extractor.ts.
    let pdfText = '';
    try {
      const pdfMod = (await import('pdf-parse')) as unknown as {
        default?: (buf: Buffer) => Promise<{ text?: string }>;
      } & ((buf: Buffer) => Promise<{ text?: string }>);
      const pdfParse = pdfMod.default ?? pdfMod;
      const pdfData = await pdfParse(pdfBuffer);
      pdfText = (pdfData?.text ?? '').trim();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from('lettings_documents')
        .update({ ai_extraction_status: 'failed' })
        .eq('id', documentId);
      console.error(`[lettings-extract] pdf-parse failed: ${msg}`);
      return NextResponse.json(
        { error: 'Could not read PDF — file may be corrupted or encrypted' },
        { status: 422 },
      );
    }

    if (pdfText.length < 50) {
      const empty = emptyExtraction();
      await admin
        .from('lettings_documents')
        .update({
          ai_extracted_data: empty,
          ai_extraction_status: 'failed',
          ai_extraction_confidence: 0,
        })
        .eq('id', documentId);
      console.warn(
        `[lettings-extract] pdf_text_too_short documentId=${documentId} chars=${pdfText.length}`,
      );
      return NextResponse.json({
        documentId: doc.id,
        status: 'failed',
        extracted: empty,
        reason: 'PDF appears to contain no extractable text (image-only?)',
      });
    }

    // 3. Cap text to keep us under gpt-4o-mini's context window comfortably.
    const truncated =
      pdfText.length > MAX_PDF_TEXT_CHARS
        ? pdfText.slice(0, MAX_PDF_TEXT_CHARS) + '\n\n[document truncated]'
        : pdfText;

    // 4. Call OpenAI with strict JSON schema. The 30s ceiling protects us
    //    from a stalled model call hanging the request.
    const openai = new OpenAI({ apiKey, timeout: OPENAI_TIMEOUT_MS });
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        response_format: {
          type: 'json_schema',
          json_schema: RESPONSE_JSON_SCHEMA,
        },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Lease document text:\n\n${truncated}` },
        ],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from('lettings_documents')
        .update({ ai_extraction_status: 'failed' })
        .eq('id', documentId);
      console.error(`[lettings-extract] openai_call_failed documentId=${documentId} reason=${msg}`);
      return NextResponse.json(
        { error: 'Extraction failed — please try again' },
        { status: 502 },
      );
    }

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) {
      await admin
        .from('lettings_documents')
        .update({ ai_extraction_status: 'failed' })
        .eq('id', documentId);
      console.error(`[lettings-extract] empty_completion documentId=${documentId}`);
      return NextResponse.json({ error: 'Empty response from extractor' }, { status: 502 });
    }

    let extracted: ExtractedLease;
    try {
      extracted = normaliseExtraction(JSON.parse(raw));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from('lettings_documents')
        .update({ ai_extraction_status: 'failed' })
        .eq('id', documentId);
      console.error(`[lettings-extract] parse_failed documentId=${documentId} reason=${msg}`);
      return NextResponse.json({ error: 'Could not parse extractor output' }, { status: 502 });
    }

    // 5. Decide success vs partial. Success = primary tenant + rent + lease
    //    start all populated. Anything less is partial — still useful, but
    //    Session 8 will flag it.
    const isPartial =
      !extracted.primaryTenantName
      || extracted.monthlyRentEur == null
      || !extracted.leaseStartDate;
    const status: 'success' | 'partial' = isPartial ? 'partial' : 'success';

    const confidenceValues = Object.values(extracted.fieldConfidences).filter(
      (n): n is number => typeof n === 'number' && Number.isFinite(n),
    );
    const avgConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
        : 0;

    const { error: updateErr } = await admin
      .from('lettings_documents')
      .update({
        ai_extracted_data: extracted,
        ai_extraction_status: status,
        ai_extraction_confidence: Number(avgConfidence.toFixed(2)),
      })
      .eq('id', documentId);

    if (updateErr) {
      console.error(`[lettings-extract] update_failed documentId=${documentId} reason=${updateErr.message}`);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    console.log(
      `[lettings-extract] ${status} documentId=${documentId} avg_conf=${avgConfidence.toFixed(2)} duration_ms=${Date.now() - started}`,
    );

    return NextResponse.json({
      documentId: doc.id,
      status,
      extracted,
      cached: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED' || message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(`[lettings-extract] error duration_ms=${Date.now() - started} reason=${message}`);
    return NextResponse.json({ error: 'Lease extraction failed' }, { status: 500 });
  }
}

function emptyExtraction(): ExtractedLease {
  return {
    primaryTenantName: null,
    coTenantNames: [],
    monthlyRentEur: null,
    depositAmountEur: null,
    leaseStartDate: null,
    leaseEndDate: null,
    leaseType: null,
    noticePeriodDays: null,
    rtbRegistrationNumber: null,
    breakClauseText: null,
    rentPaymentDay: null,
    fieldConfidences: Object.fromEntries(
      EXTRACTION_FIELDS.map((f) => [f, 0]),
    ) as Record<ExtractionField, number>,
  };
}

function normaliseExtraction(raw: unknown): ExtractedLease {
  // Strict json_schema mode means the structure is already shaped correctly
  // by the model; this is a defensive cast for the type system + a
  // narrowing of the confidences map to the fields we know about.
  const r = raw as Partial<ExtractedLease>;
  const confidences: Record<ExtractionField, number> = Object.fromEntries(
    EXTRACTION_FIELDS.map((f) => [
      f,
      typeof r.fieldConfidences?.[f] === 'number' ? r.fieldConfidences[f] : 0,
    ]),
  ) as Record<ExtractionField, number>;

  return {
    primaryTenantName: stringOrNull(r.primaryTenantName),
    coTenantNames: Array.isArray(r.coTenantNames)
      ? r.coTenantNames.filter((s): s is string => typeof s === 'string')
      : [],
    monthlyRentEur: numberOrNull(r.monthlyRentEur),
    depositAmountEur: numberOrNull(r.depositAmountEur),
    leaseStartDate: stringOrNull(r.leaseStartDate),
    leaseEndDate: stringOrNull(r.leaseEndDate),
    leaseType: leaseTypeOrNull(r.leaseType),
    noticePeriodDays: integerOrNull(r.noticePeriodDays),
    rtbRegistrationNumber: stringOrNull(r.rtbRegistrationNumber),
    breakClauseText: stringOrNull(r.breakClauseText),
    rentPaymentDay: integerOrNull(r.rentPaymentDay),
    fieldConfidences: confidences,
  };
}

function stringOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}
function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function integerOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}
function leaseTypeOrNull(v: unknown): ExtractedLease['leaseType'] {
  if (v === 'fixed_term' || v === 'periodic' || v === 'part_4' || v === 'further_part_4') {
    return v;
  }
  return null;
}
