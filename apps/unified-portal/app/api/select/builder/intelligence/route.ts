/**
 * POST /api/select/builder/intelligence
 *
 * Builder AI assistant with RAG retrieval.
 * Scoped to builder's projects and documents.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── Rate limit ───────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// ─── Clients ──────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(params: {
  builderName: string;
  projectAddress?: string;
  projectContext?: string;
}): string {
  const { builderName, projectAddress, projectContext } = params;

  const projectLine = projectAddress
    ? `The current project in focus is ${projectAddress}.`
    : '';

  return `You are the intelligence assistant for ${builderName}'s OpenHouse Select builder dashboard.

You have access to documents, project data, snag records, and compliance information for ${builderName}'s current and completed projects. When information is available in the reference data, use it. Be specific — cite document names, dates, certificate numbers where relevant.

${projectLine}

${projectContext || ''}

BEHAVIOUR

- Answer immediately. No preamble, no "great question", no "I'd be happy to help".
- Never start a response with "I".
- Lead with the most useful information. Context and caveats come after.
- If asked to search across multiple projects, do so and summarise clearly.
- If you don't have the information: say so briefly and tell the builder where to find it or who to contact.
- Plain text only. No markdown symbols, no asterisks, no hashes. Use line breaks and dashes for structure.
- Never role-reverse — you are the assistant. You never ask the builder what they want to do. You answer and, if relevant, suggest the logical next step.

SCOPE

You know this builder's:
- Active and completed projects (addresses, homeowner names, build stages, handover dates)
- All documents uploaded to their Smart Archive
- Snag records across all projects
- Selection sign-off history
- Milestone completion history

You do not have access to financial data or external systems.

EXAMPLES OF GOOD RESPONSES

Query: "What BER certs are outstanding?"
Response: "BER cert not yet uploaded for 14 Innishmore Rise (target handover 15 Aug). 7 Harbour View Road and 3 Ferndale Close both have certs on file."

Query: "When did we finish the roof on Harbour View?"
Response: "Roof stage completed 14 January. Took 11 days from start."

Query: "Show me any snags older than 2 weeks"
Response: "Two open snags older than 2 weeks — cracked tile in 14 Innishmore Rise master en suite (22 days open, urgent) and fascia gap on 7 Harbour View external finish (16 days open, medium)."`;
}

// ─── RAG retrieval ────────────────────────────────────────────────────────────
async function retrieveContext(query: string): Promise<string> {
  try {
    const openai = getOpenAI();
    const supabase = getSupabase();

    const embRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const embedding = embRes.data[0].embedding;

    const { data, error } = await supabase.rpc('match_document_sections', {
      query_embedding: embedding,
      match_count: 10,
    });

    if (error || !data?.length) return '';

    const TOP_N = 6;
    const MIN_SIMILARITY = 0.70;

    const chunks = (data as any[])
      .filter((c: any) => (c.similarity ?? 0) >= MIN_SIMILARITY)
      .slice(0, TOP_N)
      .map((c: any) => c.content)
      .join('\n\n');

    if (!chunks) return '';
    return `\n--- BEGIN REFERENCE DATA ---\n${chunks}\n--- END REFERENCE DATA ---`;
  } catch (err) {
    console.error('[Builder Intelligence] RAG retrieval failed:', err);
    return '';
  }
}

// ─── Fetch builder project context ────────────────────────────────────────────
async function fetchProjectContext(builderId: string, projectId?: string): Promise<string> {
  const supabase = getSupabase();
  const lines: string[] = [];

  // Fetch all builder projects
  const { data: projects } = await supabase
    .from('select_builder_projects')
    .select('id, address, build_stage, target_handover_date, homeowner_name, status')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  if (projects && projects.length > 0) {
    lines.push('CURRENT PROJECTS:');
    for (const p of projects) {
      lines.push(`- ${p.address} | Stage: ${p.build_stage} | Homeowner: ${p.homeowner_name || 'N/A'} | Status: ${p.status} | Target handover: ${p.target_handover_date || 'Not set'}`);
    }
  }

  // Fetch snags across all projects
  const projectIds = projects?.map((p) => p.id) || [];
  if (projectIds.length > 0) {
    const { data: snags } = await supabase
      .from('select_project_snags')
      .select('id, title, severity, status, category, project_id, created_at')
      .in('project_id', projectIds)
      .in('status', ['open', 'in_progress']);

    if (snags && snags.length > 0) {
      lines.push('\nOPEN SNAGS:');
      for (const s of snags) {
        const proj = projects?.find((p) => p.id === s.project_id);
        const daysOpen = Math.floor((Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24));
        lines.push(`- ${s.title} | ${proj?.address || 'Unknown'} | ${s.severity} | ${s.category} | ${daysOpen} days open`);
      }
    }

    // Fetch document categories present
    const { data: docs } = await supabase
      .from('select_project_documents')
      .select('name, category, project_id, created_at')
      .in('project_id', projectIds);

    if (docs && docs.length > 0) {
      lines.push('\nDOCUMENTS ON FILE:');
      for (const d of docs) {
        const proj = projects?.find((p) => p.id === d.project_id);
        lines.push(`- ${d.name} | ${d.category} | ${proj?.address || 'Unknown'} | Uploaded ${new Date(d.created_at).toLocaleDateString('en-IE')}`);
      }
    }

    // Fetch selection statuses
    const { data: selections } = await supabase
      .from('select_project_selections')
      .select('item_name, category, status, project_id')
      .in('project_id', projectIds);

    if (selections && selections.length > 0) {
      lines.push('\nSELECTIONS:');
      for (const s of selections) {
        const proj = projects?.find((p) => p.id === s.project_id);
        lines.push(`- ${s.item_name} | ${s.category} | ${s.status} | ${proj?.address || 'Unknown'}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages: history = [],
      project_id,
      builder_id,
      builder_name,
      project_address,
    } = body;

    if (!builder_id || !builder_name) {
      return NextResponse.json(
        { error: 'builder_id and builder_name required' },
        { status: 400 }
      );
    }

    if (!checkRateLimit(builder_id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before sending another message.' },
        { status: 429 }
      );
    }

    const latestUserMessage = [...history].reverse().find((m: any) => m.role === 'user');
    const userText: string = latestUserMessage?.content ?? '';

    if (!userText.trim()) {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    // Fetch project context and RAG in parallel
    const [projectContext, ragContext] = await Promise.all([
      fetchProjectContext(builder_id, project_id),
      retrieveContext(userText),
    ]);

    const basePrompt = buildSystemPrompt({
      builderName: builder_name,
      projectAddress: project_address,
      projectContext,
    });
    const systemPrompt = ragContext ? `${basePrompt}${ragContext}` : basePrompt;

    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
        })),
    ];

    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: openaiMessages,
      temperature: 0.4,
      max_tokens: 1000,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const token = chunk.choices[0]?.delta?.content || '';
          if (token) {
            controller.enqueue(encoder.encode(token));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[Builder Intelligence] Error:', err);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
