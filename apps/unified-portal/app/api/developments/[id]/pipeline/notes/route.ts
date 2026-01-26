import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { unitPipelineNotes, admins } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const { searchParams } = new URL(request.url);
    const pipelineId = searchParams.get('pipelineId');

    if (!pipelineId) {
      return NextResponse.json({ error: 'pipelineId is required' }, { status: 400 });
    }

    const notes = await db
      .select({
        id: unitPipelineNotes.id,
        pipeline_id: unitPipelineNotes.pipeline_id,
        note: unitPipelineNotes.note,
        is_query: unitPipelineNotes.is_query,
        is_resolved: unitPipelineNotes.is_resolved,
        created_at: unitPipelineNotes.created_at,
        resolved_at: unitPipelineNotes.resolved_at,
        created_by_name: admins.name,
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
    const body = await request.json();
    const { pipelineId, note, isQuery } = body;

    if (!pipelineId || !note) {
      return NextResponse.json({ error: 'pipelineId and note are required' }, { status: 400 });
    }

    const adminId = (session as any).admin?.id;
    const tenantId = (session as any).admin?.tenant_id;

    const [newNote] = await db
      .insert(unitPipelineNotes)
      .values({
        tenant_id: tenantId,
        pipeline_id: pipelineId,
        note: note.trim(),
        is_query: isQuery || false,
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
    const body = await request.json();
    const { noteId, resolve } = body;

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    const adminId = (session as any).admin?.id;

    const [updated] = await db
      .update(unitPipelineNotes)
      .set({
        is_resolved: resolve,
        resolved_by: resolve ? adminId : null,
        resolved_at: resolve ? new Date() : null,
      })
      .where(eq(unitPipelineNotes.id, noteId))
      .returning();

    return NextResponse.json({ note: updated });

  } catch (error) {
    console.error('[Pipeline Notes] Error updating:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}
