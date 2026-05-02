import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  getRecentActivitySummary,
  getUpcomingDeadlines,
  loadEntityMemory,
  getViewingsSummary,
  getAgentProfileExtras,
  getAgedContracts,
  getSalesPipelineSummary,
  getLettingsSummary,
  getRenewalWindow,
  getRentArrears,
  getTodaysViewings,
  getUpcomingWeekViewings,
} from '@/lib/agent-intelligence/context';
import { resolveAgentContext } from '@/lib/agent-intelligence/agent-context';
import { resolveAgentContextV2 } from '@/lib/agent-intelligence/resolve-agent-v2';
import { buildAgentSystemPrompt, buildLettingsAgentSystemPrompt, buildLiveContext, buildLettingsLiveContext, type LiveContextBlocks } from '@/lib/agent-intelligence/system-prompt';
import { getToolDefinitionsForOpenAI, getToolByName } from '@/lib/agent-intelligence/tools/registry';
import type { AgentContext } from '@/lib/agent-intelligence/types';
import { isAgenticSkillEnvelope, type AgenticSkillEnvelope } from '@/lib/agent-intelligence/envelope';
import { captureInferredAlias, suggestClosestScheme, normaliseSchemeName } from '@/lib/agent-intelligence/scheme-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Map a tool name to a human-readable label for the streaming progress
// indicator. New tools fall back to a generic "Looking up details" label.
function labelForTool(toolName: string): string {
  switch (toolName) {
    case 'draft_message': return 'Drafting message';
    case 'draft_buyer_followups': return 'Drafting messages';
    case 'draft_lease_renewal': return 'Drafting renewal offer';
    case 'draft_viewing_followup': return 'Drafting viewing follow-up';
    case 'chase_aged_contracts': return 'Drafting chase emails';
    case 'weekly_monday_briefing': return 'Building briefing';
    case 'schedule_viewing_draft': return 'Drafting viewing schedule';
    case 'natural_query': return 'Looking up details';
    case 'get_unit_status':
    case 'get_unit_details':
    case 'get_scheme_overview':
    case 'get_scheme_summary':
    case 'get_buyer_details':
    case 'get_outstanding_items':
    case 'get_communication_history':
    case 'get_candidate_units':
      return 'Checking your records';
    default:
      return 'Looking up details';
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, history, sessionId, activeDevelopmentId, mode } = body;
    const resolvedMode: 'sales' | 'lettings' = mode === 'lettings' ? 'lettings' : 'sales';

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. Resolve the authenticated agent profile using route handler client (correct for API routes)
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    // Session 14.9 — switched to resolveAgentContextV2 because v1 returned
    // empty assignments in production despite the same query returning 5
    // rows when run inline (proven by /health quad-shape probes). v2 is a
    // clean-room re-implementation with sequential queries (no Promise.all)
    // and explicit error handling on the developments hydrate step. The
    // /health endpoint shows v2 returning all 5 schemes correctly while
    // v1 returns []. The activeDevelopmentId fallback that v1 supports
    // is dropped here — it's a UI nicety that's not worth keeping the
    // broken codepath alive for.
    const v2 = await resolveAgentContextV2(supabase, user?.id ?? null);
    const resolved = v2.context;
    // Keep the old import alive so dead-import lint doesn't trip; the
    // export is still useful for /health diagnostics.
    void resolveAgentContext;

    if (!resolved) {
      return new Response(JSON.stringify({ error: 'No agent profile found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tenantId: string = resolved.tenantId ?? '';
    const authUserId = resolved.authUserId;

    const agentContext: AgentContext = {
      agentProfileId: resolved.agentProfileId,
      authUserId,
      tenantId,
      displayName: resolved.displayName,
      agencyName: resolved.agencyName,
      agentType: resolved.agentType,
      assignedSchemes: resolved.assignedSchemes,
      assignedDevelopmentIds: resolved.assignedDevelopmentIds,
      assignedDevelopmentNames: resolved.assignedDevelopmentNames,
      activeDevelopmentId: activeDevelopmentId ?? null,
      mode: resolvedMode,
    };

    // Session 14.2 — trip-wire log. If `resolveAgentContext` returned a
    // profile but zero assigned schemes, every downstream read tool will
    // reply "(none)" against every real scheme name. That's the silent
    // state Session 14.2 is fixing; log it at the dispatch layer too,
    // because the next regression will surface here before it shows up
    // in the tool result summary.
    if (!agentContext.assignedDevelopmentIds.length) {
      console.error('[chat/route] agent context has empty assignedDevelopmentIds', {
        agentProfileId: resolved.agentProfileId,
        userId: authUserId,
        tenantId,
        message: message.slice(0, 200),
      });
    }

    // 2. Build context components in parallel — legacy loaders + new live-context blocks.
    // Each new helper is wrapped in .catch() so a failing query (e.g. a column
    // mismatch on agent_letting_properties / agent_tenancies) degrades to an
    // empty block rather than taking down the whole request.
    const [
      recentActivity,
      upcomingDeadlines,
      entityMemory,
      viewingsSummary,
      agentExtras,
      agedContracts,
      salesPipeline,
      lettings,
      renewalWindow,
      rentArrears,
      todaysViewings,
      weekViewings,
    ] = await Promise.all([
      getRecentActivitySummary(supabase, tenantId, agentContext).catch(() => ''),
      getUpcomingDeadlines(supabase, tenantId, agentContext).catch(() => ''),
      agentContext.agentProfileId
        ? loadEntityMemory(supabase, agentContext.agentProfileId, message).catch(() => '')
        : Promise.resolve(''),
      agentContext.agentProfileId
        ? getViewingsSummary(supabase, agentContext).catch(() => '')
        : Promise.resolve(''),
      agentContext.agentProfileId
        ? getAgentProfileExtras(supabase, agentContext.agentProfileId).catch(() => null)
        : Promise.resolve(null),
      getAgedContracts(supabase, tenantId, agentContext, 42).catch(() => []),
      getSalesPipelineSummary(supabase, tenantId, agentContext).catch(() => null),
      agentContext.agentProfileId
        ? getLettingsSummary(supabase, agentContext.agentProfileId).catch(() => null)
        : Promise.resolve(null),
      agentContext.agentProfileId
        ? getRenewalWindow(supabase, agentContext.agentProfileId).catch(() => [])
        : Promise.resolve([]),
      agentContext.agentProfileId
        ? getRentArrears(supabase, agentContext.agentProfileId).catch(() => [])
        : Promise.resolve([]),
      agentContext.agentProfileId
        ? getTodaysViewings(supabase, agentContext.agentProfileId).catch(() => [])
        : Promise.resolve([]),
      agentContext.agentProfileId
        ? getUpcomingWeekViewings(supabase, agentContext.agentProfileId).catch(() => [])
        : Promise.resolve([]),
    ]);

    // Assemble the live-context string. buildLiveContext enforces the 2000-token
    // budget internally, applying the priority order: identity > today's viewings >
    // aged contracts > renewal window > arrears > sales stats > lettings > upcoming
    // viewings > scheme names (items a-e always included, f-i pruned if budget hit).
    const liveContextBlocks: LiveContextBlocks = {
      agentExtras,
      todaysViewings,
      agedContracts,
      renewalWindow,
      rentArrears,
      salesPipeline,
      lettings,
      weekViewings,
    };
    const liveContext = resolvedMode === 'lettings'
      ? buildLettingsLiveContext(liveContextBlocks)
      : buildLiveContext(liveContextBlocks);

    // 2b. Load independent agent context if applicable
    let independentContext = '';
    const agentType = agentContext.agentType ?? 'scheme';
    if (agentType !== 'scheme') {
      independentContext = await buildIndependentAgentContext(supabase, agentContext.agentProfileId);
    }

    // 3. Build system prompt — branch on workspace mode. Lettings mode swaps
    // the sales TOOL-USE MANDATE / scheme/unit/buyer vocabulary for a
    // tenant/property/lease one and reads from the LETTINGS PORTFOLIO block.
    const promptBuilder = resolvedMode === 'lettings'
      ? buildLettingsAgentSystemPrompt
      : buildAgentSystemPrompt;
    const systemPrompt = promptBuilder(
      agentContext,
      recentActivity,
      upcomingDeadlines,
      entityMemory,
      '', // RAG results injected after tool calls if needed
      independentContext,
      viewingsSummary,
      liveContext,
    );

    // Session 14 — yes/no disambiguation follow-through.
    //
    // Turn N-1 emitted "Did you mean **Árdan View**? (yes/no)" and stashed
    // a hidden `<!--PENDING_CLARIFICATION:{…}-->` marker on the assistant
    // message. If the current user reply matches the yes regex we:
    //   1. Rewrite the user's effective message by substituting the
    //      topCandidateName in place of the originally-typed scheme name.
    //   2. Capture the original typed string as an inferred alias for the
    //      development_id (self-healing — next time "Erdon View" resolves
    //      straight to Árdan View without prompting).
    //
    // Session 14.3 — lookup order is now DB-first, then client history
    // fallback. Pre-14.3 the marker was embedded as an HTML comment in
    // the streamed token (visible to the user as a base64 blob). Post-
    // 14.3 the token stream carries only the visible prompt; the marker
    // lives ONLY in the server-stored assistant row. Reading from DB by
    // sessionId closes the loop without relying on the client to echo
    // the stored content back.
    const pending =
      (sessionId ? await extractPendingClarificationFromDb(supabase, sessionId) : null)
      || extractPendingClarification(history);
    const yesPattern = /^(yes|y|yeah|yep|yup|correct|that'?s it|that'?s right|aye|ok|okay)\b/i;
    let effectiveMessage = message;
    if (pending && yesPattern.test(message.trim())) {
      effectiveMessage = rewriteWithCandidate(pending.originalMessage, pending.typedScheme, pending.topCandidateName);
      if (pending.topCandidateDevId && pending.typedScheme) {
        captureInferredAlias(supabase, pending.topCandidateDevId, pending.typedScheme).catch(() => {});
      }
    }

    // 4. Build message history
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (history?.length) {
      for (const msg of history.slice(-10)) {
        // Strip the PENDING_CLARIFICATION marker from assistant turns
        // before showing them to the model — it's metadata for this
        // server's next-turn logic, not conversational content.
        const content = msg.role === 'assistant' ? stripClarificationMarker(msg.content) : msg.content;
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content,
        });
      }
    }

    messages.push({ role: 'user', content: effectiveMessage });

    // 5. Call LLM with tool definitions (non-streaming for tool-calling rounds)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const tools = getToolDefinitionsForOpenAI();
    const toolsCalled: Array<{ tool_name: string; params: any; result_summary: string }> = [];

    // Tool names that MUST land a real draft. If any of these fire but no
    // envelope with drafts comes back, the anti-hallucination guard kicks
    // in and overrides the model's response.
    const DRAFT_PRODUCING_TOOLS = new Set<string>([
      'draft_message',
      'draft_buyer_followups',
      'chase_aged_contracts',
      'draft_viewing_followup',
      'draft_lease_renewal',
      'weekly_monday_briefing',
      'schedule_viewing_draft',
    ]);

    // Run tool-calling rounds (non-streaming so we can parse tool calls)
    let needsFinalStream = true;
    let rounds = 0;
    const MAX_TOOL_ROUNDS = 3;
    const envelopes: AgenticSkillEnvelope[] = [];

    while (rounds <= MAX_TOOL_ROUNDS) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 4000,
      });

      const responseMessage = completion.choices[0]?.message;
      if (!responseMessage) break;

      // If no tool calls, we have a final text response but it came non-streamed.
      // We'll re-do this call as streaming below.
      if (!responseMessage.tool_calls?.length) {
        // Remove the last user message temporarily; we'll stream the final call
        needsFinalStream = true;
        break;
      }

      // Process tool calls
      rounds++;
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const toolDef = getToolByName(toolCall.function.name);
        let toolResult: string;

        if (toolDef) {
          try {
            const params = JSON.parse(toolCall.function.arguments);
            const result = await toolDef.execute(supabase, tenantId, agentContext, params);
            toolResult = JSON.stringify(result);
            toolsCalled.push({
              tool_name: toolCall.function.name,
              params,
              result_summary: result.summary,
            });
            // Agentic skills return a ToolResult whose `data` is an
            // AgenticSkillEnvelope. Collect them so we can stream an
            // `envelope` SSE frame once the tool-calling rounds finish.
            const envelope = extractEnvelope(result);
            if (envelope) envelopes.push(envelope);
          } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Unknown error';
            toolResult = JSON.stringify({ error: errMessage, summary: `Tool execution failed: ${errMessage}` });
          }
        } else {
          toolResult = JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // 5b. Anti-hallucination pre-stream guard.
    //
    // Collect signals before streaming the final response:
    //   - Was any draft-producing tool called?
    //   - Did any envelope come back with drafts?
    // If a draft tool fired and nothing persisted, inject a system note so
    // the streaming model is told explicitly NOT to claim drafts exist.
    // Post-stream we still check the final text and emit a hard override
    // if the model lies anyway.
    const draftToolCalled = toolsCalled.some((t) => DRAFT_PRODUCING_TOOLS.has(t.tool_name));
    const envelopesWithDrafts = envelopes.filter((e) => e.drafts.length > 0);
    const totalDraftsPersisted = envelopesWithDrafts.reduce((n, e) => n + e.drafts.length, 0);

    if (draftToolCalled && totalDraftsPersisted === 0) {
      messages.push({
        role: 'system',
        content:
          'IMPORTANT: The draft tool(s) you just called returned zero drafts. Do NOT tell the user their drafts are ready, or that anything is in the drafts inbox, or that you prepared anything to review. Tell them the action did not go through, and ask them to rephrase or try a more specific request.',
      });
    }

    // Session 13.2 — scheme-not-found / blocked-placeholder hard stop.
    //
    // Collect any skipped (skill-level refusals — unresolved scheme, unknown
    // unit, unresolved solicitor) and blocked (persistence-layer refusals —
    // placeholder recipient) entries from this turn's envelopes. If a
    // draft-producing tool fired and produced zero drafts while carrying
    // skipped / blocked reasons, force the model to read them verbatim and
    // refuse to claim drafts were created. The existing 6D guard covers the
    // generic "no drafts" case; this one adds the specific reasons the user
    // needs to see (e.g. "not in your assigned schemes") instead of a vague
    // "action did not go through".
    const skippedEntries: Array<{ source: 'skipped' | 'blocked'; unit_identifier: string; reason: string }> = [];
    for (const env of envelopes) {
      const meta: any = env.meta || {};
      if (Array.isArray(meta.skipped)) {
        for (const s of meta.skipped) {
          skippedEntries.push({
            source: 'skipped',
            unit_identifier: String(s?.unit_identifier ?? '').trim(),
            reason: String(s?.reason ?? '').trim(),
          });
        }
      }
      if (Array.isArray(meta.blocked)) {
        for (const b of meta.blocked) {
          skippedEntries.push({
            source: 'blocked',
            unit_identifier: String(b?.unit_identifier ?? '').trim(),
            reason: String(b?.reason ?? '').trim(),
          });
        }
      }
    }

    if (draftToolCalled && totalDraftsPersisted === 0 && skippedEntries.length > 0) {
      const reasonsBlock = skippedEntries
        .map((e, idx) => {
          const label = e.unit_identifier ? `"${e.unit_identifier}"` : `target #${idx + 1}`;
          return `- ${label}: ${e.reason}`;
        })
        .join('\n');
      messages.push({
        role: 'system',
        content:
          'IMPORTANT: The user asked for drafts but NONE were created. Read the skipped/blocked reasons below and relay them to the user VERBATIM. Do NOT claim any draft was created. Do NOT say anything is in the drafts inbox or ready for review. Do NOT invent unit numbers, scheme names, or recipient names that do not appear in the reasons. If a scheme or unit was not found, say so plainly and list the user\'s assigned schemes when the reason already mentions them.\n\nSkipped / blocked reasons:\n' +
          reasonsBlock,
      });
    }

    // Session 14 — yes/no disambiguation hook. Pick a single top_candidate
    // surfaced on any envelope's meta this turn. If two envelopes name
    // DIFFERENT candidates the prompt would be ambiguous — skip entirely.
    // Only fires when zero drafts landed, so a successful partial draft
    // doesn't interrupt the normal flow with a clarification.
    let topCandidateForPrompt: ReturnType<typeof pickSingleTopCandidate> = totalDraftsPersisted === 0
      ? pickSingleTopCandidate(envelopes)
      : null;

    // Session 14.10 — disambiguation safety net.
    //
    // When the model defies the WRITE-SIDE TOOL-USE MANDATE and refuses
    // a "reach out / draft / email" instruction inline (without calling
    // any draft tool), no envelope is produced and no top_candidate
    // surfaces. The user sees a flat "X isn't one of your schemes"
    // refusal even when X is one Levenshtein hop from a real scheme.
    //
    // This safety net fires when:
    //   - No tool was called this turn (toolsCalled is empty), AND
    //   - The user message contains a candidate scheme phrase (a
    //     capitalised multi-word noun phrase or a phrase preceded by
    //     "in" / "at" / "," that looks like a place name), AND
    //   - That candidate is within Levenshtein distance ≤ 3 of exactly
    //     one assigned scheme name (per scheme-resolver's
    //     suggestClosestScheme heuristic), AND
    //   - The user message looks like a write request (contains a verb
    //     from a known set: reach out, draft, email, send, follow up,
    //     chase, ping, message, write, contact, let X know).
    //
    // When all four hold, we pre-populate topCandidateForPrompt so the
    // existing yes/no short-circuit downstream emits "Did you mean X?".
    // The next turn's "yes" reply then re-runs the original message
    // with the canonical scheme name substituted in — same flow as the
    // tool-driven path.
    if (!topCandidateForPrompt && toolsCalled.length === 0 && agentContext.assignedDevelopmentNames.length) {
      const writeIntent = /\b(reach\s*out|draft|email|send|follow\s*up|chase|ping|message|write\s*to|contact|let\s+\w+\s+know)\b/i.test(message);
      if (writeIntent) {
        const candidateNames = extractCandidateSchemePhrases(message);
        for (const candidate of candidateNames) {
          const closest = suggestClosestScheme(candidate, {
            assignedDevelopmentNames: agentContext.assignedDevelopmentNames,
          });
          if (closest && normaliseForCompare(closest) !== normaliseForCompare(candidate)) {
            const idx = agentContext.assignedDevelopmentNames.findIndex((n) => n === closest);
            if (idx >= 0) {
              topCandidateForPrompt = {
                name: closest,
                typed: candidate,
                developmentId: agentContext.assignedDevelopmentIds[idx],
              };
              console.error('[disambiguation-safety-net] activated', {
                userId: agentContext.authUserId,
                typed: candidate,
                suggested: closest,
                originalMessage: message.slice(0, 200),
              });
              break;
            }
          }
        }
      }
    }

    // Session 13 self-healing alias capture.
    //
    // When the model's previous turn surfaced a "I couldn't find a scheme
    // matching 'X'" message AND this turn's tools resolved a scheme
    // cleanly, insert the previous miss "X" as an alias for the resolved
    // development. Capped at 50 inferred rows per development inside
    // captureInferredAlias. This is fire-and-forget — aliases are a nice-
    // to-have, never block the turn on a write.
    try {
      const previousMiss = extractPreviousSchemeMiss(history);
      if (previousMiss) {
        const resolvedDevId = resolvedSchemeFromEnvelopes(envelopes);
        if (resolvedDevId) {
          captureInferredAlias(supabase, resolvedDevId, previousMiss).catch(() => {});
        }
      }
    } catch {
      /* silent — alias capture is additive */
    }

    // Merge all envelopes produced in this turn into one combined envelope.
    // The drawer store replaces state on every `openApprovalDrawer()` call,
    // so multiple sequential envelopes from parallel tool calls would show
    // only the last. One envelope with N drafts matches the user's mental
    // model ("I asked for 3 drafts; I see 3 drafts").
    const combinedEnvelope: AgenticSkillEnvelope | null = envelopesWithDrafts.length
      ? mergeEnvelopes(envelopesWithDrafts)
      : null;

    // 6. Stream the final response token-by-token
    const currentSessionId = sessionId || `session_${Date.now()}`;
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        // Session 14a — progress instrumentation. The chat route's heavy
        // lifting (resolveAgentContextV2, live-context Promise.all, the
        // first OpenAI call, tool execution) all completes BEFORE the
        // ReadableStream opens. We emit progress events inside start() to
        // narrate what's happening to the user, so a 5–15s wait feels
        // intentional rather than dead. Order: context → (tool, if fired) →
        // thinking → finalising. The first 'token' frame on the client
        // clears the indicator.
        const emitProgress = (stage: string, label: string) => {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'progress', stage, label }) + '\n')
          );
        };
        emitProgress('context', 'Reading your portfolio');

        try {
          // Send tool call metadata first so the UI knows tools were used
          if (toolsCalled.length > 0) {
            emitProgress('tool', labelForTool(toolsCalled[0].tool_name));
            controller.enqueue(
              encoder.encode(JSON.stringify({
                type: 'tools_used',
                tools: toolsCalled.map(t => ({ name: t.tool_name, summary: t.result_summary })),
              }) + '\n')
            );
          }

          // One combined envelope per turn. The client's drawer store opens
          // with the full set — approve / edit / discard targets real
          // `pending_drafts.id`s that were rewritten by
          // persistSkillEnvelope inside the registry adapter.
          if (combinedEnvelope) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'envelope', envelope: combinedEnvelope }) + '\n')
            );
          }

          // Session 14 — yes/no disambiguation short-circuit. When a skill
          // surfaced a single-candidate scheme typo this turn, bypass the
          // LLM and emit a fixed prompt with a hidden marker. The model
          // cannot be trusted to phrase this consistently on gpt-4o-mini,
          // and the marker must be exact for the next turn's parser.
          let fullContent = '';
          if (topCandidateForPrompt) {
            // Session 14.3 — split the clarification into two SSE frames.
            // `token` carries only the user-visible prompt. A separate
            // `pending_clarification` frame carries the structured payload
            // the client stashes so it can round-trip back on the next
            // turn. Pre-14.3 the payload was embedded as an HTML-comment
            // marker inside the same token; the markdown renderer
            // escaped `<` to `&lt;`, so the whole base64 blob ended up
            // visible on screen. Split-frame design eliminates that
            // class of bug — the marker never enters user-visible text.
            const promptText = `Did you mean **${topCandidateForPrompt.name}**? (yes/no)`;
            const clarificationPayload: ClarificationPayload = {
              originalMessage: message,
              typedScheme: topCandidateForPrompt.typed,
              topCandidateName: topCandidateForPrompt.name,
              topCandidateDevId: topCandidateForPrompt.developmentId,
            };
            const marker = buildClarificationMarker(clarificationPayload);
            // Visible text: prompt only, no marker.
            fullContent = promptText;
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'token', content: promptText }) + '\n')
            );
            // Control frame: structured payload for the client to stash.
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'pending_clarification', payload: clarificationPayload }) + '\n',
              ),
            );
            // Stored content: prompt + marker so next-turn detection via
            // history still works when the client echoes the stored
            // assistant text verbatim. The marker is an HTML comment in
            // the stored DB row only — never emitted to the token stream.
            fullContent = `${promptText}\n${marker}`;
          } else {
            // Stream the final LLM response
            emitProgress('thinking', 'Composing reply');
            const stream = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages,
              tools: undefined, // No tools on final streaming call
              temperature: 0.3,
              max_tokens: 4000,
              stream: true,
            });
            // Connection established, model is generating — last narration
            // beat before tokens start arriving.
            emitProgress('finalising', 'Almost there');

            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                fullContent += delta;
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: 'token', content: delta }) + '\n')
                );
              }
            }

            if (!fullContent) {
              fullContent = 'I wasn\'t able to generate a response. Please try again.';
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: 'token', content: fullContent }) + '\n')
              );
            }
          }

          // Anti-hallucination post-stream guard.
          //
          // If the streamed response claims drafts were created but no
          // envelope landed in this turn, emit an `override` frame. The
          // client listens for it and replaces the assistant's message
          // text with an honest failure string. Better to apologise than
          // to lie politely.
          const HALLUCINATION_REGEX =
            /drafted|drafts?\s+(?:are|is)\s+ready|ready\s+for\s+your\s+review|in\s+the\s+drafts?\s+inbox|prepared\s+\d+\s+draft|i['’]ll\s+draft|i\s+(?:have\s+)?drafted/i;
          const claimsDrafts = HALLUCINATION_REGEX.test(fullContent);
          if (claimsDrafts && totalDraftsPersisted === 0) {
            const honestMessage = "I tried to draft those emails but the action didn’t actually go through — nothing landed in your inbox. Could you try asking again, or rephrase with the specific unit numbers / buyer names?";
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'override', content: honestMessage }) + '\n')
            );
            // Replace the recorded response so memory + analytics store the
            // honest text, not the lie.
            fullContent = honestMessage;
            console.error('[hallucinated_drafts] overrode assistant response', {
              kind: 'hallucinated_drafts',
              user: agentContext.displayName,
              userId: agentContext.authUserId,
              originalMessage: message,
              assistantClaimed: fullContent,
              toolsCalled: toolsCalled.map((t) => t.tool_name),
              draftToolCalled,
              totalDraftsPersisted,
            });
          }

          // Store memory and log interaction (async, non-blocking)
          storeConversationMemory(supabase, agentContext, currentSessionId, message, fullContent, toolsCalled).catch(() => {});
          logInteraction(supabase, tenantId, authUserId, message, fullContent, toolsCalled, startTime, {
            hallucinatedDrafts: claimsDrafts && totalDraftsPersisted === 0,
          }, resolvedMode).catch(() => {});

          // Generate follow-up suggestions (non-blocking, appended after main response)
          // Skip when we fired the Session 14 yes/no short-circuit — the
          // user's next move is literally "yes" or "no", not an action chip.
          if (topCandidateForPrompt) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'done', sessionId: currentSessionId }) + '\n')
            );
            controller.close();
            return;
          }

          try {
            const toolNames = toolsCalled.map(t => t.tool_name).join(', ');
            const followUpCompletion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: `You suggest next actions for a busy Irish estate agent selling new homes. Based on the conversation, suggest 2-3 short ACTION-ORIENTED next steps the agent might want to take.

RULES:
- Every suggestion must be an ACTION the agent can take, not a question back to the agent.
- Start each suggestion with a verb: Draft, Check, Show, Create, Generate, Log.
- Never ask the agent a clarifying question. Never use "Would you like..." or "Should I..."
- Keep each suggestion under 8 words.
- Make suggestions contextual to what was just discussed.
- Each string is a clean suggestion. Do NOT wrap suggestions in quote characters, do not start them with a hyphen or bullet, do not add markdown.
- Return ONLY a JSON array of strings, no explanation.`,
                },
                {
                  role: 'user',
                  content: `Agent asked: ${message}\n\nTools used: ${toolNames || 'none'}\n\nAssistant replied: ${fullContent.slice(0, 500)}`,
                },
              ],
              temperature: 0.5,
              max_tokens: 200,
            });

            const followUpText = followUpCompletion.choices[0]?.message?.content?.trim();
            if (followUpText) {
              const questions = JSON.parse(followUpText);
              if (Array.isArray(questions) && questions.length > 0) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: 'followups', questions }) + '\n')
                );
              }
            }
          } catch {
            // Skip follow-ups if generation fails
          }

          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'done', sessionId: currentSessionId }) + '\n')
          );
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'error', message: 'Stream failed' }) + '\n')
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Unwrap an AgenticSkillEnvelope from a tool result. Registry tools return
 * `{ data, summary }`; the envelope is on `.data` for agentic skills but not
 * on read-only tools (which return plain objects). Returns null when the
 * result is not an envelope.
 */
function extractEnvelope(result: any): AgenticSkillEnvelope | null {
  if (!result) return null;
  if (isAgenticSkillEnvelope(result)) return result;
  if (isAgenticSkillEnvelope(result?.data)) return result.data;
  return null;
}

/**
 * Merge several non-empty envelopes produced in one turn into one. Drafts
 * are concatenated preserving insert order; skill is the first skill seen
 * (or `combined` when skills differ). The drawer store replaces state on
 * every open call, so the client needs one envelope per turn, not many.
 */
function mergeEnvelopes(envelopes: AgenticSkillEnvelope[]): AgenticSkillEnvelope {
  if (envelopes.length === 1) return envelopes[0];
  const drafts = envelopes.flatMap((e) => e.drafts);
  const skillSet = new Set(envelopes.map((e) => e.skill));
  const skill = skillSet.size === 1 ? envelopes[0].skill : 'combined';
  return {
    skill,
    status: 'awaiting_approval',
    summary: `Drafted ${drafts.length} item${drafts.length === 1 ? '' : 's'}.`,
    drafts,
    meta: {
      record_count: drafts.length,
      generated_at: new Date().toISOString(),
      query: envelopes.map((e) => e.meta.query).join(' | '),
    },
  };
}

/**
 * Session 13 self-healing alias extraction. When the previous assistant
 * turn said "I couldn't find a scheme matching 'X'", pull X out so we
 * can store it as an alias if the current turn resolves cleanly.
 */
function extractPreviousSchemeMiss(history: Array<{ role: string; content: string }> | undefined): string | null {
  if (!history || !history.length) return null;
  // Find the last assistant message.
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'assistant') continue;
    const match = msg.content.match(/couldn['’]?t find a scheme matching ["“']([^"”']{1,80})["”']/i);
    if (match) return match[1].trim();
    // Only look at the immediately-preceding assistant turn; older
    // misses belong to different conversation branches.
    return null;
  }
  return null;
}

/**
 * Pull the first resolved development_id out of this turn's envelopes.
 * `draftBuyerFollowups` (Session 13) stashes `meta.resolved_development_ids`
 * as it drafts — that's the canonical signal. Returns null when no
 * envelope surfaced one (no scheme resolved this turn, so nothing to
 * attach an inferred alias to).
 */
function resolvedSchemeFromEnvelopes(envelopes: AgenticSkillEnvelope[]): string | null {
  for (const env of envelopes) {
    const meta = (env.meta as any) || {};
    const ids = Array.isArray(meta.resolved_development_ids)
      ? (meta.resolved_development_ids as string[])
      : [];
    if (ids.length === 1) return ids[0];
    // Multiple resolved — ambiguous to alias-capture; skip.
  }
  return null;
}

// --- Session 14 — yes/no disambiguation helpers ----------------------------

/**
 * The hidden marker embedded in the assistant message when a scheme typo
 * triggered a "Did you mean X?" prompt. The payload is base64-encoded JSON
 * so a stray quote in the user's original message can't break the comment
 * terminator.
 */
const CLARIFICATION_MARKER_RE = /<!--PENDING_CLARIFICATION:([A-Za-z0-9+/=]+)-->/;

interface ClarificationPayload {
  originalMessage: string;
  typedScheme: string;
  topCandidateName: string;
  topCandidateDevId: string;
}

function buildClarificationMarker(payload: ClarificationPayload): string {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return `<!--PENDING_CLARIFICATION:${b64}-->`;
}

function stripClarificationMarker(content: string): string {
  return content.replace(CLARIFICATION_MARKER_RE, '').trimEnd();
}

/**
 * Parse a clarification marker out of an assistant message content
 * string. Returns null when no marker is present or the payload is
 * malformed. Kept as a small helper because both the history-based
 * and DB-based lookup paths need the same parse logic.
 */
function parseClarificationFromContent(content: string): ClarificationPayload | null {
  const match = content.match(CLARIFICATION_MARKER_RE);
  if (!match) return null;
  try {
    const json = Buffer.from(match[1], 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (
      typeof parsed?.originalMessage === 'string' &&
      typeof parsed?.typedScheme === 'string' &&
      typeof parsed?.topCandidateName === 'string' &&
      typeof parsed?.topCandidateDevId === 'string'
    ) {
      return parsed as ClarificationPayload;
    }
  } catch {
    /* malformed — ignore */
  }
  return null;
}

/**
 * Session 14.3 — DB-backed clarification lookup.
 *
 * Primary detection path. Reads the most recent assistant row from
 * `intelligence_conversations` for this session. The server-stored
 * content carries the PENDING_CLARIFICATION marker regardless of
 * whether the client echoed it back in `history` — which it won't,
 * because 14.3 strips the marker from the user-visible token stream.
 *
 * Returns null if the row is older than the previous assistant turn
 * (the session has moved on) or carries no marker.
 */
async function extractPendingClarificationFromDb(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  sessionId: string,
): Promise<ClarificationPayload | null> {
  const { data, error } = await supabase
    .from('intelligence_conversations')
    .select('content, role, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('[chat/route] extractPendingClarificationFromDb error', {
      sessionId,
      message: error.message,
    });
    return null;
  }
  const row = (data || [])[0];
  if (!row || row.role !== 'assistant' || typeof row.content !== 'string') return null;
  return parseClarificationFromContent(row.content);
}

/**
 * Pull the clarification payload out of the LAST assistant message in
 * history. Kept as a fallback for the 14.3 DB path — if a client
 * version still round-trips the full stored content verbatim, this
 * path catches it. Safe to run alongside the DB path; same parser.
 */
function extractPendingClarification(
  history: Array<{ role: string; content: string }> | undefined,
): ClarificationPayload | null {
  if (!history || !history.length) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'assistant') continue;
    // Only look at the immediately-preceding assistant turn; older
    // misses belong to different conversation branches.
    return parseClarificationFromContent(msg.content);
  }
  return null;
}

/**
 * Replace the first case-insensitive occurrence of `typedScheme` in the
 * original message with `topCandidateName`. Preserves everything else so
 * the downstream intent (unit number, kitchen question, etc.) carries
 * through unchanged. Falls back to appending the canonical name when the
 * typed string can't be found verbatim — pathological but safe.
 */
function rewriteWithCandidate(originalMessage: string, typedScheme: string, topCandidateName: string): string {
  if (!typedScheme) return originalMessage;
  const escaped = typedScheme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped, 'i');
  if (re.test(originalMessage)) {
    return originalMessage.replace(re, topCandidateName);
  }
  return `${originalMessage} (${topCandidateName})`;
}

/**
 * Pick at most one top_candidate across all envelopes produced this turn.
 * If two envelopes carry DIFFERENT candidates the prompt would be
 * ambiguous — we return null and fall back to the standard "not found"
 * refusal. Same rule as the skill-level collection: one obvious candidate
 * or nothing.
 */
function pickSingleTopCandidate(envelopes: AgenticSkillEnvelope[]): {
  name: string;
  developmentId: string;
  typed: string;
} | null {
  const seen: Array<{ name: string; developmentId: string; typed: string }> = [];
  for (const env of envelopes) {
    const meta: any = env.meta || {};
    const c = meta.top_candidate;
    if (c && typeof c.name === 'string' && typeof c.developmentId === 'string' && typeof c.typed === 'string') {
      seen.push({ name: c.name, developmentId: c.developmentId, typed: c.typed });
    }
  }
  if (!seen.length) return null;
  const distinct = new Set(seen.map((c) => c.developmentId));
  if (distinct.size !== 1) return null;
  return seen[0];
}

/**
 * Session 14.10 — disambiguation safety net.
 *
 * Pull plausible scheme-name phrases out of a free-form user message.
 * Heuristic: any sequence of 1–4 capitalised tokens (allowing words like
 * "View", "Park", "Heights", "Apartments", "Lawn"), optionally preceded
 * by "in", "at", "for", or a comma. Returns candidates in order of
 * appearance, deduped, lowercase-collapsed for compare.
 *
 * Examples:
 *   "Reach out to number 3, Erdon View"        → ["Erdon View"]
 *   "Email the Murphys at Castlebar Heights"   → ["Castlebar Heights"]
 *   "Tell me about Rathárd Park and Longview"  → ["Rathárd Park", "Longview"]
 *   "What's the status of Unit 3 in Árdan View?" → ["Árdan View"]
 *
 * Intentionally permissive — false positives are filtered downstream
 * by the Levenshtein distance check in suggestClosestScheme. We only
 * lose disambiguation suggestions if NO capitalised phrase appears in
 * the message, which for write-side scheme references is essentially
 * never.
 */
function extractCandidateSchemePhrases(message: string): string[] {
  // Match a run of 1–4 Capitalised Words. Allow Irish chars (Á, É, Í, Ó, Ú).
  // Loose: doesn't require the run to be preceded by anything, but excludes
  // sentence-initial 'I', and excludes obvious non-place phrases.
  const TOKEN = "[A-ZÁÉÍÓÚ][a-záéíóúA-ZÁÉÍÓÚ'’-]+";
  const regex = new RegExp(`(?:${TOKEN}(?:\\s+${TOKEN}){0,3})`, 'g');
  const matches = message.match(regex) ?? [];
  const stopwords = new Set([
    'I', 'Unit', 'Number', 'Apt', 'Apartment', 'House', 'Mr', 'Mrs', 'Ms',
    'Reach', 'Draft', 'Email', 'Send', 'Follow', 'Chase', 'Ping', 'Message',
    'Write', 'Contact', 'Let', 'Please', 'Tell', 'Show', 'Find', 'Get', 'Check',
    'What', 'Who', 'When', 'Where', 'Why', 'How', 'Yes', 'No', 'Hi', 'Hello',
    'OK', 'Okay', 'Thanks', 'Thank', 'Sure',
  ]);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of matches) {
    const trimmed = raw.trim().replace(/^(in|at|for|to|the)\s+/i, '');
    // Skip obviously single-word stopwords.
    const tokens = trimmed.split(/\s+/);
    if (tokens.length === 1 && stopwords.has(tokens[0])) continue;
    // Strip leading stopword token if multi-word.
    while (tokens.length > 1 && stopwords.has(tokens[0])) tokens.shift();
    const cleaned = tokens.join(' ').trim();
    if (!cleaned || cleaned.length < 3) continue;
    const key = normaliseForCompare(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/**
 * Lowercased, fadá-stripped, whitespace-collapsed compare key. Mirrors
 * scheme-resolver's normaliseSchemeName so two phrases compare equal
 * iff scheme-resolver would treat them as the same alias key.
 */
function normaliseForCompare(s: string): string {
  return normaliseSchemeName(s);
}

/**
 * Store user and assistant messages in conversation memory for cross-session context.
 */
async function storeConversationMemory(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  agentContext: AgentContext,
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
  toolsCalled: Array<{ tool_name: string; params: any; result_summary: string }>
) {
  // Extract mentioned entities from tool calls
  const entities: { units: string[]; buyers: string[]; schemes: string[] } = {
    units: [],
    buyers: [],
    schemes: [],
  };

  for (const tool of toolsCalled) {
    if (tool.params.unit_identifier) entities.units.push(tool.params.unit_identifier);
    if (tool.params.buyer_name) entities.buyers.push(tool.params.buyer_name);
    if (tool.params.scheme_name) entities.schemes.push(tool.params.scheme_name);
  }

  await supabase.from('intelligence_conversations').insert([
    {
      agent_id: agentContext.agentProfileId,
      tenant_id: agentContext.tenantId,
      session_id: sessionId,
      role: 'user',
      content: userMessage,
      entities_mentioned: entities,
    },
    {
      agent_id: agentContext.agentProfileId,
      tenant_id: agentContext.tenantId,
      session_id: sessionId,
      role: 'assistant',
      content: assistantResponse,
      entities_mentioned: entities,
    },
  ]);
}

/**
 * Log the intelligence interaction for analytics, audit, and learning.
 */
async function logInteraction(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tenantId: string,
  userId: string,
  queryText: string,
  responseText: string,
  toolsCalled: Array<{ tool_name: string; params: any; result_summary: string }>,
  startTime: number,
  flags: { hallucinatedDrafts?: boolean } = {},
  mode: 'sales' | 'lettings' = 'sales'
) {
  const latencyMs = Date.now() - startTime;
  const skinTag = mode === 'lettings' ? 'agent_lettings' : 'agent';

  // Detect knowledge gaps (responses indicating missing data)
  const isKnowledgeGap = responseText.toLowerCase().includes('i don\'t have that data') ||
    responseText.toLowerCase().includes('not in the system') ||
    responseText.toLowerCase().includes('no data available');

  const responseType = flags.hallucinatedDrafts
    ? 'hallucinated_drafts'
    : toolsCalled.some(t => t.tool_name === 'draft_message' || t.tool_name === 'draft_buyer_followups')
      ? 'draft'
      : toolsCalled.some(t => t.tool_name === 'generate_developer_report') ? 'report'
        : toolsCalled.some(t => t.tool_name === 'create_task') ? 'task_created'
          : 'answer';

  await supabase.from('intelligence_interactions').insert({
    tenant_id: tenantId,
    user_id: userId,
    user_role: 'agent',
    skin: skinTag,
    query_text: queryText,
    tools_called: toolsCalled,
    response_text: responseText.slice(0, 10000),
    response_type: responseType,
    model_used: 'gpt-4o-mini',
    latency_ms: latencyMs,
  });

  // Log knowledge gap if detected
  if (isKnowledgeGap) {
    await supabase.from('intelligence_knowledge_gaps').insert({
      tenant_id: tenantId,
      query_text: queryText,
      skin: skinTag,
      user_role: 'agent',
      context: { tools_called: toolsCalled.map(t => t.tool_name) },
    });
  }
}

/**
 * Build context about independent agent's listings, enquiries, and follow-ups
 * to inject into the system prompt.
 */
async function buildIndependentAgentContext(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  agentId: string
): Promise<string> {
  const [listingsResult, enquiriesResult, followUpsResult] = await Promise.all([
    supabase
      .from('listings')
      .select('id, address, property_type, bedrooms, asking_price, status, listed_date, vendor_name, vendor_solicitor_name, buyer_name, buyer_solicitor_name, contracts_issued_at, sale_agreed_at')
      .eq('agent_id', agentId)
      .in('status', ['active', 'sale_agreed'])
      .order('listed_date', { ascending: false }),
    supabase
      .from('enquiries')
      .select('enquirer_name, listing_id, status, received_at, source, message')
      .eq('agent_id', agentId)
      .eq('status', 'new')
      .order('received_at', { ascending: false })
      .limit(10),
    supabase
      .from('enquiries')
      .select('enquirer_name, listing_id, last_contacted_at, next_follow_up_at')
      .eq('agent_id', agentId)
      .lt('next_follow_up_at', new Date().toISOString())
      .neq('status', 'dead')
      .limit(10),
  ]);

  const listings = listingsResult.data || [];
  const enquiries = enquiriesResult.data || [];
  const followUps = followUpsResult.data || [];

  return `
AGENT TYPE: Independent estate agent

ACTIVE LISTINGS (${listings.length}):
${listings.map(l => `
  - ${l.address}
    ${l.bedrooms || '?'} bed ${l.property_type || 'property'} · €${l.asking_price ? Number(l.asking_price).toLocaleString('en-IE') : '?'}
    Status: ${l.status}
    Listed: ${l.listed_date ? new Date(l.listed_date).toLocaleDateString('en-IE') : 'unknown'}
    ${l.sale_agreed_at ? `Sale agreed: ${new Date(l.sale_agreed_at).toLocaleDateString('en-IE')}` : ''}
    ${l.contracts_issued_at ? `Contracts issued: ${new Date(l.contracts_issued_at).toLocaleDateString('en-IE')}` : ''}
    Vendor solicitor: ${l.vendor_solicitor_name ?? 'not recorded'}
    Buyer solicitor: ${l.buyer_solicitor_name ?? 'not yet'}
`).join('')}

NEW ENQUIRIES (${enquiries.length} unactioned):
${enquiries.map(e => `
  - ${e.enquirer_name ?? 'Unknown'} via ${e.source || 'unknown'} about listing ${e.listing_id || 'unknown'}
    "${e.message ?? 'No message'}"
    Received: ${new Date(e.received_at).toLocaleDateString('en-IE')}
`).join('')}

OVERDUE FOLLOW-UPS (${followUps.length}):
${followUps.map(f => `
  - ${f.enquirer_name || 'Unknown'} — last contacted ${f.last_contacted_at ? new Date(f.last_contacted_at).toLocaleDateString('en-IE') : 'never'}
`).join('')}
  `.trim();
}
