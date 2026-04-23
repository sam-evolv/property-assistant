import { SupabaseClient } from '@supabase/supabase-js';
import { AgentContext, ToolDefinition, ToolFunction, ToolResult } from '../types';
import { getAgentProfileExtras } from '../context';
import {
  getUnitStatus,
  getBuyerDetails,
  getSchemeOverview,
  getSchemeSummary,
  getOutstandingItems,
  getCommunicationHistory,
  getViewings,
  searchKnowledgeBase,
} from './read-tools';
import {
  createTask,
  logCommunication,
  generateDeveloperReport,
} from './write-tools';
// schedule_viewing is intentionally NOT imported here: its immediate-write
// behaviour has been replaced by schedule_viewing_draft. The underlying
// scheduleViewing function remains exported from './write-tools' for any
// internal code path that still needs a direct insert.
//
// draft_message is also NOT imported from write-tools any more — it was a
// non-envelope "template helper" that let the model claim drafts were
// ready without anything landing in pending_drafts. Session 6D replaced
// it with draftMessageSkill() in agentic-skills.ts.
import {
  chaseAgedContracts,
  draftViewingFollowup,
  weeklyMondayBriefing,
  draftLeaseRenewal,
  naturalQuery,
  scheduleViewingDraft,
  draftMessageSkill,
  draftBuyerFollowups,
  SkillAgentContext,
} from './agentic-skills';
import type { AgenticSkillEnvelope } from '../envelope';
import { persistSkillEnvelope } from '../draft-store';

// Adapter between the model-facing ToolFunction signature (which operates on
// AgentContext and returns ToolResult) and the agentic-skill signature (which
// takes a SkillAgentContext and returns an AgenticSkillEnvelope). After the
// skill produces the envelope we funnel it through persistSkillEnvelope so
// every draft in `drafts[]` becomes a real `pending_drafts.id` before the
// chat route streams the envelope to the client.
async function runAgenticSkill<I extends Record<string, any>>(
  fn: (
    supabase: SupabaseClient,
    skillCtx: SkillAgentContext,
    inputs: I,
  ) => Promise<AgenticSkillEnvelope>,
  supabase: SupabaseClient,
  agentContext: AgentContext,
  params: I,
): Promise<ToolResult> {
  // `agentContext.agencyName` is populated up-front by `resolveAgentContext`,
  // so a second lookup is avoided on every skill call. Fall back to the
  // extras loader only when the context did not carry it.
  let agencyName = agentContext.agencyName ?? '';
  if (!agencyName) {
    const profile = await getAgentProfileExtras(supabase, agentContext.agentId).catch(() => null);
    agencyName = profile?.agencyName || '';
  }
  const skillCtx: SkillAgentContext = {
    agentId: agentContext.agentId,
    userId: agentContext.userId,
    displayName: agentContext.displayName,
    agencyName,
  };
  const raw = await fn(supabase, skillCtx, params);
  const envelope = await persistSkillEnvelope(supabase, raw, agentContext);
  return { data: envelope, summary: envelope.summary };
}

export const AGENT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_unit_status',
    description: 'Get the current status of a specific unit in a scheme, including buyer details, pipeline stage, key dates, and outstanding items.',
    parameters: {
      type: 'object',
      properties: {
        scheme_name: { type: 'string', description: 'Name of the development/scheme' },
        unit_identifier: { type: 'string', description: 'Unit number, house number, or address fragment' },
      },
      required: ['scheme_name', 'unit_identifier'],
    },
    execute: getUnitStatus as ToolFunction,
  },
  {
    name: 'get_buyer_details',
    description: 'Look up a buyer by name across all assigned schemes. Returns full buyer profile with all associated units.',
    parameters: {
      type: 'object',
      properties: {
        buyer_name: { type: 'string', description: 'Full or partial buyer name' },
      },
      required: ['buyer_name'],
    },
    execute: getBuyerDetails as ToolFunction,
  },
  {
    name: 'get_scheme_overview',
    description: 'Get a high-level summary of a scheme sales status, including unit breakdown by status, outstanding items, and key metrics. If scheme_name is omitted and the agent has exactly one assigned scheme, defaults to that scheme.',
    parameters: {
      type: 'object',
      properties: {
        scheme_name: { type: 'string', description: 'Name of the development/scheme (optional if the agent has a single assigned scheme)' },
      },
      required: [],
    },
    execute: getSchemeOverview as ToolFunction,
  },
  {
    name: 'get_scheme_summary',
    description: "Answer 'give me a scheme summary' with real numbers: total units, status breakdown (for_sale, reserved, sale_agreed, in_progress, signed, handed_over), total revenue committed, average price, overdue contract count, and the top 3 suggested next actions. Scoped to the agent's assigned developments unless a specific scheme_name is given — in which case the scheme must be in the agent's assigned list.",
    parameters: {
      type: 'object',
      properties: {
        scheme_name: { type: 'string', description: 'Optional scheme name. When omitted, summarises across every assigned scheme.' },
      },
      required: [],
    },
    execute: getSchemeSummary as ToolFunction,
  },
  {
    name: 'get_outstanding_items',
    description: 'Get all outstanding action items across one or all schemes, sorted by urgency. Includes unsigned contracts, overdue selections, and agent tasks.',
    parameters: {
      type: 'object',
      properties: {
        scheme_name: { type: 'string', description: 'Name of the scheme (optional — all schemes if omitted)' },
        category: { type: 'string', description: 'Filter by category', enum: ['contracts', 'selections', 'mortgage', 'documents', 'snagging', 'all'] },
        days_ahead: { type: 'string', description: 'Look-ahead window in days (default 14)' },
      },
      required: [],
    },
    execute: getOutstandingItems,
  },
  {
    name: 'get_communication_history',
    description: 'Get the communication history for a specific buyer or unit, showing all logged interactions.',
    parameters: {
      type: 'object',
      properties: {
        unit_identifier: { type: 'string', description: 'Unit number or identifier' },
        buyer_name: { type: 'string', description: 'Buyer name to filter by' },
        scheme_name: { type: 'string', description: 'Scheme name for context' },
        limit: { type: 'string', description: 'Number of results (default 10)' },
      },
      required: [],
    },
    execute: getCommunicationHistory,
  },
  {
    name: 'get_viewings',
    description: 'Get upcoming viewings for the agent, optionally filtered by scheme, buyer, or date range.',
    parameters: {
      type: 'object',
      properties: {
        scheme_name: { type: 'string', description: 'Filter by scheme/development name' },
        buyer_name: { type: 'string', description: 'Filter by buyer name' },
        from_date: { type: 'string', description: 'Start date (ISO format, defaults to today)' },
        to_date: { type: 'string', description: 'End date (ISO format)' },
        status: { type: 'string', description: 'Filter by status', enum: ['confirmed', 'pending', 'completed', 'cancelled', 'no_show'] },
      },
      required: [],
    },
    execute: getViewings,
  },
  {
    name: 'search_knowledge_base',
    description: 'Search the OpenHouse knowledge base for information about regulations, processes, schemes, or any indexed documentation.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' },
        scope: { type: 'string', description: 'Search scope', enum: ['regulatory', 'scheme_docs', 'all'] },
      },
      required: ['query'],
    },
    execute: searchKnowledgeBase as ToolFunction,
  },
  {
    name: 'create_task',
    description: 'Create a task or reminder for the agent. Tasks are displayed in the agent task list.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title' },
        description: { type: 'string', description: 'Detailed description' },
        due_date: { type: 'string', description: 'ISO date for when the task is due' },
        priority: { type: 'string', description: 'Task priority', enum: ['critical', 'high', 'medium', 'low'] },
        related_unit_id: { type: 'string', description: 'Link to a specific unit' },
        related_buyer_id: { type: 'string', description: 'Link to a specific buyer' },
        related_scheme_id: { type: 'string', description: 'Link to a specific scheme' },
      },
      required: ['title'],
    },
    execute: createTask as ToolFunction,
  },
  {
    name: 'log_communication',
    description: 'Log a communication event (phone call, meeting, etc.) that happened outside the platform. This will be visible to the developer.',
    parameters: {
      type: 'object',
      properties: {
        unit_identifier: { type: 'string', description: 'Unit number or buyer name' },
        scheme_name: { type: 'string', description: 'Name of the scheme' },
        type: { type: 'string', description: 'Communication type', enum: ['phone', 'whatsapp', 'email', 'in_person', 'text'] },
        direction: { type: 'string', description: 'Direction of communication', enum: ['inbound', 'outbound'] },
        summary: { type: 'string', description: 'Brief summary of what was discussed' },
        outcome: { type: 'string', description: 'Result of the communication' },
        follow_up_required: { type: 'string', description: 'Whether follow-up is needed (true/false)' },
        follow_up_date: { type: 'string', description: 'ISO date for follow-up' },
      },
      required: ['unit_identifier', 'scheme_name', 'type', 'direction', 'summary'],
    },
    execute: logCommunication as ToolFunction,
  },
  {
    name: 'draft_message',
    description: 'Draft a single email or message to ONE named recipient. Writes a draft to the agent\'s inbox and opens the approval drawer; the drawer controls whether it actually sends. Use this for "draft an email to X about Y" style requests. For multiple recipients in one go, prefer `draft_buyer_followups`.',
    parameters: {
      type: 'object',
      properties: {
        recipient_type: { type: 'string', description: 'Type of recipient', enum: ['buyer', 'developer', 'solicitor'] },
        recipient_name: { type: 'string', description: 'Name of the recipient' },
        context: { type: 'string', description: 'What the message should cover, in the agent\'s own words — this becomes the body.' },
        tone: { type: 'string', description: 'Message tone', enum: ['warm', 'formal', 'urgent', 'gentle_chase'] },
        related_unit: { type: 'string', description: 'Related unit number' },
        related_scheme: { type: 'string', description: 'Related scheme name' },
        recipient_email: { type: 'string', description: 'Recipient email if known; otherwise leave empty and the drawer will show a placeholder for the agent to fill in.' },
      },
      required: ['recipient_type', 'recipient_name', 'context'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(draftMessageSkill, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'draft_buyer_followups',
    description: 'Draft emails to a SPECIFIC list of units / buyers in one call. Each target produces ONE draft per unit in the approval drawer — joint purchasers (e.g. "Laura Hayes and Dylan Rogers" at a single unit) receive one email addressed to both names, not two separate drafts. Pick the `purpose` carefully: "chase" for overdue follow-ups, "congratulate_handover" for welcome-after-keys, "introduce" for first contact, "update" for generic status news, "custom" when none fit (then pass `custom_instruction`). If the user named a count but NOT specific units, do NOT invent targets — ask which units first.',
    parameters: {
      type: 'object',
      properties: {
        targets: {
          type: 'array',
          description: 'Units to draft emails for. One entry per unit; joint purchasers are NOT separate targets.',
          items: {
            type: 'object',
            properties: {
              unit_identifier: { type: 'string', description: 'Unit number or unit reference (e.g. "19", "Unit 37", "AV-36").' },
              scheme_name: { type: 'string', description: 'Name of the scheme the unit lives in. Optional when the agent only has one assigned scheme.' },
              recipient_name: { type: 'string', description: 'Override the purchaser name on the unit if the agent named someone specifically.' },
            },
            required: ['unit_identifier'],
          },
        },
        topic: { type: 'string', description: 'Shared topic / reason for the email. For chases: "asking when they expect to sign the contracts". For congratulate_handover: a personal note (optional — there\'s a sensible default). Becomes the lead of each email body.' },
        tone: { type: 'string', description: 'Message tone', enum: ['warm', 'formal', 'urgent', 'gentle_chase'] },
        purpose: {
          type: 'string',
          description: 'Email intent. Defaults to "chase" if omitted.',
          enum: ['chase', 'congratulate_handover', 'introduce', 'update', 'custom'],
        },
        custom_instruction: { type: 'string', description: 'Required when purpose="custom". Describes the email\'s intent and becomes the body lead (e.g. "price reduction notice for the vendor").' },
      },
      required: ['targets'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(draftBuyerFollowups, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'generate_developer_report',
    description: 'Generate a weekly/periodic sales update report for a specific developer, summarising all activity across their schemes.',
    parameters: {
      type: 'object',
      properties: {
        developer_name: { type: 'string', description: 'Name of the developer' },
        period: { type: 'string', description: 'Report period', enum: ['week', 'fortnight', 'month'] },
      },
      required: ['developer_name'],
    },
    execute: generateDeveloperReport as ToolFunction,
  },
  // -------------------------------------------------------------------
  // Agentic skills (approval-first). Each execute() returns an
  // AgenticSkillEnvelope wrapped in ToolResult.data — no side effects
  // land until the /confirm endpoint approves the drafts.
  // -------------------------------------------------------------------
  {
    name: 'chase_aged_contracts',
    description: "Find contracts issued over 6 weeks ago that haven't been signed, and draft solicitor chase emails for each. Returns drafts for agent approval before any email is sent.",
    parameters: {
      type: 'object',
      properties: {
        threshold_days: { type: 'number', description: 'Age threshold in days (default 42)' },
        scheme_filter: { type: 'string', description: 'Optional scheme name filter (substring match)' },
      },
      required: [],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(chaseAgedContracts, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'draft_viewing_followup',
    description: 'Draft follow-up emails to buyers who attended viewings in the last 24 hours. Returns drafts for agent approval.',
    parameters: {
      type: 'object',
      properties: {
        window_hours: { type: 'number', description: 'Look-back window in hours (default 24)' },
      },
      required: [],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(draftViewingFollowup, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'weekly_monday_briefing',
    description: "Generate a Monday morning briefing covering sales movement, lettings renewals, rent arrears, week's viewings, and items needing attention.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(weeklyMondayBriefing, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'draft_lease_renewal',
    description: 'Draft lease renewal offers for tenancies ending in the next 90 days. Calculates RPZ-compliant rent uplift where applicable. Returns drafts for tenant approval.',
    parameters: {
      type: 'object',
      properties: {
        tenancy_id: { type: 'string', description: 'Optional tenancy id to draft for a single renewal' },
      },
      required: [],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(draftLeaseRenewal, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'natural_query',
    description: "Answer natural-language questions about the agent's pipeline, lettings, viewings, or tenancies. Uses safe pre-built query templates.",
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The natural-language question' },
      },
      required: ['question'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(naturalQuery, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'schedule_viewing_draft',
    description: 'Prepare a new viewing: resolves the property reference, checks for conflicts, and drafts both the viewing record and a confirmation email. Agent must approve before the viewing is created or the email sent.',
    parameters: {
      type: 'object',
      properties: {
        unit_or_property_ref: { type: 'string', description: 'Sales unit reference (e.g. "Árdan View Unit 50") or letting property address fragment' },
        buyer_name: { type: 'string', description: 'Buyer name' },
        buyer_email: { type: 'string', description: 'Buyer email' },
        buyer_phone: { type: 'string', description: 'Buyer phone' },
        preferred_datetime: { type: 'string', description: 'Preferred viewing datetime in ISO 8601 format' },
      },
      required: ['unit_or_property_ref', 'buyer_name', 'preferred_datetime'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(scheduleViewingDraft, supabase, agentContext, params as any)) as ToolFunction,
  },
];

export function getToolDefinitionsForOpenAI(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}> {
  return AGENT_TOOL_DEFINITIONS.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return AGENT_TOOL_DEFINITIONS.find(t => t.name === name);
}
