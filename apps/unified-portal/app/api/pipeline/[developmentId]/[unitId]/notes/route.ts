/**
 * Sales Pipeline API - Unit Notes
 *
 * GET /api/pipeline/[developmentId]/[unitId]/notes
 * Get all notes for a unit
 *
 * POST /api/pipeline/[developmentId]/[unitId]/notes
 * Add a note to a unit
 *
 * PATCH /api/pipeline/[developmentId]/[unitId]/notes
 * Resolve/unresolve a note
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { units, audit_log } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NoteResponse {
  id: string;
  noteType: string;
  content: string;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: { id: string; email: string } | null;
  createdBy: { id: string; email: string };
  createdAt: string;
}

// Check if pipeline tables exist
async function checkPipelineTablesExist(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1 FROM unit_sales_pipeline LIMIT 1`);
    await db.execute(sql`SELECT 1 FROM unit_pipeline_notes LIMIT 1`);
    return true;
  } catch (e) {
    return false;
  }
}

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

    // Get unit info - try Drizzle first, fallback to Supabase
    let unit: any = null;

    try {
      const [drizzleUnit] = await db
        .select({
          id: units.id,
          unitNumber: units.unit_number,
          address: units.address_line_1,
        })
        .from(units)
        .where(
          and(
            eq(units.tenant_id, tenantId),
            eq(units.id, unitId),
            eq(units.development_id, developmentId)
          )
        );
      unit = drizzleUnit;
    } catch (drizzleError) {
      console.error('[Pipeline Notes GET API] Drizzle error (falling back to Supabase):', drizzleError);
      const { data: supabaseUnit, error: supabaseError } = await supabaseAdmin
        .from('units')
        .select('id, unit_number, address_line_1')
        .eq('tenant_id', tenantId)
        .eq('id', unitId)
        .eq('development_id', developmentId)
        .single();

      if (supabaseError && supabaseError.code !== 'PGRST116') {
        console.error('[Pipeline Notes GET API] Supabase error:', supabaseError);
      }
      if (supabaseUnit) {
        unit = {
          id: supabaseUnit.id,
          unitNumber: supabaseUnit.unit_number,
          address: supabaseUnit.address_line_1,
        };
      }
    }

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist();
    if (!pipelineTablesExist) {
      return NextResponse.json({
        unit: {
          id: unit.id,
          unitNumber: unit.unitNumber,
          address: unit.address,
        },
        notes: [],
        stats: { total: 0, unresolved: 0 },
      });
    }

    // Get pipeline record using raw SQL
    const pipelineResult = await db.execute(sql`
      SELECT id FROM unit_sales_pipeline
      WHERE tenant_id = ${tenantId}::uuid
      AND unit_id = ${unitId}::uuid
      LIMIT 1
    `);
    const pipeline = pipelineResult.rows?.[0] as { id: string } | undefined;

    if (!pipeline) {
      return NextResponse.json({
        unit: {
          id: unit.id,
          unitNumber: unit.unitNumber,
          address: unit.address,
        },
        notes: [],
        stats: { total: 0, unresolved: 0 },
      });
    }

    // Get notes with creator and resolver info using raw SQL
    const notesResult = await db.execute(sql`
      SELECT
        n.id,
        n.note_type,
        n.content,
        n.is_resolved,
        n.resolved_at,
        n.resolved_by,
        n.created_by,
        n.created_at,
        creator.id as creator_id,
        creator.email as creator_email,
        resolver.id as resolver_id,
        resolver.email as resolver_email
      FROM unit_pipeline_notes n
      LEFT JOIN admins creator ON n.created_by = creator.id
      LEFT JOIN admins resolver ON n.resolved_by = resolver.id
      WHERE n.pipeline_id = ${pipeline.id}::uuid
      ORDER BY n.created_at DESC
    `);

    const formattedNotes: NoteResponse[] = (notesResult.rows || []).map((row: any) => ({
      id: row.id,
      noteType: row.note_type,
      content: row.content,
      isResolved: row.is_resolved,
      resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
      resolvedBy: row.resolver_id ? { id: row.resolver_id, email: row.resolver_email } : null,
      createdBy: row.creator_id ? { id: row.creator_id, email: row.creator_email } : { id: '', email: 'Unknown' },
      createdAt: new Date(row.created_at).toISOString(),
    }));

    const unresolved = formattedNotes.filter((n) => !n.isResolved).length;

    return NextResponse.json({
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        address: unit.address,
      },
      notes: formattedNotes,
      stats: {
        total: formattedNotes.length,
        unresolved,
      },
    });
  } catch (error) {
    console.error('[Pipeline Notes GET API] Error:', error);
    console.error('[Pipeline Notes GET API] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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
    const { tenantId, id: adminId, email, role } = session;

    if (!tenantId || !adminId) {
      return NextResponse.json({ error: 'Context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist();
    if (!pipelineTablesExist) {
      return NextResponse.json(
        { error: 'Pipeline tables not yet created. Please run the database migration first.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content, noteType = 'general' } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const validNoteTypes = ['general', 'query', 'issue', 'update'];
    if (!validNoteTypes.includes(noteType)) {
      return NextResponse.json({ error: `Invalid noteType. Must be one of: ${validNoteTypes.join(', ')}` }, { status: 400 });
    }

    // Get or create pipeline record
    const pipelineResult = await db.execute(sql`
      SELECT id FROM unit_sales_pipeline
      WHERE tenant_id = ${tenantId}::uuid
      AND unit_id = ${unitId}::uuid
      LIMIT 1
    `);
    let pipelineId = (pipelineResult.rows?.[0] as any)?.id;

    if (!pipelineId) {
      // Get unit to verify it exists - try Drizzle first, fallback to Supabase
      let unit: any = null;

      try {
        const [drizzleUnit] = await db
          .select()
          .from(units)
          .where(
            and(
              eq(units.tenant_id, tenantId),
              eq(units.id, unitId),
              eq(units.development_id, developmentId)
            )
          );
        unit = drizzleUnit;
      } catch (drizzleError) {
        console.error('[Pipeline Notes POST API] Drizzle error (falling back to Supabase):', drizzleError);
        const { data: supabaseUnit, error: supabaseError } = await supabaseAdmin
          .from('units')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', unitId)
          .eq('development_id', developmentId)
          .single();

        if (supabaseError && supabaseError.code !== 'PGRST116') {
          console.error('[Pipeline Notes POST API] Supabase error:', supabaseError);
        }
        unit = supabaseUnit;
      }

      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }

      // Create pipeline record
      const insertResult = await db.execute(sql`
        INSERT INTO unit_sales_pipeline
          (id, tenant_id, development_id, unit_id, purchaser_name, purchaser_email, purchaser_phone, created_at, updated_at)
        VALUES
          (gen_random_uuid(), ${tenantId}::uuid, ${developmentId}::uuid, ${unitId}::uuid, ${unit.purchaser_name}, ${unit.purchaser_email}, ${unit.purchaser_phone}, NOW(), NOW())
        RETURNING id
      `);
      pipelineId = (insertResult.rows?.[0] as any)?.id;
    }

    // Create the note
    const noteResult = await db.execute(sql`
      INSERT INTO unit_pipeline_notes
        (id, tenant_id, pipeline_id, unit_id, note_type, content, created_by, created_at, updated_at)
      VALUES
        (gen_random_uuid(), ${tenantId}::uuid, ${pipelineId}::uuid, ${unitId}::uuid, ${noteType}, ${content.trim()}, ${adminId}::uuid, NOW(), NOW())
      RETURNING id, note_type, content, is_resolved, created_at
    `);
    const newNote = noteResult.rows?.[0] as any;

    // Audit log
    await db.insert(audit_log).values({
      tenant_id: tenantId,
      type: 'pipeline',
      action: 'note_added',
      actor: email,
      actor_id: adminId,
      actor_role: role,
      metadata: {
        note_id: newNote.id,
        pipeline_id: pipelineId,
        unit_id: unitId,
        development_id: developmentId,
        note_type: noteType,
      },
    });

    return NextResponse.json({
      note: {
        id: newNote.id,
        noteType: newNote.note_type,
        content: newNote.content,
        isResolved: newNote.is_resolved,
        resolvedAt: null,
        resolvedBy: null,
        createdBy: { id: adminId, email },
        createdAt: new Date(newNote.created_at).toISOString(),
      },
    });
  } catch (error) {
    console.error('[Pipeline Notes POST API] Error:', error);
    console.error('[Pipeline Notes POST API] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * PATCH /api/pipeline/[developmentId]/[unitId]/notes
 * Resolve or unresolve a note
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string }> }
) {
  try {
    const { developmentId, unitId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { tenantId, id: adminId, email, role } = session;

    if (!tenantId || !adminId) {
      return NextResponse.json({ error: 'Context required' }, { status: 400 });
    }

    // Check if pipeline tables exist
    const pipelineTablesExist = await checkPipelineTablesExist();
    if (!pipelineTablesExist) {
      return NextResponse.json(
        { error: 'Pipeline tables not yet created. Please run the database migration first.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { noteId, resolved } = body;

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    if (typeof resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved must be a boolean' }, { status: 400 });
    }

    // Get the note and verify ownership
    const existingNoteResult = await db.execute(sql`
      SELECT id, note_type, content, is_resolved, created_at
      FROM unit_pipeline_notes
      WHERE id = ${noteId}::uuid
      AND tenant_id = ${tenantId}::uuid
      AND unit_id = ${unitId}::uuid
      LIMIT 1
    `);
    const existingNote = existingNoteResult.rows?.[0] as any;

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Update the note
    const updatedResult = await db.execute(sql`
      UPDATE unit_pipeline_notes
      SET is_resolved = ${resolved},
          resolved_at = ${resolved ? sql`NOW()` : sql`NULL`},
          resolved_by = ${resolved ? sql`${adminId}::uuid` : sql`NULL`},
          updated_at = NOW()
      WHERE id = ${noteId}::uuid
      RETURNING id, note_type, content, is_resolved, resolved_at, created_at
    `);
    const updatedNote = updatedResult.rows?.[0] as any;

    // Audit log
    await db.insert(audit_log).values({
      tenant_id: tenantId,
      type: 'pipeline',
      action: resolved ? 'note_resolved' : 'note_reopened',
      actor: email,
      actor_id: adminId,
      actor_role: role,
      metadata: {
        note_id: noteId,
        unit_id: unitId,
        development_id: developmentId,
      },
    });

    return NextResponse.json({
      note: {
        id: updatedNote.id,
        noteType: updatedNote.note_type,
        content: updatedNote.content,
        isResolved: updatedNote.is_resolved,
        resolvedAt: updatedNote.resolved_at ? new Date(updatedNote.resolved_at).toISOString() : null,
        resolvedBy: resolved ? { id: adminId, email } : null,
        createdAt: new Date(updatedNote.created_at).toISOString(),
      },
    });
  } catch (error) {
    console.error('[Pipeline Notes PATCH API] Error:', error);
    console.error('[Pipeline Notes PATCH API] Stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
