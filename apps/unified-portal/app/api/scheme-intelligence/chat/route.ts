import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAdminContextFromSession, enforceTenantScope } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { FUNCTION_REGISTRY, getSchemeSummary } from '@/lib/scheme-intelligence/functions';
import { routeQuery } from '@/lib/scheme-intelligence/router';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are the Scheme Intelligence assistant for OpenHouse AI — a B2B platform for Irish property developers.

You help developers understand their scheme data, uploaded documents, unit specifications, and Irish building regulations.

RULES:
- Be concise and professional. Developers are busy.
- Always cite your sources using [Source: function_name] or [Source: document_title] format.
- When presenting numbers, use proper formatting (€, %, commas).
- For regulatory/compliance answers, be careful and always recommend verification with the assigned certifier or solicitor.
- Never make up data. If you don't have the information, say so.
- Use bullet points and structured formatting for clarity.
- When presenting data with multiple items, use tables or lists.

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
    const { message, developmentId, history } = body;

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseAdmin();

    // 1. Get scheme context
    const schemeContext = await getSchemeSummary(supabase, tenantId, developmentId);

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
      const results = await Promise.all(
        route.functions.map(async (fnName) => {
          const fn = FUNCTION_REGISTRY[fnName];
          if (!fn) return null;
          try {
            const result = await fn(supabase, tenantId, developmentId);
            sources.push({
              title: fnName,
              type: 'function',
              excerpt: result.summary,
            });
            if (result.chartData && !chartData) {
              chartData = result.chartData;
            }
            return { name: fnName, ...result };
          } catch (err) {
            console.error(`[SchemeIntel] Function ${fnName} failed:`, err);
            return null;
          }
        })
      );

      const validResults = results.filter(Boolean);
      dataResults = validResults
        .map((r: any) => `[${r.name}]: ${r.summary}\nData: ${JSON.stringify(r.data)}`)
        .join('\n\n');
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
      } catch (ragErr) {
        console.error('[SchemeIntel] RAG search failed:', ragErr);
      }
    }

    // Briefing redirect
    if (route.layers.includes('briefing')) {
      dataResults = 'The user is requesting a daily briefing. Summarise the scheme context data into a structured briefing with priority items.';
    }

    // Build system prompt
    const systemPrompt = SYSTEM_PROMPT
      .replace('{{SCHEME_CONTEXT}}', schemeContext.summary)
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
      max_tokens: 2000,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
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

          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'done' }) + '\n')
          );
          controller.close();
        } catch (err) {
          console.error('[SchemeIntel] Stream error:', err);
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
    console.error('[SchemeIntel Chat] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
