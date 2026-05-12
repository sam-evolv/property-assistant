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
import { verifyConversationBelongsToInstallation } from '@/lib/care/verify-conversation-ownership';
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
// Shared types
// ---------------------------------------------------------------------------

type ServiceRecord = {
  id: string;
  service_date: string;
  service_type: string | null;
  engineer_name: string | null;
  company: string | null;
  outcome: string | null;
  notes: string | null;
  warranty_validated: boolean | null;
};

async function fetchServiceHistory(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  installationId: string,
): Promise<ServiceRecord[]> {
  const { data } = await supabase
    .from('service_records')
    .select('id, service_date, service_type, engineer_name, company, outcome, notes, warranty_validated')
    .eq('installation_id', installationId)
    .order('service_date', { ascending: false })
    .limit(20);
  return (data as ServiceRecord[] | null) ?? [];
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
        'Get the current status and details for this installation: system type, size, health, and components. Use for read-only questions about what is installed.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'troubleshoot_issue',
      description:
        'ALWAYS call this when the homeowner mentions any fault, error code, red light, flashing light, system not working, or any problem. This is the knowledge base. Never answer troubleshooting questions from your own training; always search here first.',
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
      name: 'get_service_history',
      description:
        'Return the service records the installer has logged for this installation, ordered by date (newest first). Use when the homeowner asks about past services, who last visited, warranty validations, or when the next service is due.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_warranty_info',
      description:
        'Get warranty details: expiry date, what is covered, and how to make a claim.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_service_request',
      description:
        'Draft a service request to the installer. Always returns a draft for the homeowner to review. Does not send anything. The homeowner has to approve the draft separately.',
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
  ctx: { supabase: ReturnType<typeof getSupabaseAdmin>; serviceHistory: ServiceRecord[] }
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

    case 'get_service_history': {
      // Service history is loaded once per request and passed into the tool
      // context so a single request can call this tool more than once without
      // hitting the database again.
      const records = ctx.serviceHistory;
      if (records.length === 0) {
        return {
          count: 0,
          records: [],
          note: 'No service records on file for this installation yet.',
        };
      }
      return {
        count: records.length,
        records: records.map((r) => ({
          date: r.service_date,
          type: r.service_type,
          engineer: r.engineer_name,
          company: r.company,
          outcome: r.outcome,
          warranty_validated: r.warranty_validated,
          notes: r.notes,
        })),
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

    // STOPGAP CROSS-CHECK (Batch 1.3, audit C002): if the request supplies
    // a conversation_id, verify it belongs to the same installationId before
    // we load any history into the model context. Without this check, a
    // caller can pass another homeowner's conversation_id and have that
    // conversation's history streamed into the prompt.
    //
    // This is a structural fix only. The homeowner side of the Care app has
    // no admin session today (QR-code entry per middleware.ts:37), which
    // means we cannot rely on RLS or session-tenant filtering here. Batch 2
    // will replace this stopgap with the real homeowner session model. Until
    // then, the verifier below is the security boundary.
    if (conversation_id) {
      const ownership = await verifyConversationBelongsToInstallation(
        supabase,
        conversation_id,
        installationId,
      );
      if (ownership.status === 'cross_tenant') {
        // Stable tag for log greps; do not include the actual other-tenant
        // installation id in the response.
        console.warn(
          '[CARE_CROSS_TENANT_CONVERSATION] conversation_id=%s requested_installation_id=%s actual_installation_id=%s',
          conversation_id,
          installationId,
          ownership.actualInstallationId,
        );
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 },
        );
      }
      if (ownership.status === 'not_found') {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 },
        );
      }
    }

    // Get installation. Join tenants to pick up the customer-facing trading
    // name (installer_display_name). The legal name stays internal and never
    // reaches the assistant context.
    const { data: dbInstallation } = await supabase
      .from('installations')
      .select('id, tenant_id, system_type, system_specs, health_status, install_date, warranty_expiry, inverter_model, panel_model, panel_count, system_size_kwp, portal_status, address_line_1, city, county, job_reference, customer_name, customer_email, heat_pump_model, heat_pump_serial, heat_pump_cop, flow_temp_current, hot_water_temp_current, controls_model, installer_name, installer_contact, system_category, next_service_due, tenants(installer_display_name, name)')
      .eq('id', installationId)
      .single();

    // Cast through any: the Supabase typegen produces an awkward union with
    // the demo-fallback object below, and the downstream code is already
    // duck-typed against this shape. Tightening the types properly is
    // tracked in the homeowner-screens nullability sweep issue.
    const installation: any = dbInstallation ?? {
      id: installationId,
      customer_name: 'Mary Murphy',
      system_type: 'solar_pv',
      system_size_kwp: 3.69,
      inverter_model: 'SolarEdge SE3680H',
      panel_model: 'JA Solar 410W',
      panel_count: 9,
      install_date: '2026-01-14',
      warranty_expiry: '2036-01-14',
      health_status: 'healthy',
      portal_status: 'active',
      system_specs: {
        battery: 'SolarEdge Home Battery 4.6kWh',
        optimizer_count: 9,
        roof_orientation: 'south',
        panel_warranty_years: 25,
        inverter_warranty_years: 12,
        workmanship_warranty_years: 10,
      },
      installer_name: 'SE Systems',
      job_reference: 'SE-2026-0312',
      address_line_1: '12 Meadow Drive, Ballincollig',
      city: 'Cork',
      county: 'Cork',
      tenants: { installer_display_name: 'SE Systems', name: 'SE Systems' },
    };

    // Customer-facing installer name. Prefer the trading name; fall back
    // through legal name and the per-installation column. Never expose
    // tenants.name (legal entity) to the customer directly.
    const installerDisplayName: string =
      (installation as any).tenants?.installer_display_name
      || (installation as any).tenants?.name
      || installation.installer_name
      || 'your installer';

    // Service history. Loaded once per request and shared between the
    // system prompt context (so the assistant knows what records exist
    // even before deciding to call the tool) and the get_service_history
    // tool (which returns the full structured data the model needs to
    // produce a clean summary).
    const serviceHistory: ServiceRecord[] = installation.id
      ? await fetchServiceHistory(supabase, installation.id as string)
      : [];

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
        // Defence in depth on top of the explicit verifier above: join
        // through care_conversations and filter by installation_id, so even
        // if the verifier is ever bypassed or removed, the history query
        // itself can never return messages from another installation's
        // conversation.
        const { data: history } = await supabase
          .from('care_messages')
          .select('role, content, care_conversations!inner(installation_id)')
          .eq('conversation_id', conversation_id)
          .eq('care_conversations.installation_id', installationId)
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

    const address = [installation.address_line_1, installation.city, installation.county]
      .filter(Boolean).join(', ');

    const formatDate = (dateStr?: string | null) => {
      if (!dateStr) return 'not recorded';
      try {
        return new Date(dateStr).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
      } catch {
        return dateStr;
      }
    };

    const systemSummary = isHeatPumpSystem
      ? [
          `System: ${installation.system_size_kwp ? installation.system_size_kwp + ' kW ' : ''}Heat Pump`,
          `Model: ${installation.heat_pump_model || specs.model || 'unknown model'}`,
          `Type: ${specs.type || 'Air-to-Water heat pump'}`,
          `Capacity: ${installation.system_specs?.capacity_heating || specs.capacity_heating || 'unknown'}`,
          `Refrigerant: ${specs.refrigerant || 'R32'}`,
          `Smart Control: ${specs.smart_control || specs.controlModule || 'standard controller'}`,
          address ? `Address: ${address}` : null,
          `Installed: ${formatDate(installation.install_date)}`,
          `Warranty expires: ${formatDate(installation.warranty_expiry)}`,
          `Avg COP: ${baseline.average_cop || 'not recorded'}`,
          `Annual heating: ${baseline.annual_heating_kwh ? baseline.annual_heating_kwh + ' kWh' : 'not recorded'}`,
          `Installer: ${installerDisplayName}`,
          installation.job_reference ? `Job reference: ${installation.job_reference}` : null,
        ].filter(Boolean).join('\n')
      : [
          `System: ${installation.system_size_kwp ? installation.system_size_kwp + ' kWp ' : ''}Solar PV`,
          `Inverter: ${installation.inverter_model || 'unknown'}`,
          `Panels: ${installation.panel_count ? installation.panel_count + 'x ' + installation.panel_model : specs.panels || 'not recorded'}`,
          specs.battery ? `Battery: ${specs.battery}` : null,
          address ? `Address: ${address}` : null,
          `Installed: ${formatDate(installation.install_date)}`,
          `Warranty expires: ${formatDate(installation.warranty_expiry)}`,
          `Installer: ${installerDisplayName}`,
          installation.job_reference ? `Job reference: ${installation.job_reference}` : null,
        ].filter(Boolean).join('\n');

    // Service history summary for the system prompt. Kept brief so the model
    // has the right framing (you DO have access to this data) without the
    // full record bodies polluting the context. The get_service_history
    // tool returns the full structured records when the model decides to
    // surface them.
    const serviceHistorySummary = serviceHistory.length === 0
      ? 'Service history: no records logged yet.'
      : `Service history: ${serviceHistory.length} record${serviceHistory.length === 1 ? '' : 's'} on file. Most recent: ${serviceHistory[0].service_date}${serviceHistory[0].service_type ? ` (${serviceHistory[0].service_type})` : ''}. Call get_service_history to surface the details.`;

    const seSystemsContext = isSeSystemsInstallation(installation)
      ? `\n${getSeSystemsInstallerContext()}`
      : '';

    const customerName = installation.customer_name || 'the homeowner';
    const customerAddress = address || 'their installation';

    const systemPrompt = `You are the OpenHouse Care assistant for ${installerDisplayName}'s customer at ${customerAddress}.

You are not a general chatbot. You know this one specific install and you talk like an Irish service person who works on these systems for a living. Plain English, no filler, no flourish. If a sentence can end earlier and still make sense, end it earlier.

WHAT YOU CAN AND CAN'T DO

You can read:
- The installation manifest below (system type, model, install date, warranty)
- Service history on file for this installation (use get_service_history)
- Documents attached by ${installerDisplayName}

You cannot read:
- Live energy production, real-time output, today's generation figures
- The inverter's current fault state or real-time status
- Anything the homeowner has not told you and that is not in the manifest

You can draft:
- A service request to ${installerDisplayName} (use draft_service_request)
- An email or message the homeowner can send the installer

You cannot send anything. Drafts are reviewed and sent by the homeowner. You never say "I have sent" or "I'll send that off." If a homeowner asks you to send, draft it and say it is ready for them to review and send.

NON-NEGOTIABLE RULES

1. No estimation. Ever.
   If the homeowner asks how much energy they produced, used, saved, exported, or anything else that needs a real reading, you do not have it. You do not make one up. You do not extrapolate from system size, Irish averages, seasonal multipliers, or anything else. The exact reply is:
     "I don't have live data from your system yet. ${installerDisplayName} will have those figures."
   If the homeowner pushes ("rough idea", "best guess", "ballpark"), you still do not guess. Offer to draft a message to ${installerDisplayName} asking for the figure instead.

2. Anchor to this install. General energy or renewables questions ("is a heat pump better than gas?") get answered in terms of THIS install ("you've got a ${isHeatPumpSystem ? 'heat pump' : 'solar PV system'}, here is what that means for you"), not a generic comparison.

3. Never call them by the legal name. The customer-facing name for the installer is "${installerDisplayName}". Do not introduce any other company name for the installer, even if you think you know it.

4. Faults always go through the knowledge base. Any error code, red light, "not working", or symptom: call troubleshoot_issue first. Do not answer troubleshooting from training.

5. Voice. None of the following appear in your output, ever:
   - Filler invitations to keep asking questions
   - Generic chatbot greetings used as sign-offs at the end of a reply
   - Email-style well-wishes at the start of a drafted message
   - Apologetic boilerplate that pads the reply without adding information
   - Volunteering enthusiasm verbs at the start of a response
   - Exclamation-mark openers that flatter the question
   - Em dashes (use commas, full stops, or colons)
   Do not echo back what the homeowner just said before answering. They already know what they told you.

6. Safety: electrical faults you can smell or see, gas smells, water damage, anything dangerous: tell them to stop, isolate the system if safe, and call ${installerDisplayName} now.

DRAFTED MESSAGES TO ${installerDisplayName.toUpperCase()}

When you draft, keep it the way a homeowner would actually write it:
  Hi,
  My ${isHeatPumpSystem ? 'heat pump' : 'solar system'} at ${customerAddress} has [specific issue].
  Job ref: ${installation.job_reference || '[ref]'}.
  Can someone take a look?
  Thanks.

Short. Direct. Job reference included. No email-style well-wishes at the top. No "per our previous correspondence" style padding. No boilerplate.

INSTALLATION

Customer: ${customerName}
${systemSummary}
Health: ${installation.health_status || 'healthy'}
${serviceHistorySummary}
Today: ${today}
${seSystemsContext}
${careKnowledgeContext ? `\n${careKnowledgeContext}` : ''}`;

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
        const result = await executeTool(call.function.name, args, installation, { supabase, serviceHistory });

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
