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
  getRelevantCareKnowledge,
  formatCareKnowledge,
} from '@/lib/care/care-knowledge';

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
        'Get the current status and details for this installation — system type, size, health, and components.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'troubleshoot_issue',
      description:
        'Search the troubleshooting knowledge base for a symptom or error code. Use when the homeowner describes a problem.',
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
      return {
        system_type: installation.system_type,
        inverter: installation.inverter_model,
        panels: installation.panel_model
          ? `${installation.panel_count}x ${installation.panel_model}`
          : null,
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

    // Load conversation history
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

    // Care KB — inject relevant knowledge based on the message
    const careKnowledgeEntries = getRelevantCareKnowledge(message, installation.system_type);
    const careKnowledgeContext = formatCareKnowledge(careKnowledgeEntries);

    // System prompt
    const today = new Date().toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const specs = installation.system_specs || {};
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

RULES:
- Always fetch real data before answering questions about the system.
- When drafting a service request, always show it first before confirming it's sent.
- If an issue requires a technician, be clear about that.
- Use Irish context (€ for currency, kWp for solar, SEAI for grants/export).

CURRENT INSTALLATION:
Customer: ${installation.customer_name}
Address: ${[installation.address_line_1, installation.city, installation.county].filter(Boolean).join(', ')}
System: ${installation.system_type?.replace('_', ' ')} — ${installation.inverter_model}
Size: ${installation.system_size_kwp} kWp
Panels: ${installation.panel_count}x ${installation.panel_model}
Battery: ${specs.battery || 'none'}
Installed: ${installation.install_date}
Warranty expires: ${installation.warranty_expiry || 'not recorded'}
Job reference: ${installation.job_reference}
Health: ${installation.health_status || 'healthy'}
Today: ${today}

${careKnowledgeContext ? careKnowledgeContext : ''}

RULES:
- Use the knowledge base above to give accurate, specific answers.
- If the KB covers the question, answer from it directly — don't say "check the manual".
- If the KB doesn't cover it, use your own knowledge but be clear it's general guidance.
- Never invent specific numbers (generation figures, costs) without a clear basis.
- Safety issues (electrical faults, gas smells, structural damage): always direct to a professional.`;

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
        const result = await executeTool(call.function.name, args, installation);

        toolResults.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });

        // Emit rich cards for structured results
        const richType =
          call.function.name === 'get_system_status'
            ? 'system_status'
            : call.function.name === 'troubleshoot_issue' && result.found
            ? 'troubleshoot'
            : null;

        if (richType) {
          responseMessages.push({
            id: `rich-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: richType,
            content: '',
            structured_data: result,
            created_at: new Date().toISOString(),
          });
        }

        if (result.service_request_draft) {
          responseMessages.push({
            id: `draft-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: 'service_request_draft',
            content: '',
            structured_data: result.service_request_draft,
            created_at: new Date().toISOString(),
          });
        }
      }

      // Second call — natural language summary
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

    // Save and return text response
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
    console.error('[Care Chat API] error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
