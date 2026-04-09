import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAdminContextFromSession, enforceTenantScope } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { loadAgentContext, getRecentActivitySummary, getUpcomingDeadlines, loadEntityMemory } from '@/lib/agent-intelligence/context';
import { buildAgentSystemPrompt } from '@/lib/agent-intelligence/system-prompt';
import { getToolDefinitionsForOpenAI, getToolByName } from '@/lib/agent-intelligence/tools/registry';
import type { AgentContext } from '@/lib/agent-intelligence/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tenantId = enforceTenantScope(adminContext);
    const body = await request.json();
    const { message, history, sessionId, activeDevelopmentId } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. Resolve the auth.users ID
    // adminContext.id is the admins table PK, NOT auth.users.id.
    // agent_profiles.user_id references auth.users(id), so we need the real auth UID.
    let authUserId = adminContext.id; // fallback
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers();
      const matchedUser = usersData?.users?.find((u: any) => u.email === adminContext.email);
      if (matchedUser?.id) authUserId = matchedUser.id;
    } catch (err) {
      console.error('[AgentIntel] Failed to resolve auth user ID, using admin ID as fallback:', err);
    }

    // 2. Load agent context (profile + assigned schemes)
    let agentContext = await loadAgentContext(supabase, authUserId, tenantId);

    // If no agent profile exists yet, create a minimal context
    if (!agentContext) {
      agentContext = {
        agentId: authUserId,
        userId: authUserId,
        tenantId,
        displayName: adminContext.email.split('@')[0],
        assignedSchemes: [],
      };

      // If an active development is provided, include it
      if (activeDevelopmentId) {
        const { data: dev } = await supabase
          .from('developments')
          .select('id, name')
          .eq('id', activeDevelopmentId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (dev) {
          const { count } = await supabase
            .from('units')
            .select('id', { count: 'exact', head: true })
            .eq('development_id', dev.id)
            .eq('tenant_id', tenantId);

          agentContext.assignedSchemes = [{
            developmentId: dev.id,
            schemeName: dev.name,
            unitCount: count || 0,
          }];
        }
      }
    }

    // 2. Build context components in parallel
    const [recentActivity, upcomingDeadlines, entityMemory] = await Promise.all([
      getRecentActivitySummary(supabase, tenantId, agentContext).catch(() => ''),
      getUpcomingDeadlines(supabase, tenantId, agentContext).catch(() => ''),
      agentContext.agentId
        ? loadEntityMemory(supabase, agentContext.agentId, message).catch(() => '')
        : Promise.resolve(''),
    ]);

    // 2b. Load independent agent context if applicable
    let independentContext = '';
    const agentType = await getAgentType(supabase, agentContext.agentId);
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

    // 5. Call LLM with tool definitions
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const tools = getToolDefinitionsForOpenAI();

    let completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 4000,
    });

    let responseMessage = completion.choices[0]?.message;
    const toolsCalled: Array<{ tool_name: string; params: any; result_summary: string }> = [];

    // 6. Execute tool calls (up to 3 rounds of tool calling)
    let rounds = 0;
    while (responseMessage?.tool_calls?.length && rounds < 3) {
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
          } catch (err: any) {
            console.error(`[AgentIntel] Tool ${toolCall.function.name} failed:`, err);
            toolResult = JSON.stringify({ error: err.message, summary: `Tool execution failed: ${err.message}` });
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

      // Call LLM again with tool results
      completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 4000,
      });

      responseMessage = completion.choices[0]?.message;
    }

    const responseText = responseMessage?.content || 'I wasn\'t able to generate a response. Please try again.';

    // 7. Store conversation memory (async, non-blocking)
    const currentSessionId = sessionId || `session_${Date.now()}`;
    storeConversationMemory(supabase, agentContext, currentSessionId, message, responseText, toolsCalled).catch(
      (err) => console.error('[AgentIntel] Failed to store conversation memory:', err)
    );

    // 8. Log intelligence interaction (async, non-blocking)
    logInteraction(supabase, tenantId, authUserId, message, responseText, toolsCalled, startTime).catch(
      (err) => console.error('[AgentIntel] Failed to log interaction:', err)
    );

    // 9. Stream the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send the full response as tokens (for consistency with existing pattern)
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'token', content: responseText }) + '\n')
          );

          // Send tool call metadata
          if (toolsCalled.length > 0) {
            controller.enqueue(
              encoder.encode(JSON.stringify({
                type: 'tools_used',
                tools: toolsCalled.map(t => ({ name: t.tool_name, summary: t.result_summary })),
              }) + '\n')
            );
          }

          // Generate follow-up suggestions
          try {
            const toolNames = toolsCalled.map(t => t.tool_name).join(', ');
            const followUpCompletion = await openai.chat.completions.create({
              model: 'gpt-4.1-mini',
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
- Return ONLY a JSON array of strings, no explanation.

EXAMPLES by context:
- After a unit/buyer lookup: ["Draft a follow-up email to the buyer", "Check outstanding items in this scheme", "Log a communication for this unit"]
- After drafting an email: ["Check what else is due this week", "Create a follow-up task", "Draft the next outstanding email"]
- After a scheme overview: ["Show me the overdue items", "Generate the developer report", "Which units need attention first?"]
- After creating a task: ["Show my task list", "What else is outstanding?", "Draft a reminder for the buyer"]`,
                },
                {
                  role: 'user',
                  content: `Agent asked: ${message}\n\nTools used: ${toolNames || 'none'}\n\nAssistant replied: ${responseText.slice(0, 500)}`,
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
          console.error('[AgentIntel] Stream error:', err);
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
    console.error('[AgentIntel Chat] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
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
    model_used: 'gpt-4.1-mini',
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
 * Get agent_type from agent_profiles table.
 */
async function getAgentType(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  agentId: string
): Promise<string> {
  const { data } = await supabase
    .from('agent_profiles')
    .select('agent_type')
    .eq('id', agentId)
    .maybeSingle();
  return data?.agent_type || 'scheme';
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
