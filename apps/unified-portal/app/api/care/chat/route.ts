/**
 * POST /api/care/chat — Care AI assistant
 *
 * OpenAI function-calling assistant for homeowners.
 * Mirrors the developer intelligence assistant architecture
 * but scoped to a single installation with homeowner-friendly tools.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  findByErrorCode,
  findBySymptom,
} from '@/lib/care/solarTroubleshooting';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
        'Get the current status and live telemetry for this installation — power output, temperatures, inverter status, etc.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_alerts',
      description:
        'Get any active alerts or error codes on the system. Use this when the homeowner reports a problem or asks why something looks wrong.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'troubleshoot_issue',
      description:
        'Search the troubleshooting knowledge base for a symptom or error code. Use this when the homeowner describes a problem or error.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Error code (e.g. "F32") or symptom description',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_energy_report',
      description:
        'Get energy production or consumption figures — today, this month, this year, and lifetime.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['today', 'month', 'year', 'lifetime'],
            description: 'Which period to report on',
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
        'Draft a service request or message to the installer on behalf of the homeowner. Always show the draft first and wait for confirmation.',
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
  installation: any,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<any> {
  const installationId = installation.id;

  switch (toolName) {
    case 'get_system_status': {
      const { data: telemetry } = await supabase
        .from('installation_telemetry')
        .select('*')
        .eq('installation_id', installationId)
        .order('recorded_at', { ascending: false })
        .limit(1);

      const latest = telemetry?.[0];
      const systemType = installation.system_type;

      if (systemType === 'solar') {
        return {
          system_type: 'solar',
          model: installation.system_model,
          capacity: installation.capacity,
          status: latest?.inverter_status || 'OK',
          current_output_kw: latest?.generation_kwh
            ? (latest.generation_kwh / 1).toFixed(1)
            : null,
          self_consumption_pct: latest?.self_consumption_pct || null,
          weather: latest?.weather_status || 'unknown',
          last_updated: latest?.recorded_at || null,
          installation_date: installation.installation_date,
        };
      }

      if (systemType === 'heat_pump') {
        return {
          system_type: 'heat_pump',
          model: installation.system_model,
          capacity: installation.capacity,
          status: latest?.inverter_status || 'OK',
          cop: latest?.cop || null,
          flow_temp_c: latest?.flow_temp_c || null,
          return_temp_c: latest?.return_temp_c || null,
          outdoor_temp_c: latest?.outdoor_temp_c || null,
          last_updated: latest?.recorded_at || null,
        };
      }

      if (systemType === 'ev_charger') {
        return {
          system_type: 'ev_charger',
          model: installation.system_model,
          capacity: installation.capacity,
          status: latest?.inverter_status || 'OK',
          last_updated: latest?.recorded_at || null,
        };
      }

      return {
        system_type: systemType,
        model: installation.system_model,
        status: 'OK',
        last_updated: latest?.recorded_at || null,
      };
    }

    case 'get_alerts': {
      const { data: alerts } = await supabase
        .from('installation_alerts')
        .select('*')
        .eq('installation_id', installationId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        active_alert_count: alerts?.length || 0,
        alerts: (alerts || []).map((a: any) => ({
          title: a.title,
          description: a.description,
          error_code: a.error_code,
          severity: a.severity,
          requires_technician: a.requires_technician,
          reported_at: a.created_at,
        })),
      };
    }

    case 'troubleshoot_issue': {
      const query: string = args.query || '';

      // Check for error codes like F21, F32
      const errorCodeMatch = query.match(/\b(F\d{2}|ERR_\w+)\b/i);
      let match = null;

      if (errorCodeMatch) {
        match = findByErrorCode(errorCodeMatch[1]);
      }

      if (!match) {
        const results = findBySymptom(query);
        match = results[0] || null;
      }

      if (!match) {
        return {
          found: false,
          message: `No specific guide found for "${query}". I can still help — describe what you're seeing in more detail.`,
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

    case 'get_energy_report': {
      const period = args.period || 'today';
      const baseline = installation.performance_baseline || {};

      // Get aggregated telemetry
      let startDate = new Date();
      if (period === 'month') startDate.setDate(1);
      else if (period === 'year') startDate = new Date(startDate.getFullYear(), 0, 1);
      else if (period === 'lifetime') startDate = new Date(installation.installation_date);
      else {
        // today
        startDate.setHours(0, 0, 0, 0);
      }

      const { data: telemetry } = await supabase
        .from('installation_telemetry')
        .select('generation_kwh, consumption_kwh, recorded_at')
        .eq('installation_id', installationId)
        .gte('recorded_at', startDate.toISOString());

      const totalGeneration = (telemetry || []).reduce(
        (sum: number, t: any) => sum + (t.generation_kwh || 0),
        0
      );
      const totalConsumption = (telemetry || []).reduce(
        (sum: number, t: any) => sum + (t.consumption_kwh || 0),
        0
      );

      // Estimated savings at €0.35/kWh average Irish rate
      const savingsEur = (totalGeneration * 0.35).toFixed(2);

      return {
        period,
        system_type: installation.system_type,
        generation_kwh: totalGeneration.toFixed(1),
        consumption_kwh: totalConsumption > 0 ? totalConsumption.toFixed(1) : null,
        estimated_savings_eur: savingsEur,
        baseline_daily_kwh: baseline.daily_avg_kWh || null,
        note:
          period === 'today' && new Date().getHours() < 10
            ? 'Morning reading — generation will increase as the day progresses.'
            : null,
      };
    }

    case 'get_warranty_info': {
      const warrantyExpiry = installation.warranty_expiry
        ? new Date(installation.warranty_expiry)
        : null;
      const now = new Date();
      const daysRemaining = warrantyExpiry
        ? Math.ceil((warrantyExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const specs = installation.component_specs || {};

      return {
        system_model: installation.system_model,
        installation_date: installation.installation_date,
        warranty_expiry: installation.warranty_expiry || 'Not recorded',
        days_remaining: daysRemaining,
        is_in_warranty: daysRemaining !== null ? daysRemaining > 0 : null,
        component_warranties: specs.warranties || null,
        how_to_claim:
          'Contact your installer directly with your installation ID and a description of the fault. Keep your handover documents as proof of purchase.',
      };
    }

    case 'draft_service_request': {
      return {
        service_request_draft: {
          subject: args.subject,
          description: args.description,
          urgency: args.urgency || 'routine',
          installation_id: installationId,
          system_model: installation.system_model,
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

    const supabase = getSupabaseAdmin();

    // Get installation
    const { data: installation, error: instErr } = await supabase
      .from('installations')
      .select('*')
      .eq('id', installationId)
      .single();

    if (instErr || !installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    // Get or create conversation
    let convoId = conversation_id;
    if (!convoId) {
      const { data: newConvo } = await supabase
        .from('care_conversations')
        .insert({
          installation_id: installationId,
          title: message.substring(0, 80),
        })
        .select('id')
        .single();
      convoId = newConvo?.id;
    }

    // Save user message
    if (convoId) {
      await supabase.from('care_messages').insert({
        conversation_id: convoId,
        role: 'user',
        message_type: 'text',
        content: message,
      });
    }

    // Load conversation history (last 20 messages)
    let contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (convoId) {
      const { data: history } = await supabase
        .from('care_messages')
        .select('role, content')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: true })
        .limit(20);

      contextMessages = (history || [])
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
    }

    // System prompt
    const today = new Date().toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const systemPrompt = `You are the OpenHouse Care Assistant — a friendly, knowledgeable AI for homeowners who have had renewable energy systems installed.

You help with:
- Understanding system status and performance
- Troubleshooting problems and error codes
- Energy generation and savings reports
- Warranty information and claims
- Contacting the installer when needed

TONE:
- Friendly and reassuring. Homeowners may be anxious about technical issues.
- Clear, jargon-free. Explain things simply.
- Honest — never guess. If uncertain, say so and suggest contacting the installer.
- Proactive — if you fetch data and notice something worth flagging, mention it.

RULES:
- Always fetch real data before answering questions about status, alerts, or energy.
- When drafting a service request, always show the draft first before confirming it's sent.
- If an issue requires a technician, be clear about that — don't give false hope.
- Use Irish context (€ for currency, kWp for solar capacity, SEAI for grants).

CURRENT INSTALLATION:
System: ${installation.system_model} (${installation.system_type})
Capacity: ${installation.capacity || 'not recorded'}
Installed: ${installation.installation_date}
Warranty expires: ${installation.warranty_expiry || 'not recorded'}
Serial: ${installation.serial_number || 'not recorded'}
Installation ID: ${installation.id}

Today: ${today}`;

    // First OpenAI call
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
    const responseMessages: any[] = [];

    if (toolCalls && toolCalls.length > 0) {
      const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'assistant', content: null as any, tool_calls: toolCalls },
      ];

      for (const call of toolCalls) {
        const args = JSON.parse(call.function.arguments);
        const result = await executeTool(call.function.name, args, installation, supabase);

        toolResults.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });

        // Emit rich cards for structured results
        const richType =
          call.function.name === 'get_system_status'
            ? 'system_status'
            : call.function.name === 'get_alerts'
            ? 'alert'
            : call.function.name === 'troubleshoot_issue'
            ? 'troubleshoot'
            : null;

        if (richType && result && !result.error) {
          const richMsg = {
            id: `rich-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: richType,
            content: '',
            structured_data: result,
            created_at: new Date().toISOString(),
          };
          responseMessages.push(richMsg);

          if (convoId) {
            await supabase.from('care_messages').insert({
              conversation_id: convoId,
              role: 'assistant',
              message_type: richType,
              content: JSON.stringify(result).substring(0, 200),
              structured_data: result,
            });
          }
        }

        // Service request drafts get their own card too
        if (result.service_request_draft) {
          const draftMsg = {
            id: `draft-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: 'service_request_draft',
            content: '',
            structured_data: result.service_request_draft,
            created_at: new Date().toISOString(),
          };
          responseMessages.push(draftMsg);

          if (convoId) {
            await supabase.from('care_messages').insert({
              conversation_id: convoId,
              role: 'assistant',
              message_type: 'text',
              content: `Service request draft: ${result.service_request_draft.subject}`,
            });
          }
        }
      }

      // Second call: natural language summary with tool results in context
      const followUp = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextMessages,
          { role: 'user', content: message },
          ...toolResults,
        ],
        temperature: 0.4,
        max_tokens: 800,
      });

      assistantContent = followUp.choices[0]?.message?.content || '';
    }

    // Add text response
    if (assistantContent) {
      const textMsg = {
        id: `text-${Date.now()}`,
        role: 'assistant',
        message_type: 'text',
        content: assistantContent,
        created_at: new Date().toISOString(),
      };
      responseMessages.push(textMsg);

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
    console.error('[Care Chat API] error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
