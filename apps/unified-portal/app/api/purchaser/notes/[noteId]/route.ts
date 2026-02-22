import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { homeNotes } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';

export const dynamic = 'force-dynamic';

// ─── DELETE: Remove a note ──────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: { noteId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');
    const { noteId } = params;

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    if (!noteId) {
      return NextResponse.json(
        { error: 'Note ID is required' },
        { status: 400 }
      );
    }

    const tokenResult = await validatePurchaserToken(token, unitUid);
    if (!tokenResult.valid) {
      return NextResponse.json(
        { error: tokenResult.error || 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Delete note only if it belongs to this unit (scoped by unit_id)
    const [deleted] = await db
      .delete(homeNotes)
      .where(and(eq(homeNotes.id, noteId), eq(homeNotes.unit_id, unitUid)))
      .returning({ id: homeNotes.id });

    if (!deleted) {
      return NextResponse.json(
        { error: 'Note not found or already deleted' },
        { status: 404 }
      );
    }

    console.log('[Notes DELETE] Deleted note:', noteId, 'for unit:', unitUid);

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    console.error('[Notes DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}
