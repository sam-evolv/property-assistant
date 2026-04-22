import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/intelligence/undo-actions
 * Body: { batchId: string }
 * Rolls back every active entry in recent_actions for the batch.
 */
export async function POST(request: NextRequest) {
  try {
    const { batchId } = await request.json();
    if (!batchId) {
      return NextResponse.json({ error: 'batchId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const query = supabase
      .from('recent_actions')
      .select('id, target_table, target_id, reversal_payload, status')
      .eq('approval_batch_id', batchId)
      .eq('status', 'active');

    if (user) {
      query.eq('user_id', user.id);
    }

    const { data: entries, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reversed: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const entry of entries || []) {
      const payload = entry.reversal_payload as any;
      if (payload?.op === 'delete' && payload?.table && payload?.id) {
        const { error: delErr } = await supabase
          .from(payload.table)
          .delete()
          .eq('id', payload.id);
        if (delErr) {
          failed.push({ id: entry.id, error: delErr.message });
          continue;
        }
      }

      const { error: updErr } = await supabase
        .from('recent_actions')
        .update({ status: 'undone', undone_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (updErr) {
        failed.push({ id: entry.id, error: updErr.message });
        continue;
      }

      reversed.push(entry.id);
    }

    return NextResponse.json({ reversed, failed });
  } catch (error: any) {
    console.error('[agent/intelligence/undo-actions] Error:', error.message);
    return NextResponse.json(
      { error: 'Undo failed', details: error.message },
      { status: 500 }
    );
  }
}
