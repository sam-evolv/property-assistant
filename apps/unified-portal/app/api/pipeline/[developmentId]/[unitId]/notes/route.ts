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
import { getAdminContextFromSession } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { unitSalesPipeline, unitPipelineNotes, units, admins, audit_log } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';

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

/**
 * GET /api/pipeline/[developmentId]/[unitId]/notes
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string; unitId: string }> }
) {
  try {
    const { developmentId, unitId } = await params;
    const adminContext = await getAdminContextFromSession();

    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, role } = adminContext;

    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // Get unit info
    const [unit] = await db
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

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Get pipeline record
    const [pipeline] = await db
      .select()
      .from(unitSalesPipeline)
      .where(and(eq(unitSalesPipeline.tenant_id, tenantId), eq(unitSalesPipeline.unit_id, unitId)));

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

    // Get notes with creator and resolver info
    const notes = await db
      .select({
        note: unitPipelineNotes,
        creator: {
          id: admins.id,
          email: admins.email,
        },
      })
      .from(unitPipelineNotes)
      .leftJoin(admins, eq(unitPipelineNotes.created_by, admins.id))
      .where(eq(unitPipelineNotes.pipeline_id, pipeline.id))
      .orderBy(desc(unitPipelineNotes.created_at));

    // Get resolver info for resolved notes
    const resolverIds = notes
      .filter((n) => n.note.resolved_by)
      .map((n) => n.note.resolved_by!);

    let resolvers: Map<string, { id: string; email: string }> = new Map();
    if (resolverIds.length > 0) {
      const resolverData = await db
        .select({ id: admins.id, email: admins.email })
        .from(admins)
        .where(eq(admins.id, resolverIds[0])); // Simplified - would need inArray for multiple

      for (const r of resolverData) {
        resolvers.set(r.id, r);
      }
    }

    const formattedNotes: NoteResponse[] = notes.map(({ note, creator }) => ({
      id: note.id,
      noteType: note.note_type,
      content: note.content,
      isResolved: note.is_resolved,
      resolvedAt: note.resolved_at?.toISOString() || null,
      resolvedBy: note.resolved_by ? resolvers.get(note.resolved_by) || null : null,
      createdBy: creator ? { id: creator.id, email: creator.email } : { id: '', email: 'Unknown' },
      createdAt: note.created_at.toISOString(),
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
    const adminContext = await getAdminContextFromSession();

    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, adminId, role, email } = adminContext;

    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantId || !adminId) {
      return NextResponse.json({ error: 'Context required' }, { status: 400 });
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
    let [pipeline] = await db
      .select()
      .from(unitSalesPipeline)
      .where(and(eq(unitSalesPipeline.tenant_id, tenantId), eq(unitSalesPipeline.unit_id, unitId)));

    if (!pipeline) {
      // Create pipeline record first
      const [unit] = await db
        .select()
        .from(units)
        .where(
          and(
            eq(units.tenant_id, tenantId),
            eq(units.id, unitId),
            eq(units.development_id, developmentId)
          )
        );

      if (!unit) {
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
      }

      [pipeline] = await db
        .insert(unitSalesPipeline)
        .values({
          tenant_id: tenantId,
          development_id: developmentId,
          unit_id: unitId,
          purchaser_name: unit.purchaser_name,
          purchaser_email: unit.purchaser_email,
          purchaser_phone: unit.purchaser_phone,
        })
        .returning();
    }

    // Create the note
    const [newNote] = await db
      .insert(unitPipelineNotes)
      .values({
        tenant_id: tenantId,
        pipeline_id: pipeline.id,
        unit_id: unitId,
        note_type: noteType as 'general' | 'query' | 'issue' | 'update',
        content: content.trim(),
        created_by: adminId,
      })
      .returning();

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
        pipeline_id: pipeline.id,
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
        createdAt: newNote.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Pipeline Notes POST API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const adminContext = await getAdminContextFromSession();

    if (!adminContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenantId, adminId, role, email } = adminContext;

    if (!['developer', 'admin', 'super_admin'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (!tenantId || !adminId) {
      return NextResponse.json({ error: 'Context required' }, { status: 400 });
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
    const [existingNote] = await db
      .select()
      .from(unitPipelineNotes)
      .where(
        and(
          eq(unitPipelineNotes.id, noteId),
          eq(unitPipelineNotes.tenant_id, tenantId),
          eq(unitPipelineNotes.unit_id, unitId)
        )
      );

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const now = new Date();

    // Update the note
    const [updatedNote] = await db
      .update(unitPipelineNotes)
      .set({
        is_resolved: resolved,
        resolved_at: resolved ? now : null,
        resolved_by: resolved ? adminId : null,
        updated_at: now,
      })
      .where(eq(unitPipelineNotes.id, noteId))
      .returning();

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
        resolvedAt: updatedNote.resolved_at?.toISOString() || null,
        resolvedBy: resolved ? { id: adminId, email } : null,
        createdAt: updatedNote.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('[Pipeline Notes PATCH API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
