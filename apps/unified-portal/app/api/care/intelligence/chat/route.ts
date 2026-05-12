/**
 * POST /api/care/intelligence/chat
 *
 * Care Intelligence: the Care skin of the central OpenHouse Intelligence brain.
 * Scoped to the caller's tenant: every tool filters installations and related
 * rows by session.tenantId, never by a hardcoded installer_name. This is the
 * fix for audit finding C022 (hardcoded INSTALLER_NAME literal was the
 * security boundary for the intelligence chat).
 *
 * Streams NDJSON to the client: each event is a single JSON object followed by
 * a newline. Matches the protocol used by scheme-intelligence/chat.
 */

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CareAuthError,
  careAuthErrorToResponse,
  requireCareTenantSession,
} from '@/lib/care/require-care-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── Tools ────────────────────────────────────────────────────────────────────
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_installations',
      description:
        'Search installations by address, customer name, product type, or health status. Returns matching installations with key details.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Free-text match on address, customer name, city, or job reference' },
          system_type: { type: 'string', description: "One of 'solar_pv', 'heat_pump', 'ev_charger', 'battery_storage'" },
          health_status: { type: 'string', description: "One of 'healthy', 'monitoring', 'issue'" },
          limit: { type: 'number', description: 'Max rows to return (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_diagnostics_summary',
      description:
        'Return fault and error patterns grouped by inverter/heat pump model. Use for "most common fault" questions.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Window in days (default 30)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_warranty_status',
      description:
        'List installations whose warranty expires within a window. Supports "expiring this month", "expiring in 90 days", "expired".',
      parameters: {
        type: 'object',
        properties: {
          window: {
            type: 'string',
            description: "One of 'this_month', 'next_90_days', 'q2', 'expired'",
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_support_queue',
      description:
        'Return open escalations and support tickets that need attention. Use for "what needs my attention" questions.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_communications',
      description:
        'Group recent support queries by theme to surface what homeowners are asking about.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Window in days (default 30)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_performance_metrics',
      description:
        'Return solar generation performance for the installer fleet, including average annual yield per kWp and underperformers.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attention_required',
      description:
        'High-level "what needs attention now" view: high-priority tickets, faulted installations, and warranties expiring within 60 days.',
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ── Formatters ──────────────────────────────────────────────────────────────
function fmtAddress(r: Record<string, unknown>): string {
  return [r.address_line_1, r.city, r.county].filter(Boolean).join(', ');
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-IE', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Tool executor ───────────────────────────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  tenantId: string,
): Promise<Record<string, unknown>> {
  switch (name) {
    case 'search_installations': {
      const query = (args.query as string) || '';
      const system_type = args.system_type as string | undefined;
      const health_status = args.health_status as string | undefined;
      const limit = Math.min((args.limit as number) || 20, 50);

      let q = supabase
        .from('installations')
        .select('id, job_reference, customer_name, address_line_1, city, county, system_type, inverter_model, heat_pump_model, system_size_kwp, health_status, install_date, warranty_expiry')
        .eq('tenant_id', tenantId)
        .limit(limit);

      if (system_type) q = q.eq('system_type', system_type);
      if (health_status) q = q.eq('health_status', health_status);
      if (query) {
        const safe = query.replace(/[%,]/g, ' ').trim();
        if (safe) {
          q = q.or(
            `customer_name.ilike.%${safe}%,address_line_1.ilike.%${safe}%,city.ilike.%${safe}%,job_reference.ilike.%${safe}%`
          );
        }
      }

      const { data, error } = await q;
      if (error) return { error: error.message, count: 0, installations: [] };

      const rows = (data || []).map((r) => ({
        job_reference: r.job_reference,
        customer: r.customer_name,
        address: fmtAddress(r as Record<string, unknown>),
        system: r.system_type === 'heat_pump' ? r.heat_pump_model : r.inverter_model,
        size: r.system_size_kwp ? `${r.system_size_kwp} kWp` : null,
        health: r.health_status,
        installed: fmtDate(r.install_date),
        warranty_expires: fmtDate(r.warranty_expiry),
      }));

      return { count: rows.length, installations: rows };
    }

    case 'get_diagnostics_summary': {
      const days = (args.days as number) || 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const { data: queries } = await supabase
        .from('support_queries')
        .select('query_text, query_category, escalated, resolved, created_at, installations!inner(tenant_id, inverter_model, heat_pump_model, system_type)')
        .eq('installations.tenant_id', tenantId)
        .gte('created_at', since);

      const scoped = (queries || []) as any[];

      const faultCounts = new Map<string, { model: string; fault: string; count: number; escalated: number }>();
      for (const q of scoped) {
        if (q.query_category !== 'fault_code' && q.query_category !== 'performance') continue;
        const text = (q.query_text as string) || '';
        const model = q.installations?.inverter_model || q.installations?.heat_pump_model || 'Unknown';
        const errMatch = text.match(/error\s+(\d{2,4})/i) || text.match(/\b([EFef]\d{1,3})\b/);
        const fault = errMatch ? `error ${errMatch[1]}` : 'unspecified fault';
        const key = `${model}||${fault}`;
        const existing = faultCounts.get(key) || { model, fault, count: 0, escalated: 0 };
        existing.count += 1;
        if (q.escalated) existing.escalated += 1;
        faultCounts.set(key, existing);
      }

      const top = Array.from(faultCounts.values()).sort((a, b) => b.count - a.count).slice(0, 10);
      return {
        window_days: days,
        total_fault_queries: scoped.length,
        top_faults: top,
      };
    }

    case 'get_warranty_status': {
      const window = (args.window as string) || 'this_month';
      const now = new Date();
      let from: string;
      let to: string;

      if (window === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        from = start.toISOString().slice(0, 10);
        to = end.toISOString().slice(0, 10);
      } else if (window === 'q2') {
        from = `${now.getFullYear()}-04-01`;
        to = `${now.getFullYear()}-06-30`;
      } else if (window === 'expired') {
        from = '2000-01-01';
        to = now.toISOString().slice(0, 10);
      } else {
        from = now.toISOString().slice(0, 10);
        to = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
      }

      const { data } = await supabase
        .from('installations')
        .select('job_reference, customer_name, address_line_1, city, system_type, inverter_model, heat_pump_model, warranty_expiry')
        .eq('tenant_id', tenantId)
        .gte('warranty_expiry', from)
        .lte('warranty_expiry', to)
        .order('warranty_expiry', { ascending: true });

      const rows = (data || []).map((r) => ({
        job_reference: r.job_reference,
        customer: r.customer_name,
        address: fmtAddress(r as Record<string, unknown>),
        system: r.system_type === 'heat_pump' ? r.heat_pump_model : r.inverter_model,
        expires: fmtDate(r.warranty_expiry),
      }));

      return { window, from, to, count: rows.length, warranties: rows };
    }

    case 'get_support_queue': {
      const { data } = await supabase
        .from('escalations')
        .select('id, title, description, priority, status, created_at, installations!inner(tenant_id, customer_name, address_line_1, city, job_reference)')
        .eq('installations.tenant_id', tenantId)
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: false });

      const tickets = ((data || []) as any[]).map((e) => ({
        title: e.title,
        priority: e.priority,
        status: e.status,
        customer: e.installations?.customer_name,
        address: [e.installations?.address_line_1, e.installations?.city].filter(Boolean).join(', '),
        job_reference: e.installations?.job_reference,
        opened: fmtDate(e.created_at),
      }));

      const byPriority: Record<string, number> = {};
      for (const t of tickets) byPriority[t.priority || 'medium'] = (byPriority[t.priority || 'medium'] || 0) + 1;

      return { count: tickets.length, by_priority: byPriority, tickets };
    }

    case 'get_customer_communications': {
      const days = (args.days as number) || 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const { data } = await supabase
        .from('support_queries')
        .select('query_text, query_category, created_at, installations!inner(tenant_id, customer_name, city)')
        .eq('installations.tenant_id', tenantId)
        .gte('created_at', since)
        .order('created_at', { ascending: false });

      const scoped = (data || []) as any[];

      const themes = new Map<string, { theme: string; count: number; examples: string[] }>();
      for (const q of scoped) {
        const theme = (q.query_category as string) || 'general';
        const existing = themes.get(theme) || { theme, count: 0, examples: [] };
        existing.count += 1;
        if (existing.examples.length < 2 && q.query_text) {
          existing.examples.push(q.query_text.slice(0, 140));
        }
        themes.set(theme, existing);
      }

      const ranked = Array.from(themes.values()).sort((a, b) => b.count - a.count);
      return {
        window_days: days,
        total_queries: scoped.length,
        themes: ranked,
      };
    }

    case 'get_performance_metrics': {
      const { data } = await supabase
        .from('installations')
        .select('job_reference, customer_name, address_line_1, city, system_type, system_size_kwp, energy_generated_kwh, health_status, inverter_model')
        .eq('tenant_id', tenantId)
        .eq('system_type', 'solar_pv')
        .not('system_size_kwp', 'is', null);

      const rows = (data || []).filter((r) => r.energy_generated_kwh && r.system_size_kwp);
      const EXPECTED_Q = 212.5;

      const yields = rows.map((r) => {
        const size = Number(r.system_size_kwp) || 0;
        const generated = Number(r.energy_generated_kwh) || 0;
        const annual_yield = size > 0 ? generated / size : 0;
        const q_yield = annual_yield / 4;
        return {
          job_reference: r.job_reference,
          customer: r.customer_name,
          address: fmtAddress(r as Record<string, unknown>),
          size_kwp: size,
          annual_kwh: generated,
          annual_yield_per_kwp: Math.round(annual_yield),
          quarterly_yield_per_kwp: Math.round(q_yield),
          vs_expected_pct: Math.round((q_yield / EXPECTED_Q) * 100),
          inverter: r.inverter_model,
        };
      });

      const avgAnnual = yields.length
        ? Math.round(yields.reduce((a, b) => a + b.annual_yield_per_kwp, 0) / yields.length)
        : 0;
      const avgQuarterly = Math.round(avgAnnual / 4);

      const underperformers = yields.filter((y) => y.vs_expected_pct < 85).sort((a, b) => a.vs_expected_pct - b.vs_expected_pct);

      return {
        systems_measured: yields.length,
        avg_annual_yield_kwh_per_kwp: avgAnnual,
        avg_quarterly_yield_kwh_per_kwp: avgQuarterly,
        expected_quarterly_yield_kwh_per_kwp: Math.round(EXPECTED_Q),
        underperformers_count: underperformers.length,
        underperformers: underperformers.slice(0, 5),
      };
    }

    case 'get_attention_required': {
      const ticketsRes = await supabase
        .from('escalations')
        .select('title, priority, status, created_at, installations!inner(tenant_id, customer_name, city, job_reference)')
        .eq('installations.tenant_id', tenantId)
        .in('status', ['open', 'in_progress']);

      const tickets = (ticketsRes.data || []) as any[];
      const highPriority = tickets.filter((t) => t.priority === 'high' || t.priority === 'critical');

      const faultedRes = await supabase
        .from('installations')
        .select('job_reference, customer_name, address_line_1, city, system_type, inverter_model, heat_pump_model, health_status')
        .eq('tenant_id', tenantId)
        .eq('health_status', 'issue');

      const soon = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const warrantyRes = await supabase
        .from('installations')
        .select('job_reference, customer_name, address_line_1, city, warranty_expiry')
        .eq('tenant_id', tenantId)
        .gte('warranty_expiry', today)
        .lte('warranty_expiry', soon);

      return {
        high_priority_tickets: highPriority.map((t) => ({
          title: t.title,
          priority: t.priority,
          customer: t.installations?.customer_name,
          job_reference: t.installations?.job_reference,
          opened: fmtDate(t.created_at),
        })),
        faulted_installations: (faultedRes.data || []).map((r) => ({
          job_reference: r.job_reference,
          customer: r.customer_name,
          address: fmtAddress(r as Record<string, unknown>),
          system: r.system_type === 'heat_pump' ? r.heat_pump_model : r.inverter_model,
        })),
        warranties_expiring_soon: (warrantyRes.data || []).map((r) => ({
          job_reference: r.job_reference,
          customer: r.customer_name,
          address: fmtAddress(r as Record<string, unknown>),
          expires: fmtDate(r.warranty_expiry),
        })),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── System prompt ───────────────────────────────────────────────────────────
async function buildSystemPrompt(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const today = new Date().toLocaleDateString('en-IE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Look up the tenant's display name for the prompt. Falls back to a
  // generic label if the tenant row has no name set.
  let installerDisplay = 'your installer team';
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenant?.name) installerDisplay = String(tenant.name);
  } catch {
    // Non-fatal; keep the fallback.
  }

  return `You are OpenHouse Care Intelligence, a sharp, experienced colleague for renewable energy installers managing aftercare across multiple developments.

You work for ${installerDisplay}. You have full visibility across every installation ${installerDisplay} has done, regardless of which developer commissioned it.

Your job is to help installer teams (operations directors, technical directors, support staff) answer practical aftercare questions fast:
- Which installations need attention right now
- Fault patterns across inverter models, heat pumps, EV chargers, solar arrays
- Warranty status and expiry tracking
- Customer communication themes (what are homeowners asking about)
- System performance and yield trends
- Support queue priorities

Rules:
- Answer the question asked. Do not ask clarifying questions unless genuinely ambiguous.
- Use tools to get real data. Never fabricate installation counts, fault rates, or customer details.
- When you surface issues, be specific: name the address, the system, the date, the fault code.
- Never send a communication, update a record, or close a ticket without explicit user confirmation.
- Conversational Irish tone. No hyperbole. No em dashes.

FORMAT:
- Lead with the direct answer.
- Use bullet points for lists of installations or tickets.
- Use bold for key numbers and fault codes (e.g. **error 567**, **4 installations**).
- Use Irish English (colour, realise) and Irish conventions (€, Cork, Eircode).

CURRENT CONTEXT:
Installer: ${installerDisplay}
Today: ${today}`;
}

// ── Handler ─────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { supabase, session } = await requireCareTenantSession();
    const tenantId = session.tenantId;

    const body = await request.json();
    const { message, history } = body as {
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const openai = getOpenAI();
    const systemPrompt = await buildSystemPrompt(supabase, tenantId);

    const baseMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...((history || []).slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[]),
      { role: 'user', content: message },
    ];

    const toolPick = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: baseMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 800,
    });

    const choice = toolPick.choices[0]?.message;
    const toolCalls = choice?.tool_calls || [];

    const sources: Array<{ title: string; type: string; excerpt: string }> = [];
    const followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [...baseMessages];

    if (toolCalls.length > 0) {
      followUpMessages.push({
        role: 'assistant',
        content: choice?.content ?? null,
        tool_calls: toolCalls,
      } as OpenAI.Chat.Completions.ChatCompletionMessageParam);

      for (const call of toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          args = {};
        }
        const result = await executeTool(call.function.name, args, supabase, tenantId);
        followUpMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
        sources.push({
          title: call.function.name,
          type: 'function',
          excerpt: JSON.stringify(result).slice(0, 400),
        });
      }
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let fullResponse = '';

          if (toolCalls.length > 0) {
            const stream = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: followUpMessages,
              temperature: 0.3,
              max_tokens: 1200,
              stream: true,
            });
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content;
              if (content) {
                fullResponse += content;
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: 'token', content }) + '\n')
                );
              }
            }
          } else {
            const direct = choice?.content || 'No answer generated.';
            fullResponse = direct;
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'token', content: direct }) + '\n')
            );
          }

          if (sources.length > 0) {
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'sources', sources }) + '\n')
            );
          }

          try {
            const followUpCompletion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content:
                    'You help an installer operations team. Based on this conversation, suggest 3 short, specific follow-up questions they might ask next. Return ONLY a JSON array of strings, no explanation. Max 10 words per question.',
                },
                {
                  role: 'user',
                  content: `User asked: ${message}\n\nAssistant replied: ${fullResponse}`,
                },
              ],
              temperature: 0.6,
              max_tokens: 200,
            });
            const raw = followUpCompletion.choices[0]?.message?.content?.trim();
            if (raw) {
              const cleaned = raw.replace(/^```json\s*|\s*```$/g, '');
              const questions = JSON.parse(cleaned);
              if (Array.isArray(questions) && questions.length > 0) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ type: 'followups', questions }) + '\n')
                );
              }
            }
          } catch {
            // skip silently
          }

          try {
            await supabase.from('intelligence_interactions').insert({
              skin: 'care',
              user_role: 'admin',
              tenant_id: tenantId,
              query_text: message,
              response_text: fullResponse,
              response_type: 'answer',
              tools_called: toolCalls.map((c) => c.function.name),
              model_used: 'gpt-4o-mini',
            });
          } catch {
            // non-fatal
          }

          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: 'error',
                message: err instanceof Error ? err.message : 'Stream failed',
              }) + '\n'
            )
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
    if (error instanceof CareAuthError) return careAuthErrorToResponse(error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
