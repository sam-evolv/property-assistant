import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  ACTION_TOOLS,
  type ExtractedAction,
  type ConfidenceMap,
} from '@/lib/agent-intelligence/voice-actions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

/**
 * POST /api/agent/intelligence/extract-actions
 * Body: { transcript: string, activeDevelopmentId?: string, intentHint?: string }
 * Returns: { actions: ExtractedAction[], rawToolCalls, transcript }
 *
 * Calls Claude Sonnet 4.6 with structured tool-use so we never parse free-form text.
 * Multi-action extraction is mandatory — a single transcript can yield several
 * distinct actions and the model is instructed to emit all of them in parallel.
 */
/**
 * Session 13.1 — staged error handling.
 *
 * Previous version used a single top-level try/catch that returned 500
 * on any throw. Every client-side error handler treated that 500 as
 * "Claude didn't understand" — hiding what was actually a server
 * crash. We now stage each step with its own try/catch and log with
 * `console.error('[extract-actions] <stage>:', err)` so Vercel
 * runtime logs pinpoint the exact failure. The route NEVER returns
 * 500. Any unrecoverable failure degrades to `{ actions: [],
 * transcript, degraded: true, stage }` with 200 status — the client
 * already has a fallthrough that re-runs the transcript as a typed
 * chat query when actions is empty, so the user still gets a
 * response.
 */
export async function POST(request: NextRequest) {
  // --- Stage: parse_body ---
  let body: any;
  try {
    body = await request.json();
  } catch (err: any) {
    console.error('[extract-actions] parse_body:', err?.message || err);
    return NextResponse.json(
      { actions: [], transcript: '', degraded: true, stage: 'parse_body' },
      { status: 200 },
    );
  }

  const transcript: string = (body?.transcript || '').trim();
  const intentHint: string | undefined = body?.intentHint;
  const activeDevelopmentId: string | undefined = body?.activeDevelopmentId;

  if (!transcript) {
    // Validation — genuine client bug, 400 is appropriate.
    return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[extract-actions] missing ANTHROPIC_API_KEY in env');
    return NextResponse.json(
      { actions: [], transcript, degraded: true, stage: 'anthropic_config' },
      { status: 200 },
    );
  }

  // --- Stage: supabase_init ---
  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch (err: any) {
    console.error('[extract-actions] supabase_init:', err?.message || err);
    return NextResponse.json(
      { actions: [], transcript, degraded: true, stage: 'supabase_init' },
      { status: 200 },
    );
  }

  // --- Stage: auth ---
  let userId: string | undefined;
  try {
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    userId = user?.id;
  } catch (err: any) {
    // Non-fatal — buildVoiceContext handles undefined userId.
    console.error('[extract-actions] auth:', err?.message || err);
  }

  // --- Stage: build_context ---
  // buildVoiceContext runs multiple Supabase queries. Any one of them
  // can throw on a cold connection, missing table, or schema drift.
  // On failure we carry on with an empty context — Claude still gets
  // the transcript and can extract actions without the recent-
  // listings list.
  let context: VoiceContext;
  try {
    context = await buildVoiceContext(supabase, userId, activeDevelopmentId);
  } catch (err: any) {
    console.error('[extract-actions] build_context:', err?.message || err);
    context = {
      activeDevelopmentId: activeDevelopmentId ?? null,
      schemeName: null,
      recentListings: [],
      lettingProperties: [],
    };
  }

  // --- Stage: anthropic_call ---
  let payload: any;
  try {
    const systemPrompt = buildExtractionSystemPrompt(context, intentHint);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        tools: ACTION_TOOLS,
        tool_choice: { type: 'any' },
        messages: [
          { role: 'user', content: `Transcript: "${transcript}"` },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(
        '[extract-actions] anthropic_call: non-2xx',
        response.status,
        text.slice(0, 400),
      );
      return NextResponse.json(
        {
          actions: [],
          transcript,
          degraded: true,
          stage: 'anthropic_call',
          detail: `status ${response.status}`,
        },
        { status: 200 },
      );
    }

    payload = await response.json();
  } catch (err: any) {
    console.error('[extract-actions] anthropic_call:', err?.message || err);
    return NextResponse.json(
      { actions: [], transcript, degraded: true, stage: 'anthropic_call' },
      { status: 200 },
    );
  }

  // --- Stage: parse_response ---
  try {
    const toolBlocks = (payload?.content || []).filter(
      (c: any) => c && c.type === 'tool_use',
    );
    const actions: ExtractedAction[] = toolBlocks.map((block: any) => {
      const confidenceMap: ConfidenceMap = (block.input?._confidence as ConfidenceMap) || {};
      const input = { ...block.input };
      delete input._confidence;
      return {
        id: block.id || `action_${Math.random().toString(36).slice(2, 10)}`,
        type: block.name,
        fields: input,
        confidence: confidenceMap,
      };
    });

    return NextResponse.json({
      actions,
      transcript,
      context: {
        developmentId: context.activeDevelopmentId,
        schemeName: context.schemeName,
      },
    });
  } catch (err: any) {
    console.error('[extract-actions] parse_response:', err?.message || err);
    return NextResponse.json(
      { actions: [], transcript, degraded: true, stage: 'parse_response' },
      { status: 200 },
    );
  }
}

interface VoiceContext {
  activeDevelopmentId: string | null;
  schemeName: string | null;
  recentListings: Array<{ id: string; address: string; vendor: string | null }>;
  lettingProperties: Array<{ id: string; address: string }>;
}

async function buildVoiceContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string | undefined,
  activeDevelopmentId: string | undefined,
): Promise<VoiceContext> {
  let schemeName: string | null = null;

  if (activeDevelopmentId) {
    const { data } = await supabase
      .from('developments')
      .select('name')
      .eq('id', activeDevelopmentId)
      .maybeSingle();
    schemeName = data?.name ?? null;
  }

  const { data: listings } = await supabase
    .from('listings')
    .select('id, address, vendor_name')
    .order('listed_date', { ascending: false })
    .limit(12);

  // Session 4B: pull the agent's letting properties so the model can match
  // rental viewing references like "14 Oakfield" to the right row. We scope
  // by the resolved agent_profile to keep the list relevant.
  let lettingProperties: Array<{ id: string; address: string }> = [];
  if (userId) {
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (profile?.id) {
      const { data: props } = await supabase
        .from('agent_letting_properties')
        .select('id, address, address_line_1')
        .eq('agent_id', profile.id)
        .limit(20);
      lettingProperties = (props || []).map((p: any) => ({
        id: p.id,
        address: p.address || p.address_line_1 || p.id,
      }));
    }
  }

  return {
    activeDevelopmentId: activeDevelopmentId ?? null,
    schemeName,
    recentListings: (listings || []).map((l: any) => ({
      id: l.id,
      address: l.address,
      vendor: l.vendor_name ?? null,
    })),
    lettingProperties,
  };
}

function buildExtractionSystemPrompt(ctx: VoiceContext, intentHint?: string): string {
  const listingsBlock = ctx.recentListings.length
    ? ctx.recentListings
        .map((l) => `- ${l.id}: ${l.address}${l.vendor ? ` (vendor: ${l.vendor})` : ''}`)
        .join('\n')
    : 'No recent listings available.';

  const lettingsBlock = ctx.lettingProperties.length
    ? ctx.lettingProperties
        .map((p) => `- ${p.id}: ${p.address}`)
        .join('\n')
    : 'No rental properties on file.';

  const intentLine = intentHint
    ? `\nThe user tapped a chip hinting the intent is "${intentHint}". Treat it as a prior, not a constraint.`
    : '';

  const schemeLine = ctx.schemeName
    ? `Active scheme: ${ctx.schemeName} (id ${ctx.activeDevelopmentId}).`
    : 'No active scheme selected.';

  return `You are the action extractor for an Irish sales and letting agent's voice assistant.

${schemeLine}${intentLine}

Recent sales listings you can match property references against:
${listingsBlock}

Rental properties on the agent's book (for lettings actions):
${lettingsBlock}

Given the agent's spoken transcript you must:
1. Identify every distinct action implied. A single sentence may imply several — for example "Murphys came to 14 Oakfield, loved it, probably offering Monday, tell the vendor" implies log_viewing + draft_vendor_update + create_reminder.
2. For each action call the matching tool exactly once with the required fields filled.
3. Include a _confidence object on every tool call mapping each field name to a number between 0 and 1 reflecting how sure you are of that specific value. Fields inferred or guessed should score below 0.7.
4. Use ISO 8601 for dates and times. If the transcript says "Monday" resolve to the next Monday in Europe/Dublin and set confidence <= 0.75.
5. Never invent contact details. If a name has no phone or email, leave contact_if_known empty.
6. Keep Irish peer-to-peer tone for any drafted body — casual, grounded, no em dashes, no emoji.
7. Do not emit tool calls for speculative or unrelated actions. If the transcript is purely a question (no action), return zero tool calls.

Choosing between draft tools:
 - draft_viewing_followup_buyer: the agent wants a thank-you / next-step email to the attendees after a SALES viewing. Trigger phrases: "follow up with Murphys", "thank them for coming". Reference anything specific they cared about. Note: for a RENTAL viewing follow-up, use draft_application_invitation instead.
 - draft_offer_response: the agent describes how to respond to an offer. Trigger phrases: "accept their offer", "counter at X", "reject the 420". Choose the right action enum. For counters the new amount must appear in the body.
 - draft_price_reduction_notice: the agent says the price has dropped and wants to tell active buyers. Trigger phrases: "vendor dropped to 450, tell anyone who viewed". Populate recipient_ids with every buyer referenced. The body_template uses the literal token {first_name} for personalisation — the server fills it in per recipient.
 - draft_chain_update_to_buyer: the agent describes chain progress for a single sales buyer. Trigger phrases: "survey came back", "solicitor instructed", "contracts issued", "there's a delay on completion".
 - draft_vendor_update: default sales-side update back to the vendor. Use for "tell the vendor" / "let the vendor know".

Lettings workflows:
 - log_rental_viewing: the agent just viewed a RENTAL property with prospective tenants. Trigger phrases: "three people came to see", "showed the Rathmines one today". Populate every attendee by name (even surnames like "the O'Sheas"). Set was_preferred=true on any attendee the agent says stood out. Use this BEFORE flag_applicant_preferred so the attendees exist.
 - flag_applicant_preferred: the agent explicitly says one attendee was their preferred applicant AFTER log_rental_viewing fires. Trigger phrases: "the O'Sheas were miles ahead", "the couple with the baby were the best fit". applicant_name must match the name used in the log_rental_viewing attendees list verbatim.
 - create_applicant: a standalone applicant capture from a phone enquiry, walk-in or referral that did NOT involve a viewing. Do NOT use this for viewing attendees.
 - draft_application_invitation: the agent wants to invite a preferred applicant to fill in the application form. Trigger phrases: "ask them to apply", "send them the form", "invite the O'Sheas to apply". Body must include the literal token {application_link} where the form URL will go. Emit this AFTER the log_rental_viewing + flag_applicant_preferred actions when the agent chains them in one sentence.

The canonical multi-action sentence looks like: "Three people came to see 14 Oakfield this afternoon, the O'Sheas were miles ahead, ask them to apply." That should produce log_rental_viewing + flag_applicant_preferred + draft_application_invitation, in that order, in a single response.`;
}
