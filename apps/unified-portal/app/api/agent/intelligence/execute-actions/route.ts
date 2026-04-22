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
 * Body:
 *   {
 *     actions: ExtractedAction[],
 *     transcript?: string,
 *     // Optional: when retrying a subset of failed actions from a prior
 *     // batch, the client passes back the shared context so later actions
 *     // can still reference earlier-created ids.
 *     sharedContext?: SharedContextShape,
 *     batchId?: string,
 *   }
 * Returns: { batchId, results: ExecutedAction[], sharedContext, globalPaused }
 *
 * Session 4B: executes sequentially, not in parallel, so action N can
 * reference ids produced by action N-1 (e.g. flag_applicant_preferred
 * matching names against log_rental_viewing's attendees, or
 * draft_application_invitation resolving an applicant created a moment ago).
 *
 * On partial failure we still return every result so the confirmation card
 * can show ✓/✗ per action. Successful rows keep their reversal payload in
 * recent_actions so the Session 1 undo pill still works even if a later
 * action failed.
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

    const batchId: string = typeof body?.batchId === 'string' ? body.batchId : randomUUID();
    const userId = user?.id || agentProfile.user_id;
    const timezone = agentProfile.timezone || 'Europe/Dublin';

    // Sequential execution needs a shared context so each action can reference
    // ids produced by earlier actions in the same batch. Client can also pass
    // a prior shared context back when retrying a failed subset.
    const sharedContext: SharedContext = {
      applicantsByName: toCaseMap(body?.sharedContext?.applicantsByName),
      rentalViewingIds: { ...(body?.sharedContext?.rentalViewingIds || {}) },
      lettingPropertiesByRef: toCaseMap(body?.sharedContext?.lettingPropertiesByRef),
    };

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

    // Sequential loop — each action can read from and write to sharedContext.
    const results: ExecutedAction[] = [];
    for (const action of actions) {
      const result = await executeAction(supabase, {
        action,
        batchId,
        userId,
        tenantId: agentProfile.tenant_id,
        agentId: agentProfile.id,
        timezone,
        autonomy,
        recentByType,
        sharedContext,
      });

      // Feed outputs back into sharedContext so later actions can resolve.
      if (result.success && result.meta) {
        if (result.meta.rentalViewingId) {
          sharedContext.rentalViewingIds[action.id] = result.meta.rentalViewingId;
          sharedContext.rentalViewingIds.__latest = result.meta.rentalViewingId;
        }
        if (result.meta.applicantsByName) {
          for (const [name, id] of Object.entries(result.meta.applicantsByName)) {
            sharedContext.applicantsByName[name.toLowerCase()] = id;
          }
        }
        if (result.meta.lettingPropertyId) {
          const raw = action.fields?.letting_property_id
            || action.fields?.property_id
            || action.fields?.letting_property_ref;
          if (typeof raw === 'string' && raw.trim()) {
            sharedContext.lettingPropertiesByRef[raw.toLowerCase().trim()] = result.meta.lettingPropertyId;
          }
        }
      }

      results.push(result);
    }

    return NextResponse.json({
      batchId,
      results,
      globalPaused: autonomy.globalPaused,
      sharedContext,
    });
  } catch (error: any) {
    console.error('[agent/intelligence/execute-actions] Error:', error.message);
    return NextResponse.json(
      { error: 'Execution failed', details: error.message },
      { status: 500 }
    );
  }
}

interface SharedContext {
  applicantsByName: Record<string, string>;
  rentalViewingIds: Record<string, string>;
  lettingPropertiesByRef: Record<string, string>;
}

function toCaseMap(source: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!source || typeof source !== 'object') return out;
  for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) out[String(k).toLowerCase()] = v;
  }
  return out;
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
  sharedContext: SharedContext;
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
      case 'log_rental_viewing':
        return await execLogRentalViewing(supabase, ctx);
      case 'create_applicant':
        return await execCreateApplicant(supabase, ctx);
      case 'flag_applicant_preferred':
        return await execFlagApplicantPreferred(supabase, ctx);
      case 'draft_application_invitation':
        return await execDraftApplicationInvitation(supabase, ctx);
      case 'draft_vendor_update':
        return await execDraftVendorUpdate(supabase, ctx);
      case 'draft_viewing_followup_buyer':
        return await execDraftViewingFollowup(supabase, ctx);
      case 'draft_offer_response':
        return await execDraftOfferResponse(supabase, ctx);
      case 'draft_price_reduction_notice':
        return await execDraftPriceReductionNotice(supabase, ctx);
      case 'draft_chain_update_to_buyer':
        return await execDraftChainUpdate(supabase, ctx);
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

/**
 * Shared draft-insertion path for Session 4A's new sales types. Encapsulates:
 *   - decideAutoSend() gating per Session 3
 *   - initial status (auto_sending vs pending_review)
 *   - row insert + reversal payload for the Session 1 undo pill
 *   - autoSendPlan return for the client countdown
 *
 * Caller provides draft_type + recipient hint + content_json shape.
 */
async function insertDraftAndMaybeAutoSend(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
  opts: {
    draftType: string;
    recipientId: string | null;
    sendMethod: string;
    contentJson: Record<string, any>;
    reviewMessage: string;
    autoSendMessage: (recipientName: string) => string;
    allowAutoSend?: boolean; // false for multi-recipient fanouts
  },
): Promise<ExecutedAction> {
  const { action, userId, tenantId, timezone, autonomy, recentByType } = ctx;

  const pref = autonomy.byDraftType[opts.draftType] || { autoSendEnabled: false };
  const decision = opts.allowAutoSend === false
    ? { autoSend: false, holdCopy: null }
    : decideAutoSend({
        draftType: opts.draftType,
        autoSendEnabled: pref.autoSendEnabled,
        globalPaused: autonomy.globalPaused,
        confidence: action.confidence,
        requiredFields: REQUIRED_FIELDS_BY_DRAFT_TYPE[opts.draftType] || [],
        timezone,
        recentAutoSends: recentByType.get(opts.draftType) || [],
      });

  const initialStatus = decision.autoSend ? 'auto_sending' : 'pending_review';

  const { data: draft, error } = await supabase
    .from('pending_drafts')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      skin: 'agent',
      draft_type: opts.draftType,
      recipient_id: opts.recipientId,
      content_json: opts.contentJson,
      send_method: opts.sendMethod,
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
    const recipient = await resolveRecipient(supabase, opts.draftType, opts.recipientId);
    return {
      id: action.id,
      type: action.type,
      success: true,
      targetId: draft.id,
      message: opts.autoSendMessage(recipient.name || 'recipient'),
      autoSendPlan: {
        draftId: draft.id,
        draftType: opts.draftType,
        countdownSeconds: ELIGIBILITY_RULES.autoSendCountdownSeconds,
        recipientName: recipient.name || 'recipient',
      },
    };
  }

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: draft.id,
    message: opts.reviewMessage,
    autoSendHold: ('holdCopy' in decision ? decision.holdCopy : null) || null,
  };
}

async function execDraftViewingFollowup(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action } = ctx;
  const f = action.fields;
  const recipientId = f.recipient_id ? String(f.recipient_id) : null;
  const recipient = await resolveRecipient(supabase, 'viewing_followup', recipientId);

  const provenance: Array<{ id: string; label: string; detail: string | null }> = [];
  if (f.viewing_id) {
    provenance.push({
      id: 'viewing',
      label: `From viewing ${String(f.viewing_id)}`,
      detail: null,
    });
  }
  if (f.include_similar_properties) {
    provenance.push({
      id: 'similar',
      label: 'Will include similar properties',
      detail: 'Buyer said the property was not quite right.',
    });
  }

  return insertDraftAndMaybeAutoSend(supabase, ctx, {
    draftType: 'viewing_followup',
    recipientId,
    sendMethod: 'email',
    contentJson: {
      recipient_id: recipientId,
      viewing_id: f.viewing_id ?? null,
      subject: f.subject || `Following up on ${recipient.address || 'your viewing'}`,
      body: f.body || '',
      tone: f.tone || 'warm',
      include_similar_properties: !!f.include_similar_properties,
      provenance,
    },
    reviewMessage: `Drafted viewing follow-up for ${recipient.name || recipientId || 'buyer'}`,
    autoSendMessage: (name) => `Auto-sending viewing follow-up to ${name}`,
  });
}

async function execDraftOfferResponse(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action } = ctx;
  const f = action.fields;
  const recipientId = f.recipient_id ? String(f.recipient_id) : null;
  const recipient = await resolveRecipient(supabase, 'offer_response', recipientId);
  const actionKind: string = f.action || 'acknowledge';

  const provenance: Array<{ id: string; label: string; detail: string | null }> = [];
  if (f.offer_id) {
    provenance.push({
      id: 'offer',
      label: `Offer ${String(f.offer_id)}`,
      detail: null,
    });
  }
  if (actionKind === 'counter' && typeof f.counter_amount === 'number') {
    provenance.push({
      id: 'counter',
      label: `Counter at €${Math.round(f.counter_amount).toLocaleString('en-IE')}`,
      detail: f.counter_conditions ? String(f.counter_conditions) : null,
    });
  } else {
    provenance.push({
      id: 'action',
      label: `Action: ${actionKind}`,
      detail: null,
    });
  }

  return insertDraftAndMaybeAutoSend(supabase, ctx, {
    draftType: 'offer_response',
    recipientId,
    sendMethod: 'email',
    contentJson: {
      recipient_id: recipientId,
      offer_id: f.offer_id ?? null,
      action: actionKind,
      counter_amount: typeof f.counter_amount === 'number' ? f.counter_amount : null,
      counter_conditions: f.counter_conditions || '',
      subject: f.subject || subjectForOfferResponse(actionKind, recipient.address),
      body: f.body || '',
      tone: f.tone || (actionKind === 'reject' ? 'firm' : 'warm'),
      provenance,
    },
    reviewMessage: `Drafted offer ${actionKind === 'acknowledge' ? 'acknowledgement' : actionKind} for ${recipient.name || recipientId || 'buyer'}`,
    autoSendMessage: (name) => `Auto-sending offer ${actionKind} to ${name}`,
  });
}

function subjectForOfferResponse(kind: string, address?: string | null): string {
  const prop = address ? ` on ${address}` : '';
  switch (kind) {
    case 'accept':
      return `Good news about your offer${prop}`;
    case 'counter':
      return `On your offer${prop}`;
    case 'reject':
      return `Update on your offer${prop}`;
    default:
      return `Thanks for your offer${prop}`;
  }
}

async function execDraftPriceReductionNotice(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, userId, tenantId } = ctx;
  const f = action.fields;
  const recipients: string[] = Array.isArray(f.recipient_ids)
    ? f.recipient_ids.map((r: any) => String(r)).filter(Boolean)
    : [];

  if (recipients.length === 0) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'No recipients specified',
      error: 'recipient_ids must contain at least one buyer',
    };
  }

  const propertyId = f.property_id ? String(f.property_id) : null;
  const propertyRef = await resolveRecipient(supabase, 'vendor_update', propertyId);
  const oldPrice = typeof f.old_price === 'number' ? f.old_price : null;
  const newPrice = typeof f.new_price === 'number' ? f.new_price : null;
  const template: string = typeof f.body_template === 'string' ? f.body_template : '';
  const subject = typeof f.subject === 'string' && f.subject.trim()
    ? f.subject
    : `Price update on ${propertyRef.address || propertyId || 'a property'}`;

  // Fan out: one pending_draft per recipient. Multi-recipient never auto-sends
  // on approval (too high-stakes); each row is auto-sendable individually
  // from the Drafts inbox via the standard gate.
  const targetIds: string[] = [];
  const failures: string[] = [];

  for (const recipientId of recipients) {
    const recipient = await resolveRecipient(supabase, 'price_reduction_notice', recipientId);
    const firstName = firstNameOf(recipient.name) || firstNameOf(recipientId) || 'there';
    const body = template ? template.replace(/\{first_name\}/g, firstName) : '';

    const provenance: Array<{ id: string; label: string; detail: string | null }> = [];
    if (propertyRef.address) {
      provenance.push({
        id: 'property',
        label: propertyRef.address,
        detail: propertyId ? `Listing ${propertyId}` : null,
      });
    }
    if (oldPrice != null && newPrice != null) {
      provenance.push({
        id: 'price',
        label: `€${Math.round(oldPrice).toLocaleString('en-IE')} -> €${Math.round(newPrice).toLocaleString('en-IE')}`,
        detail: `Reduction of €${Math.round(oldPrice - newPrice).toLocaleString('en-IE')}`,
      });
    }

    const { data: row, error } = await supabase
      .from('pending_drafts')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        skin: 'agent',
        draft_type: 'price_reduction_notice',
        recipient_id: recipientId,
        content_json: {
          recipient_id: recipientId,
          property_id: propertyId,
          old_price: oldPrice,
          new_price: newPrice,
          subject,
          body,
          body_template: template,
          provenance,
        },
        send_method: 'email',
        status: 'pending_review',
      })
      .select('id')
      .single();

    if (error || !row) {
      failures.push(recipientId);
      continue;
    }

    targetIds.push(row.id);
    await recordReversal(supabase, ctx, {
      targetTable: 'pending_drafts',
      targetId: row.id,
      reversal: { op: 'delete', table: 'pending_drafts', id: row.id },
    });
  }

  if (targetIds.length === 0) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Could not save any price reduction drafts',
      error: `Failed for: ${failures.join(', ')}`,
    };
  }

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: targetIds[0],
    targetIds,
    recipientCount: targetIds.length,
    message:
      targetIds.length === 1
        ? `Drafted price reduction notice for 1 buyer`
        : `Drafted price reduction notice for ${targetIds.length} buyers`,
    autoSendHold:
      failures.length > 0
        ? `${failures.length} recipient${failures.length === 1 ? '' : 's'} could not be drafted — check the list.`
        : null,
  };
}

function firstNameOf(full: string | null | undefined): string | null {
  if (!full) return null;
  const trimmed = String(full).trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

async function execDraftChainUpdate(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action } = ctx;
  const f = action.fields;
  const buyerId = f.buyer_id ? String(f.buyer_id) : null;
  const propertyId = f.property_id ? String(f.property_id) : null;
  const updateType: string = f.update_type || 'custom';
  const recipient = await resolveRecipient(supabase, 'chain_update_to_buyer', buyerId || propertyId);

  const provenance: Array<{ id: string; label: string; detail: string | null }> = [];
  provenance.push({
    id: 'update_type',
    label: chainUpdateLabel(updateType),
    detail: updateType === 'custom' && f.custom_detail ? String(f.custom_detail) : null,
  });
  if (propertyId && recipient.address) {
    provenance.push({ id: 'property', label: recipient.address, detail: null });
  }

  return insertDraftAndMaybeAutoSend(supabase, ctx, {
    draftType: 'chain_update_to_buyer',
    recipientId: buyerId,
    sendMethod: 'email',
    contentJson: {
      buyer_id: buyerId,
      property_id: propertyId,
      update_type: updateType,
      custom_detail: f.custom_detail || '',
      subject: f.subject || `Quick chain update${recipient.address ? ` on ${recipient.address}` : ''}`,
      body: f.body || '',
      tone: f.tone || 'reassuring',
      provenance,
    },
    reviewMessage: `Drafted chain update for ${recipient.name || buyerId || 'buyer'}`,
    autoSendMessage: (name) => `Auto-sending chain update to ${name}`,
  });
}

function chainUpdateLabel(type: string): string {
  switch (type) {
    case 'survey_completed': return 'Survey completed';
    case 'solicitor_instructed': return 'Solicitor instructed';
    case 'contracts_issued': return 'Contracts issued';
    case 'contracts_exchanged': return 'Contracts exchanged';
    case 'delay_expected': return 'Delay expected';
    default: return 'Chain update';
  }
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

// ────────────────────────────────────────────────────────────────
// Session 4B — Lettings handlers
// ────────────────────────────────────────────────────────────────

/**
 * Find a letting property for the current agent matching a free-form
 * reference. Tries address_line_1, address, city — returns the highest
 * confidence match. Results are cached on the shared context so the same
 * reference in a later action (e.g. draft_application_invitation) does not
 * re-query.
 */
async function resolveLettingProperty(
  supabase: SupabaseAdmin,
  agentId: string,
  reference: string,
  shared: SharedContext,
): Promise<{ id: string; address: string | null } | null> {
  const key = reference.toLowerCase().trim();
  const cached = shared.lettingPropertiesByRef[key];
  if (cached) {
    const { data } = await supabase
      .from('agent_letting_properties')
      .select('id, address, address_line_1')
      .eq('id', cached)
      .maybeSingle();
    if (data) return { id: data.id, address: data.address || data.address_line_1 || null };
  }

  if (/^[0-9a-f-]{36}$/i.test(reference)) {
    const { data } = await supabase
      .from('agent_letting_properties')
      .select('id, address, address_line_1')
      .eq('id', reference)
      .eq('agent_id', agentId)
      .maybeSingle();
    if (data) {
      shared.lettingPropertiesByRef[key] = data.id;
      return { id: data.id, address: data.address || data.address_line_1 || null };
    }
  }

  // Fuzzy match on address fields, restricted to the agent's properties.
  const { data: matches } = await supabase
    .from('agent_letting_properties')
    .select('id, address, address_line_1')
    .eq('agent_id', agentId)
    .or(`address.ilike.%${reference}%,address_line_1.ilike.%${reference}%`)
    .limit(2);

  if (matches && matches.length >= 1) {
    const row = matches[0];
    shared.lettingPropertiesByRef[key] = row.id;
    return { id: row.id, address: row.address || row.address_line_1 || null };
  }
  return null;
}

async function execLogRentalViewing(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, agentId, tenantId, sharedContext } = ctx;
  const f = action.fields;
  const rawPropertyRef = f.letting_property_id ? String(f.letting_property_id) : '';

  if (!rawPropertyRef) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Need a rental property reference',
      error: 'letting_property_id missing',
    };
  }

  const property = await resolveLettingProperty(supabase, agentId, rawPropertyRef, sharedContext);
  if (!property) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: `Could not match a rental property for "${rawPropertyRef}"`,
      error: 'letting_property_not_found',
    };
  }

  const viewingDateIso = typeof f.viewing_date === 'string' && f.viewing_date
    ? f.viewing_date
    : new Date().toISOString();

  const { data: viewing, error: viewingErr } = await supabase
    .from('agent_rental_viewings')
    .insert({
      agent_id: agentId,
      tenant_id: tenantId,
      letting_property_id: property.id,
      viewing_date: viewingDateIso,
      viewing_type: f.viewing_type || 'individual',
      interest_level: f.interest_level || null,
      feedback: f.feedback || null,
      next_action: f.next_action || null,
      status: 'completed',
    })
    .select('id')
    .single();

  if (viewingErr || !viewing) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Could not log the rental viewing',
      error: viewingErr?.message || 'unknown',
    };
  }

  await recordReversal(supabase, ctx, {
    targetTable: 'agent_rental_viewings',
    targetId: viewing.id,
    reversal: { op: 'delete', table: 'agent_rental_viewings', id: viewing.id },
  });

  // Create / link applicants for each attendee. Exact-name match against this
  // agent's existing applicants; otherwise create a bare record.
  const attendees: any[] = Array.isArray(f.attendees) ? f.attendees : [];
  const applicantsByName: Record<string, string> = {};

  for (const attendee of attendees) {
    const name: string = String(attendee?.name || '').trim();
    if (!name) continue;

    const { data: existing } = await supabase
      .from('agent_applicants')
      .select('id')
      .eq('agent_id', agentId)
      .ilike('full_name', name)
      .limit(1)
      .maybeSingle();

    let applicantId = existing?.id;
    if (!applicantId) {
      const { data: created, error: applicantErr } = await supabase
        .from('agent_applicants')
        .insert({
          agent_id: agentId,
          tenant_id: tenantId,
          full_name: name,
          email: extractEmail(attendee?.contact_if_known),
          phone: extractPhone(attendee?.contact_if_known),
          employment_status: attendee?.employment_status || 'unknown',
          employer: attendee?.employer || null,
          notes: attendee?.notes || null,
          source: 'walk_in',
        })
        .select('id')
        .single();

      if (applicantErr || !created) continue;
      applicantId = created.id;
      await recordReversal(supabase, ctx, {
        targetTable: 'agent_applicants',
        targetId: applicantId,
        reversal: { op: 'delete', table: 'agent_applicants', id: applicantId },
      });
    }

    applicantsByName[name.toLowerCase()] = applicantId;

    const { data: attendeeRow } = await supabase
      .from('agent_rental_viewing_attendees')
      .insert({
        rental_viewing_id: viewing.id,
        applicant_id: applicantId,
        name_if_unknown: name,
        contact_if_known: attendee?.contact_if_known || null,
        was_preferred: !!attendee?.was_preferred,
        notes: attendee?.notes || null,
      })
      .select('id')
      .single();
    if (attendeeRow?.id) {
      await recordReversal(supabase, ctx, {
        targetTable: 'agent_rental_viewing_attendees',
        targetId: attendeeRow.id,
        reversal: { op: 'delete', table: 'agent_rental_viewing_attendees', id: attendeeRow.id },
      });
    }
  }

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: viewing.id,
    message: `Logged rental viewing at ${property.address || rawPropertyRef} with ${attendees.length} attendee${attendees.length === 1 ? '' : 's'}`,
    meta: {
      rentalViewingId: viewing.id,
      applicantsByName,
      lettingPropertyId: property.id,
    },
  };
}

async function execCreateApplicant(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, agentId, tenantId } = ctx;
  const f = action.fields;
  const fullName = String(f.full_name || '').trim();
  if (!fullName) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Applicant needs a name',
      error: 'full_name missing',
    };
  }

  const { data: applicant, error } = await supabase
    .from('agent_applicants')
    .insert({
      agent_id: agentId,
      tenant_id: tenantId,
      full_name: fullName,
      email: f.email || null,
      phone: f.phone || null,
      employment_status: f.employment_status || 'unknown',
      employer: f.employer || null,
      annual_income: typeof f.annual_income === 'number' ? f.annual_income : null,
      household_size: typeof f.household_size === 'number' ? f.household_size : null,
      has_pets: typeof f.has_pets === 'boolean' ? f.has_pets : null,
      pet_details: f.pet_details || null,
      smoker: typeof f.smoker === 'boolean' ? f.smoker : null,
      budget_monthly: typeof f.budget_monthly === 'number' ? f.budget_monthly : null,
      source: f.source || 'unknown',
      notes: f.notes || null,
    })
    .select('id')
    .single();

  if (error || !applicant) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Could not create applicant',
      error: error?.message || 'unknown',
    };
  }

  await recordReversal(supabase, ctx, {
    targetTable: 'agent_applicants',
    targetId: applicant.id,
    reversal: { op: 'delete', table: 'agent_applicants', id: applicant.id },
  });

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: applicant.id,
    message: `Created applicant ${fullName}`,
    meta: { applicantsByName: { [fullName.toLowerCase()]: applicant.id } },
  };
}

async function resolveApplicantByName(
  supabase: SupabaseAdmin,
  agentId: string,
  shared: SharedContext,
  name: string,
): Promise<string | null> {
  if (!name) return null;
  const key = name.toLowerCase().trim();
  if (shared.applicantsByName[key]) return shared.applicantsByName[key];

  // Try partial match on the same-batch map first (e.g. "O'Sheas" vs "O'Shea").
  for (const [candidate, id] of Object.entries(shared.applicantsByName)) {
    if (candidate.includes(key) || key.includes(candidate)) return id;
  }

  // Fall back to the agent's most recent applicant with a fuzzy name match.
  const { data } = await supabase
    .from('agent_applicants')
    .select('id')
    .eq('agent_id', agentId)
    .ilike('full_name', `%${name}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function execFlagApplicantPreferred(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, agentId, sharedContext } = ctx;
  const f = action.fields;
  const applicantName = String(f.applicant_name || '').trim();
  if (!applicantName) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Need an applicant name to flag',
      error: 'applicant_name missing',
    };
  }

  const applicantId = await resolveApplicantByName(supabase, agentId, sharedContext, applicantName);
  if (!applicantId) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: `Could not find an applicant matching "${applicantName}"`,
      error: 'applicant_not_found',
    };
  }

  // Target viewing: same-batch preferred, then most recent viewing for this
  // applicant under the current agent.
  let rentalViewingId: string | null = sharedContext.rentalViewingIds.__latest || null;

  if (!rentalViewingId && typeof f.rental_viewing_ref === 'string') {
    // Try via the letting property reference on the ref — match most recent
    // viewing at that property.
    const property = await resolveLettingProperty(supabase, agentId, String(f.rental_viewing_ref), sharedContext);
    if (property) {
      const { data: recent } = await supabase
        .from('agent_rental_viewings')
        .select('id')
        .eq('letting_property_id', property.id)
        .eq('agent_id', agentId)
        .order('viewing_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      rentalViewingId = recent?.id || null;
    }
  }

  if (!rentalViewingId) {
    // Last resort: the most recent viewing this applicant attended.
    const { data: attendeeRow } = await supabase
      .from('agent_rental_viewing_attendees')
      .select('rental_viewing_id, id')
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    rentalViewingId = attendeeRow?.rental_viewing_id || null;
  }

  if (!rentalViewingId) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: `Found ${applicantName}, but could not match them to a recent viewing`,
      error: 'rental_viewing_not_found',
    };
  }

  const { data: attendee, error } = await supabase
    .from('agent_rental_viewing_attendees')
    .update({ was_preferred: true })
    .eq('rental_viewing_id', rentalViewingId)
    .eq('applicant_id', applicantId)
    .select('id')
    .maybeSingle();

  if (error || !attendee) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Could not flag preferred',
      error: error?.message || 'attendee_row_not_found',
    };
  }

  await recordReversal(supabase, ctx, {
    targetTable: 'agent_rental_viewing_attendees',
    targetId: attendee.id,
    reversal: { op: 'update', table: 'agent_rental_viewing_attendees', id: attendee.id, set: { was_preferred: false } },
  });

  return {
    id: action.id,
    type: action.type,
    success: true,
    targetId: attendee.id,
    message: `Flagged ${applicantName} as preferred`,
  };
}

async function execDraftApplicationInvitation(
  supabase: SupabaseAdmin,
  ctx: ExecCtx,
): Promise<ExecutedAction> {
  const { action, agentId, tenantId, sharedContext } = ctx;
  const f = action.fields;
  const applicantName = String(f.applicant_name || '').trim();
  const propertyRef = String(f.letting_property_id || '').trim();

  if (!applicantName || !propertyRef) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: 'Need both applicant and property',
      error: 'applicant_name_or_property_missing',
    };
  }

  const applicantId = await resolveApplicantByName(supabase, agentId, sharedContext, applicantName);
  if (!applicantId) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: `Could not find an applicant matching "${applicantName}"`,
      error: 'applicant_not_found',
    };
  }

  const property = await resolveLettingProperty(supabase, agentId, propertyRef, sharedContext);
  if (!property) {
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: `Could not match a rental property for "${propertyRef}"`,
      error: 'letting_property_not_found',
    };
  }

  // Load applicant for recipient display + body personalisation.
  const { data: applicant } = await supabase
    .from('agent_applicants')
    .select('id, full_name, email, phone')
    .eq('id', applicantId)
    .maybeSingle();

  // Create the application record first — if the insert hits the unique
  // partial index (active application already exists) we surface that
  // honestly and skip the draft.
  const { data: application, error: appErr } = await supabase
    .from('agent_rental_applications')
    .insert({
      agent_id: agentId,
      tenant_id: tenantId,
      applicant_id: applicantId,
      letting_property_id: property.id,
      status: 'invited',
      references_status: 'not_requested',
      aml_status: 'not_started',
    })
    .select('id')
    .single();

  if (appErr || !application) {
    const duplicate = appErr?.message?.includes('idx_unique_active_application');
    return {
      id: action.id,
      type: action.type,
      success: false,
      message: duplicate
        ? `${applicantName} already has an active application on that property`
        : 'Could not create the application',
      error: appErr?.message || 'unknown',
    };
  }

  await recordReversal(supabase, ctx, {
    targetTable: 'agent_rental_applications',
    targetId: application.id,
    reversal: { op: 'delete', table: 'agent_rental_applications', id: application.id },
  });

  const firstName = (applicant?.full_name || applicantName).split(/\s+/)[0] || 'there';
  const bodyTemplate: string = typeof f.body === 'string' && f.body.trim()
    ? f.body
    : `Hi ${firstName},\n\nLovely to meet you at the viewing of ${property.address || propertyRef}. When you have a moment, could you pop through the application details at this link? {application_link}\n\nAny questions, give me a shout.\n\nThanks,`;

  const body = bodyTemplate.replace(/\{first_name\}/g, firstName);

  const subject = typeof f.subject === 'string' && f.subject.trim()
    ? f.subject
    : `Application for ${property.address || propertyRef}`;

  const provenance = [
    { id: 'property', label: property.address || propertyRef, detail: null },
    { id: 'application', label: `Application ${application.id.slice(0, 8)}`, detail: `Status: invited` },
  ];

  const draftResult = await insertDraftAndMaybeAutoSend(supabase, ctx, {
    draftType: 'application_invitation',
    recipientId: applicantId,
    sendMethod: 'email',
    contentJson: {
      applicant_id: applicantId,
      application_id: application.id,
      letting_property_id: property.id,
      subject,
      body,
      tone: f.tone || 'warm',
      provenance,
    },
    reviewMessage: `Drafted application invitation for ${applicant?.full_name || applicantName}`,
    autoSendMessage: (name) => `Auto-sending application invitation to ${name}`,
  });

  if (!draftResult.success) {
    return draftResult;
  }

  return {
    ...draftResult,
    meta: {
      ...(draftResult.meta || {}),
      applicationId: application.id,
      draftId: draftResult.targetId,
    },
  };
}

function extractEmail(raw?: string | null): string | null {
  if (!raw) return null;
  const m = /[\w.+-]+@[\w.-]+\.\w+/.exec(raw);
  return m ? m[0] : null;
}

function extractPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, '');
  return cleaned.length >= 7 ? cleaned : null;
}

