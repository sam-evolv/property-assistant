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

    // 3. Build system prompt
    const systemPrompt = buildAgentSystemPrompt(
      agentContext,
      recentActivity,
      upcomingDeadlines,
      entityMemory,
      '' // RAG results injected after tool calls if needed
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
              result_data: result.data,
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

    // 9. Strip markdown from response (plain text for mobile display)
    const cleanResponse = responseText
      .replace(/#{1,6}\s/g, '')           // strip heading markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // strip bold **text**
      .replace(/\*([^*]+)\*/g, '$1')      // strip italic *text*
      .replace(/__([^_]+)__/g, '$1')      // strip bold __text__
      .replace(/_([^_]+)_/g, '$1')        // strip italic _text_
      .replace(/`([^`]+)`/g, '$1')        // strip inline code
      .replace(/```[\s\S]*?```/g, '')     // strip code blocks
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // strip links, keep text

    // 10. Stream the response word-by-word for natural text flow
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Stream words with small delays for natural appearance
          const words = cleanResponse.split(/(\s+)/); // split keeping whitespace
          for (let i = 0; i < words.length; i++) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'token', content: words[i] }) + '\n')
            );
            // Small delay between word groups for natural flow
            if (i % 3 === 2 && i < words.length - 1) {
              await new Promise(r => setTimeout(r, 20));
            }
          }

          // Send tool call metadata
          if (toolsCalled.length > 0) {
            controller.enqueue(
              encoder.encode(JSON.stringify({
                type: 'tools_used',
                tools: toolsCalled.map(t => ({
                  name: t.tool_name,
                  summary: t.result_summary,
                  ...(t.result_data?.draft ? { draft: t.result_data.draft } : {}),
                })),
              }) + '\n')
            );
          }

          // Generate follow-up ACTION suggestions (not questions)
          try {
            const followUpCompletion = await openai.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are suggesting the next thing a busy Irish estate agent would want to do. Return ONLY a JSON array of 2-3 short action strings (max 7 words each). These are buttons the agent taps — so they must be commands, not questions. Sound like a colleague suggesting the obvious next step. GOOD: "Draft chase emails for those 5", "Show me the Riverside pipeline", "Log that call", "Set a reminder for Monday". BAD: "Would you like more details?", "Get help with something else", "Learn more about this topic". Never start with Would/Do/Can/Should.',
                },
                {
                  role: 'user',
                  content: `Agent asked: ${message}\n\nAssistant replied: ${cleanResponse.slice(0, 500)}`,
                },
              ],
              temperature: 0.5,
              max_tokens: 150,
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
