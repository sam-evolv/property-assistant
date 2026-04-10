/**
 * POST /api/care/chat — Care AI assistant
 *
 * OpenAI function-calling assistant for homeowners.
 * Schema-matched to the real installations table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  findByErrorCode,
  findBySymptom,
} from '@/lib/care/solarTroubleshooting';
import {
  findHeatPumpByErrorCode,
  findHeatPumpBySymptom,
} from '@/lib/care/heatPumpTroubleshooting';
import {
  getRelevantCareKnowledge,
  formatCareKnowledge,
} from '@/lib/care/care-knowledge';
import {
  getSeSystemsKnowledge,
  getSeSystemsInstallerContext,
  isSeSystemsInstallation,
} from '@/lib/care/seSystemsKnowledge';
import { getIrelandRenewableKnowledge } from '@/lib/care/irelandRenewableKnowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_system_status',
      description:
        'Get the current status and details for this installation — system type, size, health, and components.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'troubleshoot_issue',
      description:
        'ALWAYS call this when the homeowner mentions any fault, error code, red light, flashing light, system not working, or any problem with their heat pump or solar system. This is the knowledge base — do not answer troubleshooting questions from your own knowledge, always search here first.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The error code (e.g. "E3", "F32") and/or symptom description as described by the homeowner',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_energy_estimate',
      description:
        'Get estimated energy generation figures based on system size and installation location.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['daily', 'monthly', 'annual'],
            description: 'Which period to estimate for',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_warranty_info',
      description:
        'Get warranty details — expiry date, what is covered, and how to make a claim.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_service_request',
      description:
        'Draft a service request to the installer. Always show the draft first before confirming it is sent.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          description: { type: 'string' },
          urgency: { type: 'string', enum: ['routine', 'urgent', 'emergency'] },
        },
        required: ['subject', 'description'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  args: any,
  installation: any
): Promise<any> {
  switch (toolName) {
    case 'get_system_status': {
      const specs = installation.system_specs || {};
      const baseline = specs.performance_baseline || {};
      const isHP = installation.system_type?.toLowerCase().includes('heat_pump') ||
        installation.system_type?.toLowerCase().includes('heat pump');

      if (isHP) {
        return {
          system_type: 'heat_pump',
          model: installation.heat_pump_model || specs.model,
          capacity: installation.system_specs?.capacity_heating || specs.capacity_heating,
          type: specs.type || 'Air-to-Water heat pump',
          refrigerant: specs.refrigerant || 'R32',
          smart_control: specs.smart_control || specs.controlModule || 'standard controller',
          health_status: installation.health_status || 'healthy',
          install_date: installation.install_date,
          warranty_expiry: installation.warranty_expiry,
          performance: {
            average_cop: baseline.average_cop,
            seasonal_cop: baseline.seasonal_cop,
            annual_heating_kwh: baseline.annual_heating_kwh,
            annual_hot_water_kwh: baseline.annual_hot_water_kwh,
          },
        };
      }

      return {
        system_type: installation.system_type,
        inverter: installation.inverter_model || installation.heat_pump_model,
        panels: installation.panel_model
          ? `${installation.panel_count}x ${installation.panel_model}`
          : specs.panels || null,
        size_kwp: installation.system_size_kwp,
        health_status: installation.health_status || 'healthy',
        install_date: installation.install_date,
        portal_status: installation.portal_status,
        address: [installation.address_line_1, installation.city, installation.county]
          .filter(Boolean)
          .join(', '),
        specs: {
          battery: specs.battery || 'none',
          optimizer_count: specs.optimizer_count || null,
          roof_orientation: specs.roof_orientation || null,
        },
      };
    }

    case 'troubleshoot_issue': {
      const query: string = args.query || '';
      const queryLower = query.toLowerCase();

      // Explicit heat pump mention in query overrides installation system type
      const queryMentionsHeatPump =
        queryLower.includes('heat pump') ||
        queryLower.includes('heatpump') ||
        queryLower.includes('hp fault') ||
        queryLower.includes('e1') || queryLower.includes('e2') ||
        queryLower.includes('e3') || queryLower.includes('e4') ||
        queryLower.includes('defrost') || queryLower.includes('cop') ||
        queryLower.includes('flow temp') || queryLower.includes('cylinder');

      const installationIsHeatPump =
        installation.system_type?.toLowerCase().includes('heat_pump') ||
        installation.system_type?.toLowerCase().includes('heat pump');

      // Always check both KBs and pick the best match — avoids false positives
      // from partial keyword hits in the wrong KB
      const errorCodeMatch = query.match(/\b([EFef]\d{1,2}|F\d{2}|ERR_\w+|HIGH[_\s]PRESSURE|LOW[_\s]PRESSURE)\b/i);
      let match = null;

      if (errorCodeMatch) {
        // Try heat pump KB first if query mentions heat pump or installation is HP
        if (queryMentionsHeatPump || installationIsHeatPump) {
          match = findHeatPumpByErrorCode(errorCodeMatch[1]);
        }
        // Fall through to solar KB if heat pump KB didn't match
        if (!match) {
          match = findByErrorCode(errorCodeMatch[1]);
        }
        // Last resort: try heat pump KB even for solar installations
        if (!match) {
          match = findHeatPumpByErrorCode(errorCodeMatch[1]);
        }
      }

      if (!match) {
        // Score against BOTH KBs and pick highest
        const hpResults = findHeatPumpBySymptom(query);
        const solarResults = findBySymptom(query);

        // Prefer heat pump results if query mentions heat pump, else pick by KB type
        if (queryMentionsHeatPump || installationIsHeatPump) {
          match = hpResults[0] || solarResults[0] || null;
        } else {
          match = solarResults[0] || hpResults[0] || null;
        }
      }

      if (!match) {
        return {
          found: false,
          message: `No specific guide found for "${query}". Describe what you're seeing in more detail and I can help further.`,
        };
      }

      return {
        found: true,
        symptom: match.symptom,
        diagnosis: match.diagnosis,
        homeowner_can_fix: match.homeownerCanFix,
        steps: match.homeownerCanFix ? match.steps : [],
        estimated_time: match.homeownerCanFix ? match.estimatedTime : null,
        requires_technician: !match.homeownerCanFix,
        callout_cost_eur: !match.homeownerCanFix ? match.calloutCost : null,
        prevention: match.prevention,
        severity: match.severity,
      };
    }

    case 'get_energy_estimate': {
      const period = args.period || 'annual';
      const kwp = installation.system_size_kwp || 4;

      // Ireland average: ~850 kWh/kWp/year
      const annualKwh = kwp * 850;
      const monthlyKwh = annualKwh / 12;
      const dailyKwh = annualKwh / 365;

      // Irish electricity rate ~€0.35/kWh
      const rate = 0.35;

      const figures: Record<string, any> = {
        daily: {
          generation_kwh: dailyKwh.toFixed(1),
          estimated_savings_eur: (dailyKwh * rate).toFixed(2),
          note: 'Varies significantly with weather and season.',
        },
        monthly: {
          generation_kwh: monthlyKwh.toFixed(0),
          estimated_savings_eur: (monthlyKwh * rate).toFixed(2),
          note: 'Summer months ~2x winter output in Ireland.',
        },
        annual: {
          generation_kwh: annualKwh.toFixed(0),
          estimated_savings_eur: (annualKwh * rate).toFixed(2),
          note: 'Based on Irish average of 850 kWh/kWp/year.',
        },
      };

      return {
        period,
        system_size_kwp: kwp,
        ...figures[period],
        seai_export_note:
          "You may also earn from excess exported to the grid via your energy supplier's Micro-generation Support Scheme.",
      };
    }

    case 'get_warranty_info': {
      const specs = installation.system_specs || {};
      const warrantyExpiry = installation.warranty_expiry
        ? new Date(installation.warranty_expiry)
        : null;
      const daysRemaining = warrantyExpiry
        ? Math.ceil(
            (warrantyExpiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          )
        : null;

      return {
        inverter: installation.inverter_model,
        install_date: installation.install_date,
        warranty_expiry: installation.warranty_expiry || 'Not recorded',
        days_remaining: daysRemaining,
        in_warranty: daysRemaining !== null ? daysRemaining > 0 : null,
        coverage: {
          panels_years: specs.panel_warranty_years || 25,
          inverter_years: specs.inverter_warranty_years || 12,
          workmanship_years: specs.workmanship_warranty_years || 10,
        },
        how_to_claim:
          'Contact your installer with your job reference and a description of the fault. Keep your handover documents as proof of purchase.',
        job_reference: installation.job_reference,
      };
    }

    case 'draft_service_request': {
      return {
        service_request_draft: {
          subject: args.subject,
          description: args.description,
          urgency: args.urgency || 'routine',
          installation_id: installation.id,
          job_reference: installation.job_reference,
          customer_name: installation.customer_name,
          customer_email: installation.customer_email,
          system: `${installation.inverter_model} (${installation.system_size_kwp} kWp)`,
          sent: false,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const { installationId, message, conversation_id } = await request.json();

    if (!installationId || !message?.trim()) {
      return NextResponse.json(
        { error: 'installationId and message required' },
        { status: 400 }
      );
    }

    if (!checkRateLimit(installationId)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before sending another message.' },
        { status: 429 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get installation
    const { data: installation, error: instErr } = await supabase
      .from('installations')
      .select('id, tenant_id, system_type, system_specs, health_status, install_date, warranty_expiry, inverter_model, panel_model, panel_count, system_size_kwp, portal_status, address_line_1, city, county, job_reference, customer_name, customer_email, heat_pump_model, heat_pump_serial, heat_pump_cop, flow_temp_current, hot_water_temp_current, controls_model, installer_name, installer_contact, system_category, next_service_due')
      .eq('id', installationId)
      .single();

    if (instErr || !installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    // PARALLEL: conversation management + history loading
    let convoId = conversation_id;
    const [, historyResult] = await Promise.all([
      (async () => {
        if (!convoId) {
          const { data: newConvo } = await supabase
            .from('care_conversations')
            .insert({ installation_id: installationId, title: message.substring(0, 80) })
            .select('id')
            .single();
          convoId = newConvo?.id;
        }
        if (convoId) {
          await supabase.from('care_messages').insert({
            conversation_id: convoId, role: 'user', message_type: 'text', content: message,
          });
        }
      })(),
      (async () => {
        if (!conversation_id) return [];
        const { data: history } = await supabase
          .from('care_messages')
          .select('role, content')
          .eq('conversation_id', conversation_id)
          .order('created_at', { ascending: true })
          .limit(20);
        return (history || [])
          .filter((m: any) => m.role !== 'system')
          .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      })(),
    ]);
    const contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = historyResult;

    // Care KB
    const careKnowledgeEntries = getRelevantCareKnowledge(message, installation.system_type);
    const seSystemsEntries = isSeSystemsInstallation(installation)
      ? getSeSystemsKnowledge(message, installation.system_type)
      : [];
    const irelandEntries = getIrelandRenewableKnowledge(message, installation.system_type);

    const mergedEntries = [
      ...seSystemsEntries,
      ...irelandEntries.filter(
        (e) => !seSystemsEntries.some((s) => s.content.startsWith(e.content.substring(0, 40)))
      ),
      ...careKnowledgeEntries.filter(
        (e) =>
          !seSystemsEntries.some((s) => s.content.startsWith(e.content.substring(0, 40))) &&
          !irelandEntries.some((i) => i.content.startsWith(e.content.substring(0, 40)))
      ),
    ].slice(0, 4);

    const careKnowledgeContext = formatCareKnowledge(mergedEntries);

    // System prompt
    const today = new Date().toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const specs = installation.system_specs || {};
    const baseline = specs.performance_baseline || {};
    const isHeatPumpSystem = installation.system_type?.toLowerCase().includes('heat_pump') ||
      installation.system_type?.toLowerCase().includes('heat pump');

    const systemSummary = isHeatPumpSystem
      ? [
          `System: Heat Pump — ${installation.heat_pump_model || specs.model || 'unknown model'}`,
          `Capacity: ${installation.system_specs?.capacity_heating || specs.capacity_heating || 'unknown'}`,
          `Type: ${specs.type || 'Air-to-Water heat pump'}`,
          `Refrigerant: ${specs.refrigerant || 'R32'}`,
          `Smart Control: ${specs.smart_control || specs.controlModule || 'standard controller'}`,
          `Installed: ${installation.install_date || 'not recorded'}`,
          `Warranty expires: ${installation.warranty_expiry || 'not recorded'}`,
          `Avg COP: ${baseline.average_cop || 'not recorded'}`,
          `Annual heating: ${baseline.annual_heating_kwh ? baseline.annual_heating_kwh + ' kWh' : 'not recorded'}`,
        ].join('\n')
      : [
          `System: ${installation.system_type?.replace('_', ' ')} — ${installation.inverter_model || installation.heat_pump_model || 'unknown'}`,
          `Size: ${installation.system_size_kwp ? installation.system_size_kwp + ' kWp' : 'unknown'}`,
          `Panels: ${installation.panel_count ? installation.panel_count + 'x ' + installation.panel_model : specs.panels || 'not recorded'}`,
          `Battery: ${specs.battery || 'none'}`,
          `Installed: ${installation.install_date || 'not recorded'}`,
          `Warranty expires: ${installation.warranty_expiry || 'not recorded'}`,
        ].join('\n');

    const seSystemsContext = isSeSystemsInstallation(installation)
      ? `\n${getSeSystemsInstallerContext()}`
      : '';

    const systemPrompt = `You are the OpenHouse Care Assistant — a friendly, knowledgeable AI helping homeowners who have had renewable energy systems installed.

You help with:
- Understanding system status and performance
- Troubleshooting problems and error codes
- Energy generation estimates and savings
- Warranty information and claims
- Contacting the installer when needed

TONE:
- Friendly and reassuring. Homeowners may be anxious about technical issues.
- Clear and jargon-free. Explain things simply.
- Honest — never guess. If uncertain, say so and suggest contacting the installer.
- Proactive — if you notice something worth flagging, mention it.
- NEVER echo back what the user just told you. If they said there's an E3 error and a red light, do not start your reply with "It looks like you have an E3 error and a red light." They know — they just told you. Jump straight to what it means and what to do.

RULES:
- CRITICAL: Any fault, error code, red light, or "not working" message → ALWAYS call troubleshoot_issue first. Never answer troubleshooting questions from your own training data.
- Always fetch real data before answering questions about the system.
- When drafting a service request, always show it first before confirming it's sent.
- If an issue requires a technician, be clear about that.
- Use Irish context (€ for currency, SEAI for grants/schemes).
- For solar: reference kWp, generation figures, export tariffs.
- For heat pumps: reference COP, flow temperature, SEAI heat pump grant (€6,500), F-Gas regulations.

CURRENT INSTALLATION:
Customer: ${installation.customer_name || installation.customer_email || 'Homeowner'}
${systemSummary}
Health: ${installation.health_status || 'healthy'}
Today: ${today}
${seSystemsContext}

${careKnowledgeContext ? careKnowledgeContext : ''}

RULES:
- Use the knowledge base above to give accurate, specific answers.
- If the KB covers the question, answer from it directly — don't say "check the manual".
- If the KB doesn't cover it, use your own knowledge but be clear it's general guidance.
- Never invent specific numbers (generation figures, costs) without a clear basis.
- Safety issues (electrical faults, gas smells, structural damage): always direct to a professional.`;

    // First OpenAI call — tool selection (NOT streamed)
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content: message },
      ],
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.4,
      max_tokens: 1500,
    });

    let assistantContent = completion.choices[0]?.message?.content || '';
    const toolCalls = completion.choices[0]?.message?.tool_calls;
    const richMessages: any[] = [];

    // Build messages for follow-up call
    let followUpMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...contextMessages,
      { role: 'user', content: message },
    ];

    let needsFollowUp = false;

    if (toolCalls && toolCalls.length > 0) {
      needsFollowUp = true;
      const toolResultMsgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'assistant', content: null as any, tool_calls: toolCalls },
      ];

      for (const call of toolCalls) {
        const args = JSON.parse(call.function.arguments);
        const result = await executeTool(call.function.name, args, installation);

        toolResultMsgs.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });

        const richType =
          call.function.name === 'get_system_status'
            ? 'system_status'
            : call.function.name === 'troubleshoot_issue' && result.found
            ? 'troubleshoot'
            : null;

        if (richType) {
          richMessages.push({
            id: `rich-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: richType,
            content: '',
            structured_data: result,
            created_at: new Date().toISOString(),
          });
        }

        if (result.service_request_draft) {
          richMessages.push({
            id: `draft-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: 'service_request_draft',
            content: '',
            structured_data: result.service_request_draft,
            created_at: new Date().toISOString(),
          });
        }
      }

      followUpMessages = [...followUpMessages, ...toolResultMsgs];
    }

    // Check if client wants streaming
    const wantsStream = request.headers.get('accept')?.includes('text/event-stream');

    if (wantsStream) {
      // ── SSE STREAMING PATH ──
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Send metadata (conversation_id + rich cards) immediately
            controller.enqueue(encoder.encode(
              `event: meta\ndata: ${JSON.stringify({ conversation_id: convoId, rich_messages: richMessages })}\n\n`
            ));

            if (needsFollowUp || !assistantContent) {
              // Stream the follow-up / main response
              const streamResponse = await getOpenAI().chat.completions.create({
                model: 'gpt-4o-mini',
                messages: followUpMessages,
                temperature: 0.4,
                max_tokens: 800,
                stream: true,
              });

              let fullText = '';
              for await (const chunk of streamResponse) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify(delta)}\n\n`));
                }
              }
              assistantContent = fullText;
            } else {
              // No tool calls, direct answer — send as single token
              controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify(assistantContent)}\n\n`));
            }

            controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
            controller.close();

            // Fire-and-forget: persist assistant message
            if (assistantContent && convoId) {
              supabase.from('care_messages').insert({
                conversation_id: convoId,
                role: 'assistant',
                message_type: 'text',
                content: assistantContent,
              }).then(() => {
                supabase
                  .from('care_conversations')
                  .update({
                    updated_at: new Date().toISOString(),
                    message_count: contextMessages.length + 2,
                  })
                  .eq('id', convoId);
              });
            }
          } catch (streamErr) {
            console.error('[CARE_CHAT_STREAM_ERROR]', streamErr);
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream failed' })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // ── NON-STREAMING JSON FALLBACK ──
    if (needsFollowUp) {
      const followUp = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: followUpMessages,
        temperature: 0.4,
        max_tokens: 800,
      });
      assistantContent = followUp.choices[0]?.message?.content || '';
    }

    const responseMessages = [...richMessages];
    if (assistantContent) {
      responseMessages.push({
        id: `text-${Date.now()}`,
        role: 'assistant',
        message_type: 'text',
        content: assistantContent,
        created_at: new Date().toISOString(),
      });

      if (convoId) {
        await supabase.from('care_messages').insert({
          conversation_id: convoId,
          role: 'assistant',
          message_type: 'text',
          content: assistantContent,
        });

        await supabase
          .from('care_conversations')
          .update({
            updated_at: new Date().toISOString(),
            message_count: contextMessages.length + 2,
          })
          .eq('id', convoId);
      }
    }

    return NextResponse.json({
      conversation_id: convoId,
      messages: responseMessages,
    });
  } catch (error) {
    console.error("[CARE_CHAT_ERROR] Full error:", error);
    console.error("[CARE_CHAT_ERROR] Message:", error instanceof Error ? error.message : "Unknown");
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
