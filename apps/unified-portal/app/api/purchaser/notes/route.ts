import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { homeNotes } from '@openhouse/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { validatePurchaserToken } from '@openhouse/api/qr-tokens';
import { getUnitInfo } from '@openhouse/api';
import { categorizeNote } from '@/lib/notes/categorize';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_NOTE_LENGTH = 2000;
const NOTES_PER_UNIT_LIMIT = 200;

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',')[0]?.trim() || '127.0.0.1';
}

// ─── GET: List notes for a unit ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
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

    const unit = await getUnitInfo(unitUid);
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    const notes = await db
      .select({
        id: homeNotes.id,
        content: homeNotes.content,
        category: homeNotes.category,
        pinned: homeNotes.pinned,
        created_at: homeNotes.created_at,
        updated_at: homeNotes.updated_at,
      })
      .from(homeNotes)
      .where(eq(homeNotes.unit_id, unitUid))
      .orderBy(desc(homeNotes.pinned), desc(homeNotes.created_at));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('[Notes GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new note ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rateCheck = checkRateLimit(clientIP, '/api/purchaser/notes');
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfterMs: rateCheck.resetMs },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { token, unitUid, content, pinned } = body;

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      );
    }

    if (content.length > MAX_NOTE_LENGTH) {
      return NextResponse.json(
        { error: `Note content must be under ${MAX_NOTE_LENGTH} characters` },
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

    const unit = await getUnitInfo(unitUid);
    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }

    // Check note count limit
    const existing = await db
      .select({ id: homeNotes.id })
      .from(homeNotes)
      .where(eq(homeNotes.unit_id, unitUid));

    if (existing.length >= NOTES_PER_UNIT_LIMIT) {
      return NextResponse.json(
        { error: `Maximum of ${NOTES_PER_UNIT_LIMIT} notes reached. Delete some notes to add new ones.` },
        { status: 409 }
      );
    }

    // Auto-categorize the note
    const category = await categorizeNote(content.trim());

    const [note] = await db
      .insert(homeNotes)
      .values({
        unit_id: unitUid,
        content: content.trim(),
        category,
        pinned: pinned === true,
      })
      .returning({
        id: homeNotes.id,
        content: homeNotes.content,
        category: homeNotes.category,
        pinned: homeNotes.pinned,
        created_at: homeNotes.created_at,
        updated_at: homeNotes.updated_at,
      });

    console.log('[Notes POST] Created note:', note.id, 'category:', category, 'for unit:', unitUid);

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('[Notes POST] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}

// ─── PATCH: Toggle pin status ───────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, unitUid, noteId, pinned } = body;

    if (!token || !unitUid || !noteId) {
      return NextResponse.json(
        { error: 'Token, unit UID, and note ID are required' },
        { status: 400 }
      );
    }

    if (typeof pinned !== 'boolean') {
      return NextResponse.json(
        { error: 'Pinned must be a boolean' },
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

    const [updated] = await db
      .update(homeNotes)
      .set({ pinned })
      .where(and(eq(homeNotes.id, noteId), eq(homeNotes.unit_id, unitUid)))
      .returning({
        id: homeNotes.id,
        content: homeNotes.content,
        category: homeNotes.category,
        pinned: homeNotes.pinned,
        created_at: homeNotes.created_at,
        updated_at: homeNotes.updated_at,
      });

    if (!updated) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ note: updated });
  } catch (error) {
    console.error('[Notes PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}
