import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  decideAutoSend,
  ELIGIBILITY_RULES,
  loadAutonomyPreferences,
  REQUIRED_FIELDS_BY_DRAFT_TYPE,
  type SendHistoryRow,
} from '@/lib/agent-intelligence/autonomy';
import { resolveRecipient } from '@/lib/agent-intelligence/drafts';
import type {
  ExtractedAction,
  ExecutedAction,
} from '@/lib/agent-intelligence/voice-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

/**
 * POST /api/agent/intelligence/execute-actions
 * Body: { actions: ExtractedAction[], transcript?: string }
 * Returns: { batchId, results: ExecutedAction[] }
 *
 * Executes every approved action in parallel and records a reversal payload
 * in recent_actions so the 60-second undo pill can roll the batch back.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const actions: ExtractedAction[] = body?.actions || [];

    if (!Array.isArray(actions) || actions.length === 0) {
      return NextResponse.json({ error: 'actions array required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    // Resolve agent profile (mirrors the chat route's fallback for preview mode).
    let agentProfile: any = null;
    if (user) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('id, user_id, tenant_id, timezone')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      agentProfile = data;
    }
    if (!agentProfile) {
      const { data } = await supabase
        .from('agent_profiles')
        .select('id, user_id, tenant_id, timezone')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      agentProfile = data;
    }

    if (!agentProfile) {
      return NextResponse.json({ error: 'No agent profile found' }, { status: 401 });
    }

    const batchId = randomUUID();
    const userId = user?.id || agentProfile.user_id;
    const timezone = agentProfile.timezone || 'Europe/Dublin';

    // Load autonomy prefs + the last 10 auto-sends per draft_type so the
    // decideAutoSend helper can apply every gate in one go. This is a single
    // batch of queries per approval, not per-action.
    const [autonomy, { data: recentAutoSendRows }] = await Promise.all([
      loadAutonomyPreferences(supabase, userId),
      supabase
        .from('agent_send_history')
        .select('id, user_id, draft_type, was_edited_before_send, undone, sent_at, send_mode')
        .eq('user_id', userId)
        .eq('send_mode', 'auto_sent')
        .order('sent_at', { ascending: false })
        .limit(ELIGIBILITY_RULES.trustFloorWindow * 4),
    ]);

    const recentByType = new Map<string, SendHistoryRow[]>();
    for (const r of (recentAutoSendRows || []) as SendHistoryRow[]) {
      if (!recentByType.has(r.draft_type)) recentByType.set(r.draft_type, []);
      recentByType.get(r.draft_type)!.push(r);
    }

    const results = await Promise.all(
      actions.map((action) =>
        executeAction(supabase, {
          action,
          batchId,
          userId,
          tenantId: agentProfile.tenant_id,
          agentId: agentProfile.id,
          timezone,
          autonomy,
          recentByType,
        }),
      ),
    );

    return NextResponse.json({ batchId, results, globalPaused: autonomy.globalPaused });
  } catch (error: any) {
    console.error('[agent/intelligence/execute-actions] Error:', error.message);
    return NextResponse.json(
      { error: 'Execution failed', details: error.message },
      { status: 500 }
    );
  }
}

interface ExecCtx {
  action: ExtractedAction;
  batchId: string;
  userId: string;
  tenantId: string;
  agentId: string;
  timezone: string;
  autonomy: Awaited<ReturnType<typeof loadAutonomyPreferences>>;
  recentByType: Map<string, SendHistoryRow[]>;
}

async function executeAction(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action } = ctx;

  try {
    switch (action.type) {
      case 'log_viewing':
        return await execLogViewing(supabase, ctx);
      case 'draft_vendor_update':
        return await execDraftVendorUpdate(supabase, ctx);
      case 'create_reminder':
        return await execCreateReminder(supabase, ctx);
      default:
        return {
          id: action.id,
          type: action.type,
          success: false,
          message: `Unsupported action type: ${action.type}`,
        };
    }
  } catch (error: any) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Action failed',
      error: error.message,
    };
  }
}

async function execLogViewing(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, agentId, tenantId } = ctx;
  const f = action.fields;

  const attendees = Array.isArray(f.attendees) ? f.attendees : [];
  const primary = attendees[0] || {};
  const buyerName =
    primary.name ||
    (attendees.length > 1 ? attendees.map((a: any) => a.name).join(' & ') : '');

  const viewingDate = extractDatePart(f.viewing_date) || todayInDublin();
  const viewingTime = extractTimePart(f.viewing_date) || nowTimeInDublin();

  const notes = [
    f.feedback ? `Feedback: ${f.feedback}` : null,
    f.objections ? `Objections: ${f.objections}` : null,
    f.next_action ? `Next: ${f.next_action}` : null,
    attendees.length > 1 ? `Attendees: ${attendees.map((a: any) => a.name).join(', ')}` : null,
    f.interest_level ? `Interest: ${f.interest_level}` : null,
  ].filter(Boolean).join('\n');

  const { data: viewing, error } = await supabase
    .from('agent_viewings')
    .insert({
      agent_id: agentId,
      buyer_name: buyerName || 'Unknown',
      unit_ref: String(f.property_id ?? ''),
      scheme_name: '',
      viewing_date: viewingDate,
      viewing_time: viewingTime,
      status: 'confirmed',
    })
    .select('id')
    .single();

  if (error) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Could not log viewing',
      error: error.message,
    };
  }

  await recordReversal(supabase, ctx, {
    targetTable: 'agent_viewings',
    targetId: viewing.id,
    reversal: { op: 'delete', table: 'agent_viewings', id: viewing.id },
  });

  // Best-effort task for next_action so "follow up Monday" doesn't vanish.
  if (f.next_action && agentId) {
    try {
      const { data: task } = await supabase
        .from('agent_tasks')
        .insert({
          agent_id: agentId,
          tenant_id: tenantId,
          title: f.next_action,
          description: `From viewing of ${f.property_id} with ${buyerName}. Notes: ${notes}`,
          source: 'intelligence',
          priority: f.interest_level === 'high' ? 'high' : 'medium',
        })
        .select('id')
        .single();
      if (task) {
        await recordReversal(supabase, ctx, {
          targetTable: 'agent_tasks',
          targetId: task.id,
          reversal: { op: 'delete', table: 'agent_tasks', id: task.id },
        });
      }
    } catch {
      // Non-fatal — the viewing is what matters.
    }
  }

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: viewing.id,
    message: `Logged viewing for ${f.property_id || 'property'}`,
  };
}

async function execDraftVendorUpdate(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, userId, tenantId, timezone, autonomy, recentByType } = ctx;
  const f = action.fields;
  const draftType = 'vendor_update';

  // Decide auto-send vs review BEFORE inserting, so we can set the right
  // initial status on the draft row.
  const pref = autonomy.byDraftType[draftType] || { autoSendEnabled: false };
  const decision = decideAutoSend({
    draftType,
    autoSendEnabled: pref.autoSendEnabled,
    globalPaused: autonomy.globalPaused,
    confidence: action.confidence,
    requiredFields: REQUIRED_FIELDS_BY_DRAFT_TYPE[draftType] || [],
    timezone,
    recentAutoSends: recentByType.get(draftType) || [],
  });

  const initialStatus = decision.autoSend ? 'auto_sending' : 'pending_review';

  const { data: draft, error } = await supabase
    .from('pending_drafts')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      skin: 'agent',
      draft_type: draftType,
      recipient_id: f.vendor_id ? String(f.vendor_id) : null,
      content_json: {
        vendor_id: f.vendor_id,
        update_summary: f.update_summary,
        tone: f.tone || 'casual',
      },
      send_method: f.send_method || 'email',
      status: initialStatus,
    })
    .select('id')
    .single();

  if (error) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Could not save draft',
      error: error.message,
    };
  }

  await recordReversal(supabase, ctx, {
    targetTable: 'pending_drafts',
    targetId: draft.id,
    reversal: { op: 'delete', table: 'pending_drafts', id: draft.id },
  });

  if (decision.autoSend) {
    const recipient = await resolveRecipient(supabase, draftType, f.vendor_id ? String(f.vendor_id) : null);
    return {
      id: action.id,
      type: action.type,
      success: true,
      targetId: draft.id,
      message: `Auto-sending vendor update to ${recipient.name || 'vendor'}`,
      autoSendPlan: {
        draftId: draft.id,
        draftType,
        countdownSeconds: ELIGIBILITY_RULES.autoSendCountdownSeconds,
        recipientName: recipient.name || 'vendor',
      },
    };
  }

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: draft.id,
    message: `Drafted vendor update for ${f.vendor_id || 'vendor'}`,
    autoSendHold: decision.holdCopy || null,
  };
}

async function execCreateReminder(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, agentId, tenantId } = ctx;
  const f = action.fields;

  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert({
      agent_id: agentId,
      tenant_id: tenantId,
      title: f.reminder_text,
      description:
        f.related_entity_type && f.related_entity_id
          ? `Related ${f.related_entity_type}: ${f.related_entity_id}`
          : null,
      due_date: f.due_date || null,
      priority: 'medium',
      source: 'intelligence',
    })
    .select('id')
    .single();

  if (error) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Could not create reminder',
      error: error.message,
    };
  }

  await recordReversal(supabase, ctx, {
    targetTable: 'agent_tasks',
    targetId: task.id,
    reversal: { op: 'delete', table: 'agent_tasks', id: task.id },
  });

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: task.id,
    message: `Reminder set: ${f.reminder_text}`,
  };
}

async function recordReversal(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
  entry: { targetTable: string; targetId: string; reversal: any },
): Promise<void> {
  await supabase.from('recent_actions').insert({
    user_id: ctx.userId,
    tenant_id: ctx.tenantId,
    approval_batch_id: ctx.batchId,
    action_type: ctx.action.type,
    target_table: entry.targetTable,
    target_id: entry.targetId,
    reversal_payload: entry.reversal,
    status: 'active',
  });
}

function extractDatePart(iso?: string): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : null;
}

function extractTimePart(iso?: string): string | null {
  if (!iso) return null;
  const m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : null;
}

function todayInDublin(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeInDublin(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
