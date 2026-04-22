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

          // Emit every agentic-skill envelope. The client listens for this
          // frame to open the approval drawer. Drafts referenced here are
          // already persisted in `pending_drafts` (via persistSkillEnvelope
          // inside the registry adapter) so the drawer's Approve / Edit /
          // Discard calls hit real rows.
          for (const envelope of envelopes) {
            if (!envelope.drafts.length) continue;
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'envelope', envelope }) + '\n')
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

          // Store memory and log interaction (async, non-blocking)
          storeConversationMemory(supabase, agentContext, currentSessionId, message, fullContent, toolsCalled).catch(() => {});
          logInteraction(supabase, tenantId, authUserId, message, fullContent, toolsCalled, startTime).catch(() => {});

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
  startTime: number
) {
  const latencyMs = Date.now() - startTime;

  // Detect knowledge gaps (responses indicating missing data)
  const isKnowledgeGap = responseText.toLowerCase().includes('i don\'t have that data') ||
    responseText.toLowerCase().includes('not in the system') ||
    responseText.toLowerCase().includes('no data available');

  await supabase.from('intelligence_interactions').insert({
    tenant_id: tenantId,
    user_id: userId,
    user_role: 'agent',
    skin: 'agent',
    query_text: queryText,
    tools_called: toolsCalled,
    response_text: responseText.slice(0, 10000),
    response_type: toolsCalled.some(t => t.tool_name === 'draft_message') ? 'draft'
      : toolsCalled.some(t => t.tool_name === 'generate_developer_report') ? 'report'
      : toolsCalled.some(t => t.tool_name === 'create_task') ? 'task_created'
      : 'answer',
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
