import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getResendClient } from '@/lib/resend';
import { resolveRecipient } from '@/lib/agent-intelligence/drafts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/intelligence/send-draft
 * Body: { draftId, wasEdited?: boolean }
 *
 * Routes the draft to the right channel:
 *   - email: Resend (reuses existing lib/resend.ts)
 *   - whatsapp / sms: returns a deep-link payload for the client to open,
 *     marks the draft as sent_external. Session 3 replaces these with
 *     proper provider integrations.
 *
 * Always writes an agent_send_history row so the track record is complete
 * regardless of channel, and records a recent_actions reversal payload so
 * the 60-second undo pill can flip the draft back to pending_review.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { draftId, wasEdited = false } = body || {};
    if (!draftId) {
      return NextResponse.json({ error: 'draftId required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const { data: draft, error: fetchErr } = await supabase
      .from('pending_drafts')
      .select('*')
      .eq('id', draftId)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (user && draft.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (draft.status !== 'pending_review') {
      return NextResponse.json(
        { error: `Draft is already in status "${draft.status}"` },
        { status: 409 }
      );
    }

    const recipient = await resolveRecipient(supabase, draft.draft_type, draft.recipient_id);
    const sendMethod = draft.send_method || 'email';
    const batchId = randomUUID();
    const sentAt = new Date().toISOString();
    const subject = (draft.content_json?.subject as string) || `Update on ${recipient.address || 'your property'}`;
    const messageBody =
      (draft.content_json?.body as string) ||
      (draft.content_json?.update_summary as string) ||
      '';

    let providerMessageId: string | null = null;
    let provider: string | null = null;
    let externalPayload: { href?: string; hint?: string } | null = null;
    let nextStatus: 'sent' | 'sent_external' = 'sent';

    if (sendMethod === 'email') {
      if (!recipient.email) {
        return NextResponse.json(
          {
            error:
              "No email on file for this recipient. Add one in the review screen or use WhatsApp instead.",
          },
          { status: 400 }
        );
      }

      try {
        const { client, fromEmail } = await getResendClient();
        const result = await client.emails.send({
          from: fromEmail,
          to: recipient.email,
          subject,
          text: messageBody,
        });
        provider = 'resend';
        providerMessageId = (result as any)?.data?.id ?? (result as any)?.id ?? null;
      } catch (err: any) {
        return NextResponse.json(
          {
            error: 'Email provider rejected the send',
            details: err?.message || 'unknown',
          },
          { status: 502 }
        );
      }
    } else if (sendMethod === 'whatsapp') {
      nextStatus = 'sent_external';
      provider = 'whatsapp_handoff';
      const phoneDigits = (recipient.phone || '').replace(/\D/g, '');
      externalPayload = phoneDigits
        ? {
            href: `https://wa.me/${phoneDigits}?text=${encodeURIComponent(messageBody)}`,
            hint: 'Opens WhatsApp with the message ready to send.',
          }
        : {
            hint: 'No phone number on file. Add one to finish on WhatsApp.',
          };
    } else if (sendMethod === 'sms') {
      nextStatus = 'sent_external';
      provider = 'sms_handoff';
      const phone = recipient.phone || '';
      externalPayload = phone
        ? {
            href: `sms:${phone}?body=${encodeURIComponent(messageBody)}`,
            hint: 'Opens your messages app with the text ready to send.',
          }
        : {
            hint: 'No phone number on file. Add one to finish in messages.',
          };
    } else {
      return NextResponse.json(
        { error: `Unsupported send method: ${sendMethod}` },
        { status: 400 }
      );
    }

    const { error: updErr } = await supabase
      .from('pending_drafts')
      .update({ status: nextStatus, sent_at: sentAt, updated_at: sentAt })
      .eq('id', draftId);

    if (updErr) {
      return NextResponse.json(
        { error: 'Draft sent but status update failed', details: updErr.message },
        { status: 500 }
      );
    }

    const { data: history } = await supabase
      .from('agent_send_history')
      .insert({
        user_id: draft.user_id,
        tenant_id: draft.tenant_id,
        draft_id: draft.id,
        draft_type: draft.draft_type,
        recipient_id: draft.recipient_id,
        sent_at: sentAt,
        was_edited_before_send: !!wasEdited,
        send_method: sendMethod,
        provider,
        provider_message_id: providerMessageId,
      })
      .select('id')
      .single();

    await supabase.from('recent_actions').insert({
      user_id: draft.user_id,
      tenant_id: draft.tenant_id,
      approval_batch_id: batchId,
      action_type: `send_${sendMethod}`,
      target_table: 'pending_drafts',
      target_id: draft.id,
      reversal_payload: {
        op: 'restore_draft',
        draftId: draft.id,
        priorStatus: 'pending_review',
        providerMessageId,
        provider,
        historyId: history?.id || null,
      },
      status: 'active',
    });

    // Resend supports cancellation within the scheduled window. We don't use
    // scheduled sends in this session so we can't truly cancel once sent;
    // the undo route surfaces that honestly to the user.
    const undoable = sendMethod !== 'email' || Boolean(providerMessageId);

    return NextResponse.json({
      batchId,
      status: nextStatus,
      provider,
      providerMessageId,
      externalPayload,
      undoable,
      sentAt,
    });
  } catch (error: any) {
    console.error('[agent/intelligence/send-draft] Error:', error.message);
    return NextResponse.json(
      { error: 'Send failed', details: error.message },
      { status: 500 }
    );
  }
}
