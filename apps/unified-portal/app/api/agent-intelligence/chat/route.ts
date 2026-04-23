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
import { buildAgentSystemPrompt, buildLiveContext, type LiveContextBlocks } from '@/lib/agent-intelligence/system-prompt';
import { getToolDefinitionsForOpenAI, getToolByName } from '@/lib/agent-intelligence/tools/registry';
import type { AgentContext } from '@/lib/agent-intelligence/types';
import { isAgenticSkillEnvelope, type AgenticSkillEnvelope } from '@/lib/agent-intelligence/envelope';
import { captureInferredAlias } from '@/lib/agent-intelligence/scheme-resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, history, sessionId, activeDevelopmentId } = body;

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

    // Single source of truth: resolves `auth.uid()` → `agent_profiles.id` →
    // `agent_scheme_assignments.development_id[]` in one place, with the
    // correct identifier chain. Every tool downstream receives the result
    // via the threaded `AgentContext` and MUST NOT re-run auth.
    const resolved = await resolveAgentContext(supabase, user?.id ?? null, {
      activeDevelopmentId: activeDevelopmentId ?? null,
    });

    if (!resolved) {
      return new Response(JSON.stringify({ error: 'No agent profile found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tenantId: string = resolved.tenantId ?? '';
    const authUserId: string = resolved.authUserId;

    const agentContext: AgentContext = {
      agentId: resolved.agentProfileId,
      userId: authUserId,
      tenantId,
      displayName: resolved.displayName,
      agencyName: resolved.agencyName,
      agentType: resolved.agentType,
      assignedSchemes: resolved.assignedSchemes,
      assignedDevelopmentIds: resolved.assignedDevelopmentIds,
      assignedDevelopmentNames: resolved.assignedDevelopmentNames,
      activeDevelopmentId: activeDevelopmentId ?? null,
    };

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
      agentContext.agentId
        ? loadEntityMemory(supabase, agentContext.agentId, message).catch(() => '')
        : Promise.resolve(''),
      agentContext.agentId
        ? getViewingsSummary(supabase, agentContext).catch(() => '')
        : Promise.resolve(''),
      agentContext.agentId
        ? getAgentProfileExtras(supabase, agentContext.agentId).catch(() => null)
        : Promise.resolve(null),
      getAgedContracts(supabase, tenantId, agentContext, 42).catch(() => []),
      getSalesPipelineSummary(supabase, tenantId, agentContext).catch(() => null),
      agentContext.agentId
        ? getLettingsSummary(supabase, agentContext.agentId).catch(() => null)
        : Promise.resolve(null),
      agentContext.agentId
        ? getRenewalWindow(supabase, agentContext.agentId).catch(() => [])
        : Promise.resolve([]),
      agentContext.agentId
        ? getRentArrears(supabase, agentContext.agentId).catch(() => [])
        : Promise.resolve([]),
      agentContext.agentId
        ? getTodaysViewings(supabase, agentContext.agentId).catch(() => [])
        : Promise.resolve([]),
      agentContext.agentId
        ? getUpcomingWeekViewings(supabase, agentContext.agentId).catch(() => [])
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
    const liveContext = buildLiveContext(liveContextBlocks);

    // 2b. Load independent agent context if applicable
    let independentContext = '';
    const agentType = agentContext.agentType ?? 'scheme';
    if (agentType !== 'scheme') {
      independentContext = await buildIndependentAgentContext(supabase, agentContext.agentId);
    }

    // 3. Build system prompt
    const systemPrompt = buildAgentSystemPrompt(
      agentContext,
      recentActivity,
      upcomingDeadlines,
      entityMemory,
      '', // RAG results injected after tool calls if needed
      independentContext,
      viewingsSummary,
      liveContext,
    );

    // 4. Build message history
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ];

    if (history?.length) {
      for (const msg of history.slice(-10)) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    messages.push({ role: 'user', content: message });

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
        try {
          // Send tool call metadata first so the UI knows tools were used
          if (toolsCalled.length > 0) {
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

          // Stream the final LLM response
          let fullContent = '';
          const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            tools: undefined, // No tools on final streaming call
            temperature: 0.3,
            max_tokens: 4000,
            stream: true,
          });

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
              userId: agentContext.userId,
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
          }).catch(() => {});

          // Generate follow-up suggestions (non-blocking, appended after main response)
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
- Start each suggestion with a verb: "Draft...", "Check...", "Show...", "Create...", "Generate...", "Log..."
- Never ask the agent a clarifying question. Never use "Would you like..." or "Should I..."
- Keep each suggestion under 8 words.
- Make suggestions contextual to what was just discussed.
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
      agent_id: agentContext.agentId,
      tenant_id: agentContext.tenantId,
      session_id: sessionId,
      role: 'user',
      content: userMessage,
      entities_mentioned: entities,
    },
    {
      agent_id: agentContext.agentId,
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
  flags: { hallucinatedDrafts?: boolean } = {}
) {
  const latencyMs = Date.now() - startTime;

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
    skin: 'agent',
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
      skin: 'agent',
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
