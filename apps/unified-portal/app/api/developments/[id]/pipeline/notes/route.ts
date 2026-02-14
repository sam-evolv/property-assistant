import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { unitPipelineNotes, unitSalesPipeline, admins, developments } from '@openhouse/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function verifyPipelineAccess(
  pipelineId: string,
  developmentId: string,
  tenantId: string
): Promise<{ id: string; unit_id: string } | null> {
  const [dev] = await db
    .select({ id: developments.id })
    .from(developments)
    .where(and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId)))
    .limit(1);
  
  if (!dev) return null;

  const [record] = await db
    .select({ id: unitSalesPipeline.id, unit_id: unitSalesPipeline.unit_id })
    .from(unitSalesPipeline)
    .where(and(
      eq(unitSalesPipeline.id, pipelineId),
      eq(unitSalesPipeline.development_id, developmentId)
    ))
    .limit(1);
  return record ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const developmentId = params.id;
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    if (!pipelineId) {
      return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 });
    }

    const pipelineRecord = await verifyPipelineAccess(pipelineId, developmentId, tenantId);
    if (!pipelineRecord) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const notes = await db
      .select({
        id: unitPipelineNotes.id,
        pipeline_id: unitPipelineNotes.pipeline_id,
        note: unitPipelineNotes.content,
        is_query: sql<boolean>`${unitPipelineNotes.note_type} = 'query'`,
        is_resolved: unitPipelineNotes.is_resolved,
        created_at: unitPipelineNotes.created_at,
        resolved_at: unitPipelineNotes.resolved_at,
        created_by_name: admins.email,
      })
      .from(unitPipelineNotes)
      .leftJoin(admins, eq(unitPipelineNotes.created_by, admins.id))
      .where(eq(unitPipelineNotes.pipeline_id, pipelineId))
      .orderBy(desc(unitPipelineNotes.created_at));

    return NextResponse.json({ notes });

  } catch (error) {
    console.error('[Pipeline Notes] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const developmentId = params.id;
    const tenantId = session.tenantId;
    const body = await request.json();
    const { pipelineId, note, isQuery } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    if (!pipelineId || !note) {
      return NextResponse.json({ error: 'pipelineId and note are required' }, { status: 400 });
    }

    const pipelineRecord = await verifyPipelineAccess(pipelineId, developmentId, tenantId);
    if (!pipelineRecord) {
      return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 });
    }

    const adminId = (session as any).admin?.id;
    if (!adminId) {
      return NextResponse.json({ error: 'Admin context required' }, { status: 403 });
    }

    const [newNote] = await db
      .insert(unitPipelineNotes)
      .values({
        tenant_id: tenantId,
        pipeline_id: pipelineId,
        unit_id: pipelineRecord.unit_id,
        content: note.trim(),
        note_type: isQuery ? 'query' : 'general',
        created_by: adminId,
      })
      .returning();

    return NextResponse.json({ note: newNote });

  } catch (error) {
    console.error('[Pipeline Notes] Error creating:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const developmentId = params.id;
    const tenantId = session.tenantId;
    const body = await request.json();
    const { noteId, resolve } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    const [existingNote] = await db
      .select({ id: unitPipelineNotes.id, pipeline_id: unitPipelineNotes.pipeline_id })
      .from(unitPipelineNotes)
      .where(and(
        eq(unitPipelineNotes.id, noteId),
        eq(unitPipelineNotes.tenant_id, tenantId)
      ))
      .limit(1);

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const pipelineRecord = await verifyPipelineAccess(existingNote.pipeline_id, developmentId, tenantId);
    if (!pipelineRecord) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const adminId = (session as any).admin?.id;

    const [updated] = await db
      .update(unitPipelineNotes)
      .set({
        is_resolved: resolve,
        resolved_by: resolve ? adminId : null,
        resolved_at: resolve ? new Date() : null,
      })
      .where(and(eq(unitPipelineNotes.id, noteId), eq(unitPipelineNotes.tenant_id, tenantId)))
      .returning();

    return NextResponse.json({ note: updated });

  } catch (error) {
    console.error('[Pipeline Notes] Error updating:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}
