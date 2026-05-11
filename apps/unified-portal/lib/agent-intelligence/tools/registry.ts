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
import { createViewing } from './viewing-tools';
import { manageApplicants } from './applicant-tools';
import { scheduleViewings } from './composite-tools';
// schedule_viewing (immediate-write) is intentionally NOT imported here.
// All viewing scheduling goes through schedule_viewings (composite tool).
// The underlying scheduleViewing function remains exported from
// './write-tools' for any internal code path that still needs a direct
// insert.
//
// draft_message is also NOT imported from write-tools any more. It was a
// non-envelope "template helper" that let the model claim drafts were
// ready without anything landing in pending_drafts. Session 6D replaced
// it with draftMessageSkill() in agentic-skills.ts.
import {
  surfaceAgedContractsForSolicitor,
  draftViewingFollowup,
  weeklyMondayBriefing,
  draftLeaseRenewal,
  naturalQuery,
  draftMessageSkill,
  draftBuyerFollowups,
  getCandidateUnitsSkill,
  rankPipelineBuyers,
  createViewingSchedule,
  queryComplianceStatus,
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
    const profile = await getAgentProfileExtras(supabase, agentContext.agentProfileId).catch(() => null);
    agencyName = profile?.agencyName || '';
  }
  const skillCtx: SkillAgentContext = {
    agentProfileId: agentContext.agentProfileId,
    authUserId: agentContext.authUserId,
    displayName: agentContext.displayName,
    agencyName,
    mode: agentContext.mode,
    isDemoMode: agentContext.isDemoMode,
  };
  const raw = await fn(supabase, skillCtx, params);
  const envelope = await persistSkillEnvelope(supabase, raw, agentContext);
  return { data: envelope, summary: envelope.summary, coverage: envelope.coverage };
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
    description: 'Draft a single email or message to ONE recipient. Writes a draft to the agent\'s inbox and opens the approval drawer; the drawer controls whether it actually sends. Use this for "draft an email to X about Y" style requests. For multiple recipients in one go, prefer `draft_buyer_followups`. NOTE: recipient_name is OPTIONAL when related_unit is supplied — the skill derives the buyer from the unit\'s purchaser on file. "Reach out to number 3, Árdan View" is a valid call with NO recipient_name; just pass related_unit + related_scheme + context. In lettings mode, set recipient_type=\'tenant\' and either pass the tenant\'s name in recipient_name OR pass an address in related_property — the skill will resolve the tenant from the active tenancy at that address.',
    parameters: {
      type: 'object',
      properties: {
        recipient_type: { type: 'string', description: 'Type of recipient', enum: ['buyer', 'developer', 'solicitor', 'tenant'] },
        recipient_name: { type: 'string', description: 'Name of the recipient. OPTIONAL when related_unit (sales) or related_property (lettings) is supplied — the skill resolves the buyer or tenant from the record on file.' },
        context: { type: 'string', description: 'Body content only — what the message should cover, in the agent\'s own words. DO NOT include a greeting (no "Hi X,", "Hello,", "Dear X,") and DO NOT include a sign-off, signature, or company name. The skill template adds the greeting and the agent\'s own sign-off block automatically; passing them here causes duplicates in the final email.' },
        tone: { type: 'string', description: 'Message tone', enum: ['warm', 'formal', 'urgent', 'gentle_chase'] },
        related_unit: { type: 'string', description: 'Related unit number (sales mode)' },
        related_scheme: { type: 'string', description: 'Related scheme name (sales mode)' },
        related_property: { type: 'string', description: 'Related property address (lettings mode) — used with recipient_type=\'tenant\' to resolve the active tenancy.' },
        recipient_email: { type: 'string', description: 'Recipient email if known; otherwise leave empty and the drawer will show a placeholder for the agent to fill in.' },
      },
      required: ['recipient_type', 'context'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(draftMessageSkill, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'draft_buyer_followups',
    description: [
      'Draft follow-up emails for one or more buyers. One draft per unit; joint purchasers (e.g. "Laura Hayes and Dylan Rogers") at a single unit share ONE email addressed to both names.',
      'CRITICAL RULES:',
      '1. Each target unit_identifier must be a unit number the user explicitly named OR that a previous tool returned. Do NOT guess.',
      '2. The purpose parameter must match what the user is asking for. "Congratulate on keys" → congratulate_handover ONLY for units that have actually been handed over (handover_date present).',
      '3. If the user gave a count but no specific units, call get_candidate_units with the right intent first; do not pick units silently.',
      '4. The skill refuses to draft when the resolved unit does not satisfy the purpose (e.g. congratulate_handover for a unit with no handover_date). Surfaces skipped units via the envelope summary — relay those to the user.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        targets: {
          type: 'array',
          description: 'Units to draft emails for. One entry per unit; joint purchasers are NOT separate targets.',
          items: {
            type: 'object',
            properties: {
              unit_identifier: { type: 'string', description: 'Exact unit number or unit uid (e.g. "19", "Unit 37", "AV-36"). Matched exactly against units.unit_number then units.unit_uid — no wildcards, no buyer-name fuzz.' },
              scheme_name: { type: 'string', description: 'Name of the scheme the unit lives in. Required when the agent has multiple assigned schemes; otherwise optional.' },
              recipient_name: { type: 'string', description: 'Override the purchaser name if the agent named someone specifically. Usually leave blank so the skill greets the purchasers on file.' },
            },
            required: ['unit_identifier'],
          },
        },
        topic: { type: 'string', description: 'Full sentence describing the reason for the email, written in the agent\'s voice. Will appear as-is in the email body between the greeting and the closing line, so it MUST read as a complete sentence the agent would actually write. Example for chase: "I noticed your contracts haven\'t been signed yet — could you let me know where things stand?". Example for custom: "Wanted to flag that the kitchen selection deadline has been pushed to next Friday." NEVER pass a noun phrase, a verb phrase, or a fragment lifted from the user\'s prompt (e.g. "update on signing their contracts", "chase signing", "mortgage expiry"); rewrite the user\'s intent into a proper sentence the recipient could read back. DO NOT include a greeting (no "Hi X,", "Hello,", "Dear X,") and DO NOT include a sign-off, signature, or company name. The skill template adds the greeting and the agent\'s own sign-off block automatically; passing them here causes duplicates in the final email.' },
        tone: { type: 'string', description: 'Message tone', enum: ['warm', 'formal', 'urgent', 'gentle_chase'] },
        purpose: {
          type: 'string',
          description: 'Email intent — shapes subject + body template and drives the precondition check against the resolved unit. Defaults to chase.',
          enum: ['chase', 'congratulate_handover', 'introduce', 'update', 'custom'],
        },
        custom_instruction: { type: 'string', description: 'Required when purpose="custom". Free-text description of the email\'s intent; becomes the body lead.' },
      },
      required: ['targets'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(draftBuyerFollowups, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'get_candidate_units',
    description: 'Return units from the agent\'s assigned schemes filtered by INTENT, for use as clarification candidates when the user specified a count but no specific unit identifiers — and as the input source for criterion-based buyer chases ("buyers whose mortgage is expiring soon", "buyers who haven\'t signed yet"). Read-only — returns an envelope with zero drafts and the candidate list in the summary. ALWAYS call this BEFORE asking the user "which N units?" so the example set reflects the actual eligible pool.',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: 'Filter criterion. "handover" = units with handover_date (congratulate on keys). "overdue_contracts" = contracts issued >28d ago and unsigned. "sale_agreed" = sale_agreed but not yet signed/handed-over. "mortgage_expiring" = pipeline rows whose mortgage_expiry_date falls within the next 60 days and have not yet handed over. "all" = every unit.',
          enum: ['handover', 'overdue_contracts', 'sale_agreed', 'mortgage_expiring', 'all'],
        },
        scheme_name: { type: 'string', description: 'Optional — narrow the candidates to one scheme.' },
        limit: { type: 'number', description: 'Max candidates to return (default 6, max 20).' },
      },
      required: ['intent'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(getCandidateUnitsSkill, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'rank_pipeline_buyers',
    description: [
      "Rank the buyers in the agent's sales pipeline at a single scheme by likelihood to convert.",
      'Use this for "who is most likely to convert at Lakeside Manor", "which buyers should I chase first at Westfield Heights", "top 10 active buyers at this scheme" style questions, and as the input source when scheduling group viewings.',
      'The score is deterministic: stage progress, recency of last logged contact, days in pipeline, and viewing count. Tied scores fall back to last-contact-days desc → pipeline-age-days desc → buyer name asc for stable ordering.',
      'Terminal stages (handed_over, social_housing) are excluded from the eligible pool — these buyers are out of scope for further sales activity.',
      "Either development_id or scheme_name must be provided — the skill scopes to a single scheme. Cross-scheme ranking isn't supported in this version.",
      'Returns a list of ranked buyers with score and a one-line reason per buyer ("contacted 3 days ago, sale agreed, viewed twice").',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        development_id: { type: 'string', description: 'UUID of the scheme. Preferred when known (avoids alias lookup).' },
        scheme_name: { type: 'string', description: 'Scheme name (e.g. "Lakeside Manor"). Resolved against the agent\'s assigned schemes.' },
        limit: { type: 'number', description: 'Max buyers to return (default 10, max 50).' },
      },
      required: [],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(rankPipelineBuyers, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'create_viewing_schedule',
    description: [
      'Build a viewing schedule for a single scheme on a given date and propose specific timeslots to the top-ranked buyers in one batch.',
      'Use this for "draft a viewing schedule for Lakeside Manor this Saturday, 10 slots from 9–2, propose them to 10 active buyers" style requests.',
      'Behaviour: builds N timeslots between start_time and end_time at slot_duration_minutes spacing, ranks buyers internally (terminal stages excluded — handed_over and social_housing units never receive proposals), drafts one personalised email per buyer, and pre-persists matching agent_viewings rows as PENDING.',
      'Either development_id or scheme_name must be provided — the skill currently scopes to one scheme per call. If the user asks "across all my schemes", run separate calls per scheme or ask the user to pick one.',
      'Each email opens with the unit + scheme + date, then a stage-aware second sentence acknowledging the recipient\'s pipeline situation, then 2-3 specific slot options.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        development_id: { type: 'string', description: 'UUID of the scheme. Preferred when known.' },
        scheme_name: { type: 'string', description: 'Scheme name (e.g. "Lakeside Manor"). Resolved against the agent\'s assigned schemes.' },
        date: { type: 'string', description: 'Viewing date as ISO YYYY-MM-DD (e.g. "2026-05-09" for Saturday).' },
        start_time: { type: 'string', description: 'Schedule start time in 24-h or 12-h ("09:00", "9am").' },
        end_time: { type: 'string', description: 'Schedule end time in 24-h or 12-h ("14:00", "2pm").' },
        slot_duration_minutes: { type: 'number', description: 'Length of each slot in minutes (default 30, min 15, max 120).' },
        target_count: { type: 'number', description: 'Number of buyers to invite / slots to fill (default 10, max 20).' },
      },
      required: ['date', 'start_time', 'end_time'],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(createViewingSchedule, supabase, agentContext, params as any)) as ToolFunction,
  },
  {
    name: 'query_compliance_status',
    description: [
      'Read-only lettings compliance lookup. Answers questions like:',
      '"Which tenancies are missing a BER cert?", "Show me overdue gas safety", "Which BER certs expire in the next 60 days?", "What\'s my overall compliance score?", "Which tenancies are missing an RTB registration?".',
      'Mirrors the per-property Compliance tab logic: BER OK = ber_cert_number set OR ber_cert doc uploaded; Gas/Electrical/Lease OK = matching doc_type uploaded; RTB OK = vacant OR rtb_registration_number on file.',
      'Returns a one-sentence summary plus structured per-tenancy records via meta.records (capped at 50 with a "showing N of M" note when truncated).',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'expired', 'expiring_soon', 'missing'],
          description: '"all" (default) returns every record; "expired" = BER expired; "expiring_soon" = BER expiring within 60 days; "missing" = the specified document_type is not on file (or all dimensions when document_type=all).',
        },
        document_type: {
          type: 'string',
          enum: ['ber', 'gas_safety', 'electrical', 'rtb', 'signed_lease', 'all'],
          description: 'Restrict to one compliance dimension. Default "all". Note "expired"/"expiring_soon" only meaningfully apply to BER (other dimensions don\'t carry expiry dates in this schema).',
        },
      },
      required: [],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(queryComplianceStatus, supabase, agentContext, params as any)) as ToolFunction,
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
    name: 'surface_aged_contracts_for_solicitor',
    description: "Surface aged unsigned contracts (>6 weeks since contracts_issued_date) for solicitor follow-up. Returns a needs_recipient envelope listing the affected units; the agent must paste the solicitor's email address before any draft is generated. NOT for buyer chase emails — use draft_buyer_followups (with get_candidate_units first when no specific units are named) for that.",
    parameters: {
      type: 'object',
      properties: {
        threshold_days: { type: 'number', description: 'Age threshold in days (default 42)' },
        scheme_filter: { type: 'string', description: 'Optional scheme name filter (substring match)' },
      },
      required: [],
    },
    execute: ((supabase, _tenantId, agentContext, params) =>
      runAgenticSkill(surfaceAgedContractsForSolicitor, supabase, agentContext, params as any)) as ToolFunction,
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
    description: 'Draft lease renewal offers for tenancies in the renewal window (recently expired through next 90 days). Calculates RPZ-compliant rent uplift where applicable. Returns drafts for tenant approval. Pass `tenant_name` to scope to a single tenant when the user names one ("Aoife O\'Brien\'s renewal", "remind Mark"); fuzzy-matches against agent_tenancies.tenant_name. Pass nothing to draft for every tenancy in the window.',
    parameters: {
      type: 'object',
      properties: {
        tenancy_id: { type: 'string', description: 'Optional tenancy id to draft for a single renewal. Only pass when a previous tool result surfaced a real tenancy id; never invent one.' },
        tenant_name: { type: 'string', description: 'Optional tenant name (partial OK — "Aoife", "Mark Donnelly") to scope the renewal to one tenancy. Resolved server-side via fuzzy ILIKE match against agent_tenancies.tenant_name.' },
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
    name: 'manage_applicants',
    description: [
      'Add, update or remove applicants on the agent\'s books. Voice-first and paste-first — the agent says "add Jack Murphy 087 123 4567" or pastes a list of names from an email.',
      'NEVER writes on its own. Always returns a draft envelope; the agent confirms in the chat card. The agent\'s applicant_write_mode setting decides whether the card auto-confirms with undo (propose_undoable) or waits for an explicit tap (always_confirm). The mode is included in the result so the model can phrase its reply accordingly.',
      'Inputs by action:',
      '  add — pass `applicants` (one or more {full_name, email?, phone?, notes?, source?}) AND/OR `bulk_text` for raw pasted lists. The bulk parser is deterministic (regex over Irish phone formats and the common "Name <email>" / "Name (phone)" / comma / pipe / table shapes). Never invent email or phone — leave them null when the user did not provide them.',
      '  update — pass `applicant_id` plus `updates` (partial {full_name, email, phone, notes}). Only the fields that actually changed land in the draft.',
      '  remove — pass `applicant_ids` (string array). The skill flags any applicant with active enquiries or upcoming viewings as has_dependencies so the agent sees what they\'re losing.',
      'Dedupe rule: when the user references a name that case-insensitively matches an existing applicant, the candidate is classified `duplicate_likely` with the existing match surfaced; ask the user "Did you mean <existing_name>?" before adding a duplicate.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['add', 'update', 'remove'], description: 'What the user wants to do.' },
        applicants: {
          type: 'array',
          description: 'Applicants to add. One entry per applicant.',
          items: {
            type: 'object',
            properties: {
              full_name: { type: 'string', description: 'Full name as the user said it.' },
              email: { type: 'string', description: 'Email address. Only pass when the user gave one.' },
              phone: { type: 'string', description: 'Phone number. Only pass when the user gave one.' },
              notes: { type: 'string', description: 'Optional free-text note.' },
              source: { type: 'string', description: 'Origin tag (defaults to "intelligence").' },
            },
            required: ['full_name'],
          },
        },
        applicant_id: { type: 'string', description: 'Required for action=update.' },
        updates: {
          type: 'object',
          description: 'Partial fields to change for action=update.',
          properties: {
            full_name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            notes: { type: 'string' },
          },
        },
        applicant_ids: {
          type: 'array',
          description: 'Required for action=remove.',
          items: { type: 'string' },
        },
        bulk_text: { type: 'string', description: 'Raw pasted text the deterministic parser will turn into add candidates. Use when the user pastes a list.' },
      },
      required: ['action'],
    },
    execute: manageApplicants as ToolFunction,
  },
  {
    name: 'schedule_viewings',
    description: [
      'Composite scheduling tool. Use when the agent wants to schedule MORE THAN ONE viewing in one go, OR a single viewing for an applicant who is NOT yet on the books. The card surfaces one Confirm; the writes land atomically (applicants, audit log rows, and viewings together) so a property typo does not leave half the work done.',
      'For a single viewing for an existing applicant, use create_viewing instead. This composite tool is overkill for that.',
      'Inputs:',
      '- viewings: array of { applicant_name, scheduled_at_natural, property_hint?, duration_minutes?, notes? }, one entry per viewing.',
      '- calendar_preference (optional): pass when the user explicitly asked ("add it to my iPhone calendar"). Otherwise omit.',
      'NEVER invent email or phone for new applicants. Pass full_name only. The card lets the agent fill in details inline if they want.',
      'New applicants need a property_hint that maps to one of the agent\'s assigned schemes; otherwise the tool returns needs_clarification. One question maximum.',
      'Returns either { status: "draft", type: "composite_schedule", applicants_to_create, viewings_to_create, calendar, message } for the chat card to render, or { status: "needs_clarification", reason, message }. Do NOT echo the per-row details in your reply, the card is the canonical surface.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        viewings: {
          type: 'array',
          description: 'One entry per viewing. The same applicant_name appearing twice is fine, the tool dedupes for new-applicant creation.',
          items: {
            type: 'object',
            properties: {
              applicant_name: { type: 'string', description: 'Name of the person the viewing is for, exactly as the user said it.' },
              scheduled_at_natural: { type: 'string', description: 'Natural-language time, e.g. "Thursday 6pm". Parsed against Europe/Dublin.' },
              property_hint: { type: 'string', description: 'Development name. Required for new applicants since they have no enquiries yet.' },
              duration_minutes: { type: 'number', description: 'Defaults to 30. Clamped to 5-240.' },
              notes: { type: 'string', description: 'Optional note to record on the viewing.' },
            },
            required: ['applicant_name', 'scheduled_at_natural'],
          },
        },
        calendar_preference: {
          type: 'string',
          enum: ['device', 'google', 'outlook', 'apple', 'skip'],
          description: 'Pass when the user explicitly stated a calendar preference for these viewings.',
        },
      },
      required: ['viewings'],
    },
    execute: scheduleViewings as ToolFunction,
  },
  {
    name: 'create_viewing',
    description: [
      'Schedule a new property viewing for a known applicant. Voice-first entry point — the agent says "schedule a viewing with Jack Murphy Tuesday 6pm" and this resolves the applicant, the property and the time, then returns a draft for the agent to confirm.',
      'NEVER writes on its own — always returns either a draft for confirmation or a needs_clarification with one targeted question.',
      'Resolution rules:',
      '- Applicant: ilike match on agent_applicants.full_name within the agent\'s tenant. Zero matches → needs_clarification (applicant_not_found). Multiple matches → needs_clarification (applicant_ambiguous) with the candidate list.',
      '- Property: pulled from the applicant\'s active enquiries. Single match → use it. Multiple → use property_hint (ilike on development name) when supplied; otherwise needs_clarification (property_ambiguous).',
      '- Date / time: parsed against Europe/Dublin. Bare weekday means the next occurrence; if today is that weekday, defaults to next week unless the time is still ahead today.',
      'When fully resolved, returns { status: "draft", draft, message: "Confirm to create this viewing" }. The chat surface renders a viewing card from the draft — DO NOT echo the draft fields in your reply, the card is the canonical surface.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        applicant_name: { type: 'string', description: 'Full or partial applicant name as the agent said it. Resolved server-side via ilike on agent_applicants.full_name.' },
        property_hint: { type: 'string', description: 'Optional development-name hint when the applicant has enquiries on more than one scheme.' },
        scheduled_at_natural: { type: 'string', description: 'Natural-language date and time, e.g. "Tuesday 6pm", "tomorrow at 11", "next Monday 3pm". Parsed against Europe/Dublin.' },
        duration_minutes: { type: 'number', description: 'Viewing length in minutes. Defaults to 30. Clamped to 5-240.' },
        notes: { type: 'string', description: 'Optional notes captured from the agent\'s instruction (parking, joint viewing, anything specific).' },
      },
      required: ['applicant_name', 'scheduled_at_natural'],
    },
    execute: createViewing as ToolFunction,
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
