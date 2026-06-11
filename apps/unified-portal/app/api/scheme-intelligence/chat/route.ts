import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminContextFromSession, enforceTenantScope } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { FUNCTION_REGISTRY, getSchemeSummary } from '@/lib/scheme-intelligence/functions';
import { routeQuery } from '@/lib/scheme-intelligence/router';
import {
  buildToolDefinitions,
  executeDataTool,
  searchDocuments,
  actionsForTools,
  SEARCH_DOCUMENTS_TOOL,
} from '@/lib/scheme-intelligence/tools';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are the OpenHouse Intelligence assistant for OpenHouse AI — a B2B platform for Irish property developers.

You help developers understand their scheme data, uploaded documents, unit specifications, and Irish building regulations.

RULES:
- Be concise and professional. Developers are busy.
- Never make up data. If you don't have the information, say so clearly.
- Format numbers with proper Irish conventions (€, %, commas).
- Use markdown tables (| col | col |) for any multi-row comparisons or data breakdowns.
- Use bullet points (- item) for lists.
- Use ## for section headings.
- Use **bold** for key figures, names, and important terms.
- For regulatory/compliance answers, always recommend verification with the assigned certifier or solicitor.
- Keep responses focused. Lead with the direct answer, then supporting detail.

SCHEME CONTEXT:
{{SCHEME_CONTEXT}}

DATA RESULTS:
{{DATA_RESULTS}}

DOCUMENT RESULTS:
{{DOCUMENT_RESULTS}}`;

export async function POST(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!['developer', 'admin', 'super_admin'].includes(adminContext.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const tenantId = enforceTenantScope(adminContext);
    const body = await request.json();
    const { message, developmentId, history, compareWithDevelopmentId } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Agentic loop is the default; SCHEME_INTELLIGENCE_CLASSIC=1 reverts to
    // the classifier path. Comparison mode stays on the classic path (its
    // side-by-side prompt assembly is purpose-built).
    if (process.env.SCHEME_INTELLIGENCE_CLASSIC !== '1' && !compareWithDevelopmentId) {
      return runAgenticChat({ supabase, tenantId, developmentId, message, history });
    }

    // 1. Get scheme context (+ comparison scheme in parallel if requested)
    const contextPromises: Promise<any>[] = [
      getSchemeSummary(supabase, tenantId, developmentId),
    ];
    if (compareWithDevelopmentId) {
      contextPromises.push(getSchemeSummary(supabase, tenantId, compareWithDevelopmentId));
    }
    const [schemeContext, compareContext] = await Promise.all(contextPromises);

    // 2. Route query
    const route = await routeQuery(message, schemeContext.data);

    // 3. Execute layer queries in parallel
    let dataResults = '';
    let documentResults = '';
    let chartData: any = null;
    const sources: Array<{ title: string; type: string; excerpt: string }> = [];
    const actions: Array<{ label: string; href: string }> = [];

    // Layer 1: Live data
    if (route.layers.includes('layer1') && route.functions?.length) {
      const runFunctionsForScheme = async (devId: string | undefined, label: string) => {
        const results = await Promise.all(
          route.functions!.map(async (fnName) => {
            const fn = FUNCTION_REGISTRY[fnName];
            if (!fn) return null;
            try {
              const result = await fn(supabase, tenantId, devId);
              return { name: fnName, ...result };
            } catch (err) {
              return null;
            }
          })
        );
        return results.filter(Boolean);
      };

      // Run for primary scheme
      const primaryResults = await runFunctionsForScheme(developmentId, 'primary');

      for (const r of primaryResults) {
        if (r) {
          sources.push({ title: r.name, type: 'function', excerpt: r.summary });
          if (r.chartData && !chartData) chartData = r.chartData;
        }
      }

      if (compareWithDevelopmentId) {
        // Run same functions for comparison scheme in parallel
        const compareResults = await runFunctionsForScheme(compareWithDevelopmentId, 'comparison');

        const primaryData = primaryResults
          .map((r: any) => `[${r.name} — ${schemeContext.data?.schemeName || 'Primary'}]: ${r.summary}\nData: ${JSON.stringify(r.data)}`)
          .join('\n\n');

        const compareData = compareResults
          .map((r: any) => `[${r.name} — ${compareContext?.data?.schemeName || 'Comparison'}]: ${r.summary}\nData: ${JSON.stringify(r.data)}`)
          .join('\n\n');

        dataResults = `== PRIMARY SCHEME: ${schemeContext.data?.schemeName || 'Primary'} ==\n${primaryData}\n\n== COMPARISON SCHEME: ${compareContext?.data?.schemeName || 'Comparison'} ==\n${compareData}`;
      } else {
        dataResults = primaryResults
          .map((r: any) => `[${r.name}]: ${r.summary}\nData: ${JSON.stringify(r.data)}`)
          .join('\n\n');
      }
    }

    // Layer 2/3/4: RAG document search
    if ((route.layers.includes('layer2') || route.layers.includes('layer3') || route.layers.includes('layer4')) && route.ragQuery) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: route.ragQuery,
        });
        const queryEmbedding = embeddingResponse.data[0].embedding;

        // Determine which project to search: '00000000-0000-0000-0000-000000000001' for Layer 4, else scheme docs
        const matchProjectId = route.layers.includes('layer4')
          ? '00000000-0000-0000-0000-000000000001'
          : (developmentId || tenantId);

        const { data: chunks, error: ragError } = await supabase.rpc('match_document_sections', {
          query_embedding: queryEmbedding,
          match_project_id: matchProjectId,
          match_count: 8,
        });

        if (!ragError && chunks?.length) {
          documentResults = chunks
            .map((c: any) => `[Document: ${c.metadata?.title || c.metadata?.file_name || 'Unknown'}]\n${c.content}`)
            .join('\n\n---\n\n');

          for (const chunk of chunks) {
            sources.push({
              title: chunk.metadata?.title || chunk.metadata?.file_name || 'Document',
              type: route.layers.includes('layer4') ? 'regulatory' : 'document',
              excerpt: (chunk.content || '').slice(0, 200),
            });
          }
        }
      } catch (_ragErr) {
          // error handled silently
      }
    }

    // Briefing redirect
    if (route.layers.includes('briefing')) {
      dataResults = 'The user is requesting a daily briefing. Summarise the scheme context data into a structured briefing with priority items.';
    }

    // Smart contextual actions based on route
    if (route.functions?.includes('getHandoverPipeline') || route.functions?.includes('getStagePaymentStatus')) {
      const devPath = developmentId ? `/developer/pipeline/${developmentId}` : '/developer/pipeline';
      actions.push({ label: 'View Sales Pipeline', href: devPath });
    }
    if (route.functions?.includes('getDocumentCoverage') || route.layers.includes('layer2')) {
      actions.push({ label: 'View Smart Archive', href: '/developer/smart-archive' });
    }
    if (route.functions?.includes('getHomeownerActivity') || route.functions?.includes('getMostAskedQuestions')) {
      actions.push({ label: 'View Homeowners', href: '/developer/homeowners' });
    }
    if (route.functions?.includes('getKitchenSelections')) {
      actions.push({ label: 'View Kitchen Selections', href: '/developer/kitchen-selections' });
    }
    if (route.functions?.includes('getOutstandingSnags')) {
      actions.push({ label: 'View Snagging', href: '/developer/snagging' });
    }
    if (route.layers.includes('layer4')) {
      actions.push({ label: 'View Compliance', href: '/developer/compliance' });
    }

    // Build system prompt
    let fullSchemeContext = schemeContext.summary;
    if (compareWithDevelopmentId && compareContext) {
      fullSchemeContext += `\n\nCOMPARISON SCHEME CONTEXT:\n${compareContext.summary}\n\nIMPORTANT: The user is comparing two schemes. Present data side-by-side in markdown tables where applicable. Clearly label which data belongs to which scheme.`;
    }

    const systemPrompt = SYSTEM_PROMPT
      .replace('{{SCHEME_CONTEXT}}', fullSchemeContext)
      .replace('{{DATA_RESULTS}}', dataResults || 'No specific data queried.')
      .replace('{{DOCUMENT_RESULTS}}', documentResults || 'No documents matched.');

    // Build message history
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

    // Stream response
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages,
      temperature: 0.3,
      max_tokens: 4000,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: 'token', content }) + '\n')
              );
            }
          }

          // Send metadata after stream completes
          if (sources.length > 0) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'sources', sources }) + '\n')
            );
          }

          if (chartData) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'chart', chartData }) + '\n')
            );
          }

          if (actions.length > 0) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'actions', actions }) + '\n')
            );
          }

          if (route.isRegulatory) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'regulatory_disclaimer', show: true }) + '\n')
            );
          }

          // Generate follow-up question suggestions
          try {
            const followUpCompletion = await openai.chat.completions.create({
              model: 'gpt-4.1-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are helping a property developer. Based on this conversation, suggest 2-3 short follow-up questions they might ask next. Return ONLY a JSON array of strings, no explanation. Max 10 words per question.',
                },
                {
                  role: 'user',
                  content: `User asked: ${message}\n\nAssistant replied: ${fullResponse}`,
                },
              ],
              temperature: 0.7,
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
            encoder.encode(JSON.stringify({ type: 'done' }) + '\n')
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

// ============================================================================
// Agentic chat — the assistant decides which live data to pull and can chain
// tool calls (Phase 6 of docs/NORTH_STAR.md). Streams the exact same NDJSON
// frame protocol as the classic path, so the UI is unchanged.
// ============================================================================

const AGENTIC_SYSTEM_PROMPT = `You are the OpenHouse Intelligence assistant for OpenHouse AI — a B2B platform for Irish property developers.

You help developers understand their scheme data, uploaded documents, unit specifications, and Irish building regulations.

You have live tools over the developer's real data. Decide which tools you need — several if useful — call them, then answer from their results.

RULES:
- Be concise and professional. Developers are busy.
- Never make up data. If the tools don't return it, say so clearly.
- Format numbers with proper Irish conventions (€, %, commas).
- Use markdown tables (| col | col |) for any multi-row comparisons or data breakdowns.
- Use bullet points (- item) for lists.
- Use ## for section headings.
- Use **bold** for key figures, names, and important terms.
- For regulatory/compliance answers, search the regulations and always recommend verification with the assigned certifier or solicitor.
- Keep responses focused. Lead with the direct answer, then supporting detail.

SCHEME CONTEXT:
{{SCHEME_CONTEXT}}`;

const MAX_TOOL_ROUNDS = 3;
const TOOL_RESULT_CHAR_CAP = 6000;

function runAgenticChat(params: {
  supabase: SupabaseClient;
  tenantId: string;
  developmentId?: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
}): Response {
  const { supabase, tenantId, developmentId, message, history } = params;
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const emit = (frame: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(frame) + '\n'));
      };

      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const schemeContext = await getSchemeSummary(supabase, tenantId, developmentId);

        const messages: OpenAI.ChatCompletionMessageParam[] = [
          {
            role: 'system',
            content: AGENTIC_SYSTEM_PROMPT.replace(
              '{{SCHEME_CONTEXT}}',
              schemeContext.summary || 'No scheme selected.',
            ),
          },
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

        const tools = buildToolDefinitions();
        const sources: Array<{ title: string; type: string; excerpt: string }> = [];
        const toolsUsed = new Set<string>();
        let chartData: unknown = null;
        let regulatoryUsed = false;
        let finalContent = '';

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          const completion = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages,
            temperature: 0.3,
            max_tokens: 4000,
            tools,
            // The last round must answer, not keep digging.
            tool_choice: round < MAX_TOOL_ROUNDS ? 'auto' : 'none',
          });

          const choice = completion.choices[0]?.message;
          if (!choice) break;

          const toolCalls = choice.tool_calls || [];
          if (toolCalls.length === 0) {
            finalContent = choice.content || '';
            break;
          }

          messages.push(choice);

          for (const call of toolCalls) {
            if (call.type !== 'function') continue;
            const name = call.function.name;
            let resultText = 'Tool unavailable.';

            if (name === SEARCH_DOCUMENTS_TOOL) {
              let args: { query?: string; scope?: string } = {};
              try {
                args = JSON.parse(call.function.arguments || '{}');
              } catch {}
              const scope = args.scope === 'regulations' ? 'regulations' : 'scheme';
              if (scope === 'regulations') regulatoryUsed = true;
              const search = await searchDocuments(supabase, openai, {
                query: args.query || message,
                scope,
                tenantId,
                developmentId,
              });
              sources.push(...search.sources);
              resultText = search.text;
            } else {
              const result = await executeDataTool(supabase, tenantId, developmentId, name);
              if (result) {
                toolsUsed.add(name);
                sources.push({ title: result.name, type: 'function', excerpt: result.summary });
                if (result.chartData && !chartData) chartData = result.chartData;
                resultText = `${result.summary}\nData: ${JSON.stringify(result.data)}`;
              }
            }

            messages.push({
              role: 'tool',
              tool_call_id: call.id,
              content: resultText.slice(0, TOOL_RESULT_CHAR_CAP),
            });
          }
        }

        if (!finalContent) {
          finalContent = 'I could not put an answer together from the data this time — try rephrasing the question.';
        }

        // Stream the answer out in small slices (same frame shape as classic).
        const pieces = finalContent.match(/(\S+\s*){1,4}/g) || [finalContent];
        for (const piece of pieces) {
          emit({ type: 'token', content: piece });
        }

        if (sources.length > 0) emit({ type: 'sources', sources });
        if (chartData) emit({ type: 'chart', chartData });
        const actions = actionsForTools(toolsUsed, developmentId, regulatoryUsed);
        if (actions.length > 0) emit({ type: 'actions', actions });
        if (regulatoryUsed) emit({ type: 'regulatory_disclaimer', show: true });

        try {
          const followUpCompletion = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
              {
                role: 'system',
                content:
                  'You are helping a property developer. Based on this conversation, suggest 2-3 short follow-up questions they might ask next. Return ONLY a JSON array of strings, no explanation. Max 10 words per question.',
              },
              { role: 'user', content: `User asked: ${message}\n\nAssistant replied: ${finalContent}` },
            ],
            temperature: 0.7,
            max_tokens: 200,
          });
          const followUpText = followUpCompletion.choices[0]?.message?.content?.trim();
          if (followUpText) {
            const questions = JSON.parse(followUpText);
            if (Array.isArray(questions) && questions.length > 0) {
              emit({ type: 'followups', questions });
            }
          }
        } catch {
          // Skip follow-ups if generation fails
        }

        emit({ type: 'done' });
        controller.close();
      } catch (err) {
        emit({ type: 'error', message: 'Stream failed' });
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
}
