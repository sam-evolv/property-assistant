/**
 * Sales Pipeline API - Single Note Operations
 *
 * PATCH /api/pipeline/[developmentId]/[unitId]/notes/[noteId]
 * Update a note (resolve/unresolve)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string; noteId: string }> }
) {
  try {
    const { developmentId, unitId, noteId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { tenantId, id: adminId, email } = session;

    if (!tenantId || !adminId) {
      return NextResponse.json({ error: 'Context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const body = await request.json();
    const { resolved } = body;

    if (typeof resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400 });
    }

    // Get and verify the note exists and belongs to this tenant
    const { data: existingNote, error: fetchError } = await supabaseAdmin
      .from('unit_pipeline_notes')
      .select('*')
      .eq('id', noteId)
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single();

    if (fetchError || !existingNote) {
      console.error('[Pipeline Note PATCH API] Note not found:', fetchError);
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Update the note
    const now = new Date().toISOString();
    const updateData: Record<string, any> = {
      is_resolved: resolved,
      updated_at: now,
    };

    if (resolved) {
      updateData.resolved_at = now;
      updateData.resolved_by = adminId;
      updateData.resolved_by_email = email;
    } else {
      updateData.resolved_at = null;
      updateData.resolved_by = null;
      updateData.resolved_by_email = null;
    }

    const { data: updatedNote, error: updateError } = await supabaseAdmin
      .from('unit_pipeline_notes')
      .update(updateData)
      .eq('id', noteId)
      .select()
      .single();

    if (updateError || !updatedNote) {
      console.error('[Pipeline Note PATCH API] Error updating note:', updateError);
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
    }

    // Audit log using Supabase (skip if it fails - non-critical)
    try {
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        type: 'pipeline',
        action: resolved ? 'note_resolved' : 'note_reopened',
        actor: email,
        actor_id: adminId,
        metadata: {
          note_id: noteId,
          unit_id: unitId,
          development_id: developmentId,
        },
      });
    } catch (auditError) {
      console.error('[Pipeline Note PATCH API] Audit log failed (non-critical):', auditError);
    }

    return NextResponse.json({
      note: {
        id: updatedNote.id,
        content: updatedNote.content,
        resolved: updatedNote.is_resolved || false,
        createdAt: updatedNote.created_at,
        createdBy: updatedNote.created_by_email || '',
      },
    });
  } catch (error) {
    console.error('[Pipeline Note PATCH API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
