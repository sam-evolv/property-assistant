/**
 * Sales Pipeline API - Unit Notes
 *
 * GET /api/pipeline/[developmentId]/[unitId]/notes
 * Get all notes for a unit
 *
 * POST /api/pipeline/[developmentId]/[unitId]/notes
 * Add a note to a unit
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

/**
 * GET /api/pipeline/[developmentId]/[unitId]/notes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string }> }
) {
  try {
    const { developmentId, unitId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get pipeline record using Supabase
    const { data: pipeline, error: pipelineError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single();

    if (pipelineError && pipelineError.code !== 'PGRST116') {
      console.error('[Pipeline Notes GET API] Error fetching pipeline:', pipelineError);
    }

    if (!pipeline) {
      return NextResponse.json({ notes: [] });
    }

    // Get notes using Supabase
    const { data: notes, error: notesError } = await supabaseAdmin
      .from('unit_pipeline_notes')
      .select('*')
      .eq('pipeline_id', pipeline.id)
      .order('created_at', { ascending: false });

    if (notesError) {
      console.error('[Pipeline Notes GET API] Error fetching notes:', notesError);
      return NextResponse.json({ notes: [] });
    }

    // Format notes for response
    const formattedNotes = (notes || []).map((note: any) => ({
      id: note.id,
      content: note.content,
      resolved: note.is_resolved || false,
      createdAt: note.created_at,
      createdBy: note.created_by_email || '',
    }));

    return NextResponse.json({ notes: formattedNotes });
  } catch (error) {
    console.error('[Pipeline Notes GET API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/pipeline/[developmentId]/[unitId]/notes
 * Add a new note
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string }> }
) {
  try {
    const { developmentId, unitId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { tenantId, id: adminId, email } = session;

    if (!tenantId || !adminId) {
      return NextResponse.json({ error: 'Context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    // Get or create pipeline record using Supabase
    let pipelineId: string;

    const { data: existingPipeline, error: fetchError } = await supabaseAdmin
      .from('unit_sales_pipeline')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('unit_id', unitId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[Pipeline Notes POST API] Error fetching pipeline:', fetchError);
    }

    if (existingPipeline) {
      pipelineId = existingPipeline.id;
    } else {
      // Create pipeline record if it doesn't exist
      const { data: newPipeline, error: insertError } = await supabaseAdmin
        .from('unit_sales_pipeline')
        .insert({
          tenant_id: tenantId,
          development_id: developmentId,
          unit_id: unitId,
        })
        .select('id')
        .single();

      if (insertError || !newPipeline) {
        console.error('[Pipeline Notes POST API] Error creating pipeline:', insertError);
        return NextResponse.json({ error: 'Failed to create pipeline record' }, { status: 500 });
      }
      pipelineId = newPipeline.id;
    }

    // Create the note using Supabase
    const now = new Date().toISOString();
    const { data: newNote, error: noteError } = await supabaseAdmin
      .from('unit_pipeline_notes')
      .insert({
        tenant_id: tenantId,
        pipeline_id: pipelineId,
        unit_id: unitId,
        content: content.trim(),
        note_type: 'general',
        is_resolved: false,
        created_by: adminId,
        created_by_email: email,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (noteError || !newNote) {
      console.error('[Pipeline Notes POST API] Error creating note:', noteError);
      return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
    }

    // Audit log using Supabase (skip if it fails - non-critical)
    try {
      await supabaseAdmin.from('audit_log').insert({
        tenant_id: tenantId,
        type: 'pipeline',
        action: 'note_added',
        actor: email,
        actor_id: adminId,
        metadata: {
          note_id: newNote.id,
          pipeline_id: pipelineId,
          unit_id: unitId,
          development_id: developmentId,
        },
      });
    } catch (auditError) {
      console.error('[Pipeline Notes POST API] Audit log failed (non-critical):', auditError);
    }

    return NextResponse.json({
      note: {
        id: newNote.id,
        content: newNote.content,
        resolved: newNote.is_resolved || false,
        createdAt: newNote.created_at,
        createdBy: email || '',
      },
    });
  } catch (error) {
    console.error('[Pipeline Notes POST API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
