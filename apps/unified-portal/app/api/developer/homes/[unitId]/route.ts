export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSupabaseAdmin } from '@/lib/supabase-server';
import { z } from 'zod';

/**
 * PATCH /api/developer/homes/[unitId]
 *
 * Edits the facts of one home from the Home file: unit details, purchaser
 * contact (kept in sync on the pipeline record), price and solicitor.
 * Whitelisted fields only; empty strings clear a value. Conveyancing
 * dates stay on the pipeline PATCH (audited there).
 */

const BodySchema = z.object({
  address: z.string().trim().max(200).optional(),
  house_type_code: z.string().trim().max(40).optional(),
  bedrooms: z.union([z.number().int().min(0).max(20), z.literal('')]).optional(),
  eircode: z.string().trim().max(12).optional(),
  phase: z.string().trim().max(40).optional(),
  property_designation: z.string().trim().max(40).optional(),
  purchaser_name: z.string().trim().max(160).optional(),
  purchaser_email: z.union([z.string().trim().email().max(160), z.literal('')]).optional(),
  purchaser_phone: z.string().trim().max(40).optional(),
  sale_price: z.union([z.number().min(0), z.literal('')]).optional(),
  solicitor_firm: z.string().trim().max(160).optional(),
  solicitor_name: z.string().trim().max(160).optional(),
  solicitor_email: z.union([z.string().trim().email().max(160), z.literal('')]).optional(),
  solicitor_phone: z.string().trim().max(40).optional(),
});

const MISSING_COLUMN_RE = /Could not find the '([^']+)' column/i;

/** Update that quietly drops columns the live table doesn't have yet. */
async function updateWithColumnFallback(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  updates: Record<string, unknown>,
  match: Record<string, string>,
): Promise<string | null> {
  const payload = { ...updates };
  for (let attempt = 0; attempt < 6; attempt++) {
    if (Object.keys(payload).length === 0) return null;
    let query = supabase.from(table).update(payload);
    for (const [k, v] of Object.entries(match)) query = query.eq(k, v);
    const { error } = await query;
    if (!error) return null;
    const missing = error.message?.match(MISSING_COLUMN_RE)?.[1];
    if (missing && missing in payload) {
      delete payload[missing];
      continue;
    }
    return error.message;
  }
  return 'Too many missing columns';
}

const nullable = (v: string | undefined) => (v === undefined ? undefined : v || null);

export async function PATCH(
  request: NextRequest,
  { params }: { params: { unitId: string } },
) {
  let session;
  try {
    session = await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first ? `${first.path.join('.')}: ${first.message}` : 'Check the form' },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const supabase = getSupabaseAdmin();
  const { data: unit } = await supabase
    .from('units')
    .select('id, tenant_id, development_id')
    .eq('id', params.unitId)
    .maybeSingle();
  if (!unit) return NextResponse.json({ error: 'Home not found' }, { status: 404 });
  if (session.role !== 'super_admin' && unit.tenant_id !== session.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // --- units ---
  const unitUpdates: Record<string, unknown> = {};
  if (body.address !== undefined) {
    unitUpdates.address = body.address || null;
    unitUpdates.address_line_1 = body.address || null;
  }
  if (body.house_type_code !== undefined) unitUpdates.house_type_code = body.house_type_code || 'TBD';
  if (body.bedrooms !== undefined) unitUpdates.bedrooms = body.bedrooms === '' ? null : body.bedrooms;
  if (body.eircode !== undefined) unitUpdates.eircode = nullable(body.eircode);
  if (body.phase !== undefined) unitUpdates.phase = nullable(body.phase);
  if (body.property_designation !== undefined) unitUpdates.property_designation = nullable(body.property_designation);
  if (body.purchaser_name !== undefined) unitUpdates.purchaser_name = nullable(body.purchaser_name);
  if (body.purchaser_email !== undefined) unitUpdates.purchaser_email = nullable(body.purchaser_email);
  if (body.purchaser_phone !== undefined) unitUpdates.purchaser_phone = nullable(body.purchaser_phone);

  if (Object.keys(unitUpdates).length > 0) {
    const err = await updateWithColumnFallback(supabase, 'units', unitUpdates, { id: unit.id });
    if (err) return NextResponse.json({ error: `Could not save: ${err}` }, { status: 500 });
  }

  // --- pipeline (purchaser sync + price + solicitor) ---
  const pipelineUpdates: Record<string, unknown> = {};
  if (body.purchaser_name !== undefined) pipelineUpdates.purchaser_name = nullable(body.purchaser_name);
  if (body.purchaser_email !== undefined) pipelineUpdates.purchaser_email = nullable(body.purchaser_email);
  if (body.purchaser_phone !== undefined) pipelineUpdates.purchaser_phone = nullable(body.purchaser_phone);
  if (body.sale_price !== undefined) pipelineUpdates.sale_price = body.sale_price === '' ? null : body.sale_price;
  if (body.solicitor_firm !== undefined) pipelineUpdates.solicitor_firm = nullable(body.solicitor_firm);
  if (body.solicitor_name !== undefined) pipelineUpdates.solicitor_name = nullable(body.solicitor_name);
  if (body.solicitor_email !== undefined) pipelineUpdates.solicitor_email = nullable(body.solicitor_email);
  if (body.solicitor_phone !== undefined) pipelineUpdates.solicitor_phone = nullable(body.solicitor_phone);

  if (Object.keys(pipelineUpdates).length > 0) {
    const { data: pipeline } = await supabase
      .from('unit_sales_pipeline')
      .select('id')
      .eq('unit_id', unit.id)
      .maybeSingle();

    if (pipeline?.id) {
      const err = await updateWithColumnFallback(
        supabase,
        'unit_sales_pipeline',
        { ...pipelineUpdates, updated_at: new Date().toISOString() },
        { id: pipeline.id },
      );
      if (err) return NextResponse.json({ error: `Saved the home, but not the sale details: ${err}` }, { status: 500 });
    } else {
      const insert: Record<string, unknown> = {
        tenant_id: unit.tenant_id,
        development_id: unit.development_id,
        unit_id: unit.id,
      };
      for (const [k, v] of Object.entries(pipelineUpdates)) {
        if (v !== null && v !== undefined) insert[k] = v;
      }
      if (Object.keys(insert).length > 3) {
        const { error: insErr } = await supabase.from('unit_sales_pipeline').insert(insert);
        if (insErr && !MISSING_COLUMN_RE.test(insErr.message || '')) {
          return NextResponse.json(
            { error: `Saved the home, but not the sale details: ${insErr.message}` },
            { status: 500 },
          );
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
