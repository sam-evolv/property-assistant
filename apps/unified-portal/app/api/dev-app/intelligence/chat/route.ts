import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, getSupabaseAdmin } from '@/lib/supabase-server';
import OpenAI from 'openai';
import {
  PIPELINE_SELECT_COLUMNS,
  PIPELINE_STAGES,
  derivePipelineStage,
  daysAtStage,
  mapComplianceStatus,
} from '@/lib/dev-app/pipeline-helpers';

interface PipelineData {
  unit_id: string;
  purchaser_name?: string | null;
  purchaser_email?: string | null;
  purchaser_phone?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Tool definitions for OpenAI function calling
const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'lookup_unit',
      description: 'Look up detailed information about a specific unit',
      parameters: {
        type: 'object',
        properties: {
          unit_identifier: {
            type: 'string',
            description: "Unit number or name, e.g. 'Unit 35' or '35'",
          },
          development_id: {
            type: 'string',
            description: 'Optional development ID to narrow search',
          },
        },
        required: ['unit_identifier'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_pipeline',
      description: 'Query pipeline data with filters. Stages: Released, Sale Agreed, Deposit Received, Contracts Issued, Contracts Signed, Counter Signed, Kitchen Complete, Snagging Complete, Drawdown, Handover Complete',
      parameters: {
        type: 'object',
        properties: {
          development_id: { type: 'string' },
          stage: { type: 'string', description: 'Stage name to filter by (partial match)' },
          days_at_stage_min: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_compliance',
      description: 'Check compliance status across units',
      parameters: {
        type: 'object',
        properties: {
          development_id: { type: 'string' },
          document_type: { type: 'string', description: 'Document type name to filter by (partial match)' },
          status: { type: 'string', enum: ['complete', 'pending', 'missing', 'overdue'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_selections',
      description: 'Check kitchen/selection status for units',
      parameters: {
        type: 'object',
        properties: {
          development_id: { type: 'string' },
          status: { type: 'string', enum: ['confirmed', 'pending'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_snagging',
      description: 'Look up snagging items',
      parameters: {
        type: 'object',
        properties: {
          development_id: { type: 'string' },
          unit_id: { type: 'string' },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_email',
      description: 'Draft an email (shows preview to developer before sending)',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          related_units: { type: 'array', items: { type: 'string' } },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_pipeline_stage',
      description: 'Move a unit to a new pipeline stage (confirm before executing). Valid stages: Released, Sale Agreed, Deposit Received, Contracts Issued, Contracts Signed, Counter Signed, Kitchen Complete, Snagging Complete, Drawdown, Handover Complete',
      parameters: {
        type: 'object',
        properties: {
          unit_id: { type: 'string' },
          new_stage: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['unit_id', 'new_stage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_attention_items',
      description: 'Get current attention/alert items across developments',
      parameters: {
        type: 'object',
        properties: {
          development_id: { type: 'string' },
          severity: { type: 'string', enum: ['red', 'amber', 'all'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_unit_status',
      description:
        "Update the status of one or more units in a development. Use for requests like 'mark unit 3 as complete', 'set unit 20 to sale agreed', 'mark units 1-5 as available'. Valid statuses: available, sale_agreed, in_progress, complete, social_housing, occupied, handed_over, maintenance, vacant, void, withdrawn.",
      parameters: {
        type: 'object',
        properties: {
          scheme_id: {
            type: 'string',
            description: 'The development ID (UUID from YOUR DEVELOPMENTS context)',
          },
          units: {
            type: 'array',
            description: 'Array of unit updates to perform',
            items: {
              type: 'object',
              properties: {
                unit_id: {
                  type: 'string',
                  description: 'The unit UUID from the database',
                },
                unit_reference: {
                  type: 'string',
                  description: 'Human-readable unit number e.g. 3, 20, 45',
                },
                current_status: {
                  type: 'string',
                  description: 'The current status value from the database',
                },
                new_status: {
                  type: 'string',
                  enum: ['available', 'sale_agreed', 'in_progress', 'complete', 'social_housing', 'occupied', 'handed_over', 'maintenance', 'vacant', 'void', 'withdrawn'],
                },
              },
              required: ['unit_id', 'unit_reference', 'current_status', 'new_status'],
            },
          },
          reason: {
            type: 'string',
            description:
              'Brief plain-English summary of what is being changed and why, as understood from the user instruction',
          },
        },
        required: ['scheme_id', 'units', 'reason'],
      },
    },
  },
];

// Tool execution functions
async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  devIds: string[]
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  // Get all unit IDs for this developer (include status for write operations)
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, development_id, unit_status')
    .in('development_id', devIds);

  const allUnits: { id: string; unit_number: string; development_id: string; unit_status: string }[] = units || [];
  const unitIds = allUnits.map((u) => u.id);

  switch (toolName) {
    case 'lookup_unit': {
      const identifier = (args.unit_identifier as string).replace(/[^0-9a-zA-Z]/g, '');
      let matchingUnits = allUnits.filter(
        (u) =>
          u.unit_number === identifier ||
          u.unit_number === args.unit_identifier ||
          u.unit_number.toLowerCase().includes(identifier.toLowerCase())
      );

      if (args.development_id) {
        matchingUnits = matchingUnits.filter(
          (u) => u.development_id === args.development_id
        );
      }

      if (matchingUnits.length === 0) {
        return { found: false, message: `No unit found matching "${args.unit_identifier}"` };
      }

      const unit = matchingUnits[0];

      // Get pipeline info (includes purchaser data)
      const { data: pipeline } = await supabase
        .from('unit_sales_pipeline')
        .select(PIPELINE_SELECT_COLUMNS)
        .eq('unit_id', unit.id)
        .maybeSingle() as unknown as { data: PipelineData | null };

      // Get compliance docs with type names
      const { data: compDocs } = await supabase
        .from('compliance_documents')
        .select('id, status, compliance_document_types!inner(name)')
        .eq('unit_id', unit.id);

      // Get kitchen selections
      const { data: selections } = await supabase
        .from('kitchen_selections')
        .select('has_kitchen, counter_type, unit_finish, handle_style')
        .eq('unit_id', unit.id);

      // Get snag items
      const { data: snags } = await supabase
        .from('snag_items')
        .select('description, status')
        .eq('unit_id', unit.id);

      // Get development name
      const { data: dev } = await supabase
        .from('developments')
        .select('name')
        .eq('id', unit.development_id)
        .single();

      const fields: { label: string; value: string; status: string }[] = [];
      const sel = selections?.[0];
      if (sel) {
        const kitchenChoice = sel.has_kitchen
          ? [sel.counter_type, sel.unit_finish, sel.handle_style].filter(Boolean).join(', ') || 'Selected'
          : 'Not selected';
        fields.push({
          label: 'Kitchen',
          value: kitchenChoice,
          status: sel.has_kitchen ? 'complete' : 'pending',
        });
      }

      (compDocs || []).forEach((d: { status: string; compliance_document_types?: { name: string } | null }) => {
        const displayStatus = mapComplianceStatus(d.status);
        const docName = d.compliance_document_types?.name || 'Document';
        fields.push({
          label: docName,
          value: displayStatus,
          status: displayStatus === 'complete' ? 'complete' : displayStatus === 'overdue' ? 'overdue' : 'pending',
        });
      });

      if (pipeline) {
        const derived = derivePipelineStage(pipeline);
        fields.push({
          label: 'Pipeline Stage',
          value: derived.stage,
          status: 'complete',
        });
      }

      const openSnags = (snags || []).filter((s: { description: string; status: string }) => s.status !== 'resolved');
      if (openSnags.length > 0) {
        fields.push({
          label: 'Open Snags',
          value: `${openSnags.length} item${openSnags.length > 1 ? 's' : ''}`,
          status: 'overdue',
        });
      }

      const derived = pipeline ? derivePipelineStage(pipeline) : null;
      return {
        found: true,
        unit_info: {
          unit_id: unit.id,
          unit_name: `Unit ${unit.unit_number}`,
          development_name: dev?.name || 'Unknown',
          fields,
        },
        purchaser: pipeline?.purchaser_name || null,
        pipeline: derived
          ? { stage: derived.stage, purchaser_email: pipeline?.purchaser_email }
          : null,
      };
    }

    case 'query_pipeline': {
      let filteredUnitIds = unitIds;
      if (args.development_id) {
        filteredUnitIds = allUnits
          .filter((u) => u.development_id === args.development_id)
          .map((u) => u.id);
      }

      if (filteredUnitIds.length === 0) {
        return { count: 0, pipeline: [] };
      }

      const { data: pipelineRows } = await supabase
        .from('unit_sales_pipeline')
        .select(PIPELINE_SELECT_COLUMNS)
        .in('unit_id', filteredUnitIds);

      let results = (pipelineRows || []).map((p: Record<string, unknown>) => ({
        ...p,
        ...derivePipelineStage(p),
        days: daysAtStage(p),
      }));

      if (args.stage) {
        const stageFilter = (args.stage as string).toLowerCase();
        results = results.filter((p) =>
          p.stage.toLowerCase().includes(stageFilter)
        );
      }

      if (args.days_at_stage_min) {
        results = results.filter((p) => p.days >= (args.days_at_stage_min as number));
      }

      const enriched = results.map((p) => {
        const unit = allUnits.find((u) => u.id === p.unit_id);
        return {
          unit_number: unit?.unit_number || 'Unknown',
          stage: p.stage,
          days: p.days,
        };
      });

      return { count: enriched.length, pipeline: enriched };
    }

    case 'query_compliance': {
      let filteredUnitIds = unitIds;
      if (args.development_id) {
        filteredUnitIds = allUnits
          .filter((u) => u.development_id === args.development_id)
          .map((u) => u.id);
      }

      if (filteredUnitIds.length === 0) {
        return { count: 0, documents: [] };
      }

      // Map display status to DB status for filtering
      const dbStatusMap: Record<string, string> = {
        complete: 'verified',
        pending: 'uploaded',
        overdue: 'expired',
        missing: 'missing',
      };

      let query = supabase
        .from('compliance_documents')
        .select('unit_id, status, compliance_document_types!inner(name)')
        .in('unit_id', filteredUnitIds);

      if (args.status) {
        const dbStatus = dbStatusMap[args.status as string] || args.status;
        query = query.eq('status', dbStatus as string);
      }

      const { data: docs } = await query;
      let filteredDocs = docs || [];

      // Filter by document type name (in JS since it's from a join)
      if (args.document_type) {
        const typeFilter = (args.document_type as string).toLowerCase();
        filteredDocs = filteredDocs.filter((d) => {
          const docTypes = d.compliance_document_types as { name: string } | null;
          return (docTypes?.name || '').toLowerCase().includes(typeFilter);
        });
      }

      const enriched = filteredDocs.map((d) => {
        const unit = allUnits.find((u) => u.id === d.unit_id);
        const docTypes = d.compliance_document_types as { name: string } | null;
        return {
          unit_number: unit?.unit_number || 'Unknown',
          document_type: docTypes?.name || 'Unknown',
          status: mapComplianceStatus(d.status),
        };
      });

      return { count: enriched.length, documents: enriched };
    }

    case 'query_selections': {
      let filteredUnitIds = unitIds;
      if (args.development_id) {
        filteredUnitIds = allUnits
          .filter((u) => u.development_id === args.development_id)
          .map((u) => u.id);
      }

      if (filteredUnitIds.length === 0) {
        return { count: 0, selections: [] };
      }

      const { data: sels } = await supabase
        .from('kitchen_selections')
        .select('unit_id, has_kitchen, counter_type, unit_finish, handle_style')
        .in('unit_id', filteredUnitIds);

      let results = sels || [];

      // Filter by derived status
      if (args.status) {
        if (args.status === 'confirmed') {
          results = results.filter((s) => s.has_kitchen === true);
        } else if (args.status === 'pending') {
          results = results.filter((s) => !s.has_kitchen);
        }
      }

      const enriched = results.map((s) => {
        const unit = allUnits.find((u) => u.id === s.unit_id);
        const choice = s.has_kitchen
          ? [s.counter_type, s.unit_finish, s.handle_style].filter(Boolean).join(', ') || 'Selected'
          : 'Not selected';
        return {
          unit_number: unit?.unit_number || 'Unknown',
          kitchen_choice: choice,
          status: s.has_kitchen ? 'confirmed' : 'pending',
        };
      });

      return { count: enriched.length, selections: enriched };
    }

    case 'query_snagging': {
      let filteredUnitIds = unitIds;
      if (args.development_id) {
        filteredUnitIds = allUnits
          .filter((u) => u.development_id === args.development_id)
          .map((u) => u.id);
      }

      if (filteredUnitIds.length === 0) {
        return { count: 0, snags: [] };
      }

      let query = supabase
        .from('snag_items')
        .select('id, unit_id, description, status, created_at')
        .in('unit_id', filteredUnitIds);

      if (args.status) {
        query = query.eq('status', args.status as string);
      }
      if (args.unit_id) {
        query = query.eq('unit_id', args.unit_id as string);
      }

      const { data: snags } = await query;
      const enriched = (snags || []).map((s) => {
        const unit = allUnits.find((u) => u.id === s.unit_id);
        return {
          unit_number: unit?.unit_number || 'Unknown',
          description: s.description,
          status: s.status,
        };
      });

      return { count: enriched.length, snags: enriched };
    }

    case 'draft_email': {
      return {
        email_draft: {
          to: args.to,
          subject: args.subject,
          body: args.body,
          sent: false,
          related_units: args.related_units,
        },
      };
    }

    case 'update_pipeline_stage': {
      // Map stage name to date column
      const stageMapping = Object.fromEntries(
        PIPELINE_STAGES.map((s) => [s.label.toLowerCase(), s.key])
      );
      const dateColumn = stageMapping[(args.new_stage as string).toLowerCase()];

      if (!dateColumn) {
        return {
          error: `Unknown stage: "${args.new_stage}". Valid stages: ${PIPELINE_STAGES.map((s) => s.label).join(', ')}`,
        };
      }

      return {
        confirmation_required: true,
        unit_id: args.unit_id,
        new_stage: args.new_stage,
        date_column: dateColumn,
        notes: args.notes,
        message: `I'll update the pipeline stage to "${args.new_stage}" (set ${dateColumn} to today). Please confirm this change.`,
      };
    }

    case 'get_attention_items': {
      let filteredUnitIds = unitIds;
      if (args.development_id) {
        filteredUnitIds = allUnits
          .filter((u) => u.development_id === args.development_id)
          .map((u) => u.id);
      }

      const attentionItems: { type: string; severity: string; count: number; title: string }[] = [];

      if (filteredUnitIds.length > 0) {
        // Stuck pipeline items (>30 days at current stage)
        const { data: pipelineItems } = await supabase
          .from('unit_sales_pipeline')
          .select(PIPELINE_SELECT_COLUMNS)
          .in('unit_id', filteredUnitIds);

        const stuckUnits = (pipelineItems || []).filter(
          (p: Record<string, unknown>) => daysAtStage(p) > 30 && !p.handover_date
        );

        if (stuckUnits.length > 0) {
          attentionItems.push({
            type: 'stuck_pipeline',
            severity: 'red',
            count: stuckUnits.length,
            title: `${stuckUnits.length} unit${stuckUnits.length > 1 ? 's' : ''} stuck in pipeline for over 30 days`,
          });
        }

        // Compliance issues
        const { data: overdueDocs } = await supabase
          .from('compliance_documents')
          .select('unit_id, status')
          .in('unit_id', filteredUnitIds)
          .in('status', ['expired', 'missing']);

        if (overdueDocs && overdueDocs.length > 0) {
          attentionItems.push({
            type: 'compliance_overdue',
            severity: 'amber',
            count: overdueDocs.length,
            title: `${overdueDocs.length} compliance document${overdueDocs.length > 1 ? 's' : ''} need attention`,
          });
        }

        // Open snags
        const { data: openSnags } = await supabase
          .from('snag_items')
          .select('unit_id, status')
          .in('unit_id', filteredUnitIds)
          .in('status', ['open', 'in_progress']);

        if (openSnags && openSnags.length >= 5) {
          attentionItems.push({
            type: 'open_snags',
            severity: 'amber',
            count: openSnags.length,
            title: `${openSnags.length} open snag items need resolution`,
          });
        }
      }

      // Filter by severity if specified
      let filtered = attentionItems;
      if (args.severity && args.severity !== 'all') {
        filtered = attentionItems.filter((i) => i.severity === args.severity);
      }

      return { items: filtered, count: filtered.length };
    }

    case 'update_unit_status': {
      // Resolve units from args — the AI provides unit IDs, references, current + new status
      const unitUpdates = (args.units as Array<{
        unit_id: string;
        unit_reference: string;
        current_status: string;
        new_status: string;
      }>) || [];

      if (unitUpdates.length === 0) {
        return { error: 'No units specified for status update' };
      }

      // Verify all unit IDs belong to the developer's developments
      const updateUnitIds = unitUpdates.map((u) => u.unit_id);
      const validUnitIds = allUnits.filter((u) => updateUnitIds.includes(u.id)).map((u) => u.id);
      const invalidIds = updateUnitIds.filter((id) => !validUnitIds.includes(id));

      if (invalidIds.length > 0) {
        return { error: `Units not found in your developments: ${invalidIds.join(', ')}` };
      }

      // Return a confirmation payload — the client renders this as a confirmation card
      // No write happens until the user confirms via the API endpoint
      return {
        confirmation_required: true,
        action_type: 'update_unit_status',
        scheme_id: args.scheme_id,
        reason: args.reason,
        units: unitUpdates,
        message: `I'll update ${unitUpdates.length} unit${unitUpdates.length > 1 ? 's' : ''}. Please review and confirm.`,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Get developer's developments
    const { data: developments } = await admin
      .from('developments')
      .select('id, name')
      .eq('developer_user_id', user.id);

    const devs = (developments || []).filter(
      (d: { id: string; name: string }) => d.name && d.name !== 'Test' && d.name !== 'NULL tenant test'
    );
    const devIds = devs.map((d: { id: string; name: string }) => d.id);

    // Load unit summary data for each development — this gives the AI real context
    const { data: allDevUnits } = await admin
      .from('units')
      .select('id, unit_number, unit_status, development_id')
      .in('development_id', devIds)
      .order('unit_number');

    const unitsByDev: Record<string, Array<{ id: string; unit_number: string; unit_status: string; development_id: string }>> = {};
    for (const u of (allDevUnits || []) as Array<{ id: string; unit_number: string; unit_status: string; development_id: string }>) {
      if (!unitsByDev[u.development_id]) unitsByDev[u.development_id] = [];
      unitsByDev[u.development_id].push(u);
    }

    // Strip diacritics for alias matching (e.g. Rathárd → Rathard)
    function stripDiacritics(str: string): string {
      return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    // Build rich development context
    const devSummaries = devs.map((d: { id: string; name: string }) => {
      const units = unitsByDev[d.id] || [];
      const alias = stripDiacritics(d.name);
      const aliasNote = alias !== d.name ? ` (also known as "${alias}")` : '';

      // Unit number range
      const unitNumbers = units.map((u) => parseInt(u.unit_number, 10)).filter((n) => !isNaN(n)).sort((a, b) => a - b);
      const range = unitNumbers.length > 0 ? `${unitNumbers[0]}-${unitNumbers[unitNumbers.length - 1]}` : 'none';

      // Status breakdown
      const statusCounts: Record<string, number> = {};
      for (const u of units) {
        const s = u.unit_status || 'unknown';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
      }
      const statusStr = Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([s, c]) => `${c} ${s}`)
        .join(', ');

      return `- ${d.name}${aliasNote} [ID: ${d.id}]: ${units.length} units (numbers ${range}). Status: ${statusStr || 'no units'}`;
    }).join('\n');

    // Get or create conversation
    let convoId = conversation_id;
    if (!convoId) {
      const { data: newConvo } = await admin
        .from('intelligence_conversations')
        .insert({
          developer_id: user.id,
          title: message.substring(0, 80),
        })
        .select('id')
        .single();

      convoId = newConvo?.id;
    }

    // Save user message
    if (convoId) {
      await admin.from('intelligence_messages').insert({
        conversation_id: convoId,
        role: 'user',
        message_type: 'text',
        content: message,
      });
    }

    // Build context messages
    let contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (convoId) {
      const { data: prevMessages } = await admin
        .from('intelligence_messages')
        .select('role, content, message_type')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: true })
        .limit(20);

      contextMessages = (prevMessages || [])
        .filter((m: { role: string; content: string; message_type: string }) => m.role !== 'system')
        .map((m: { role: string; content: string; message_type: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
    }

    const today = new Date().toLocaleDateString('en-IE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const systemPrompt = `You are OpenHouse Intelligence, an AI assistant for Irish property developers. You help developers manage their residential developments by answering questions about units, purchasers, compliance, pipeline status, and more.

You have access to the developer's real data across all their developments. You can also take actions on their behalf: drafting emails, updating pipeline stages, updating unit statuses, and more.

IMPORTANT RULES:
- Always be concise and direct. Developers are busy, on-site.
- When you have structured data, return it as a rich card (use the appropriate tool to fetch data first).
- When drafting emails, always show the draft first and wait for confirmation before sending.
- When updating pipeline stages or unit statuses, confirm the change before executing.
- Reference specific unit numbers and names - never be vague.
- If you're unsure about data, say so. Never guess.
- Use Irish property terminology (solicitor not lawyer, estate agent not realtor).

NAME MATCHING:
Development names may contain Irish fadas (accented characters). When the user types "Rathard Park", they mean "Rathárd Park". When they type "Ardan View", they mean "Árdan View". Always match ignoring diacritics. The development list below includes aliases in parentheses.

HANDLING MISSING DATA:
- If a unit number does not exist, tell the user the valid unit range for that development.
- If there are no records for a query (e.g. no snag items), state clearly that no records exist and suggest what the user might want to do (e.g. "No snag items have been logged for this unit yet. Would you like me to help with something else?").
- Never blame the user or tell them to "upload" things. Just state the facts.

You also have the ability to perform actions on behalf of the user. When a user asks you to make a change to scheme data, use the appropriate tool.

Rules for write actions:
- Always populate the reason field with a plain-English summary of what you understood the user to be asking
- Always include current_status for each unit so the confirmation UI can show the before/after clearly
- If you are unsure which units a request applies to, ask one clarifying question before calling the tool - do not guess
- Never call a write tool unless you are confident you have identified the correct records
- After a confirmed write, acknowledge the change briefly and naturally - do not over-explain

CURRENT CONTEXT:
Developer ID: ${user.id}
Current date: ${today}

YOUR DEVELOPMENTS:
${devSummaries || 'None'}

VALID UNIT STATUSES: available, sale_agreed, in_progress, complete, social_housing, occupied, handed_over, maintenance, vacant, void, withdrawn`;

    // Call OpenAI
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...contextMessages,
        { role: 'user', content: message },
      ],
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 1500,
    });

    let assistantContent = completion.choices[0]?.message?.content || '';
    const toolCalls = completion.choices[0]?.message?.tool_calls;
    const responseMessages: Record<string, unknown>[] = [];

    if (toolCalls && toolCalls.length > 0) {
      // Execute tool calls
      const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'assistant', content: null as unknown as string, tool_calls: toolCalls },
      ];

      for (const call of toolCalls) {
        const args = JSON.parse(call.function.arguments);
        const result = await executeTool(
          call.function.name,
          args,
          user.id,
          devIds
        );

        toolResults.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });

        // Create rich message if tool returned structured data
        if (result.unit_info) {
          const richMsg = {
            id: `rich-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: 'unit_info',
            content: '',
            structured_data: result.unit_info,
            created_at: new Date().toISOString(),
          };
          responseMessages.push(richMsg);

          if (convoId) {
            await admin.from('intelligence_messages').insert({
              conversation_id: convoId,
              role: 'assistant',
              message_type: 'unit_info',
              content: `Unit info for ${result.unit_info.unit_name}`,
              structured_data: result.unit_info,
            });
          }
        }

        if (result.email_draft) {
          const richMsg = {
            id: `rich-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: 'email_draft',
            content: '',
            structured_data: result.email_draft,
            created_at: new Date().toISOString(),
          };
          responseMessages.push(richMsg);

          if (convoId) {
            await admin.from('intelligence_messages').insert({
              conversation_id: convoId,
              role: 'assistant',
              message_type: 'email_draft',
              content: `Email draft to ${result.email_draft.to}`,
              structured_data: result.email_draft,
            });
          }
        }

        if (result.confirmation_required && result.action_type === 'update_unit_status') {
          const confirmationData = {
            action_type: result.action_type,
            scheme_id: result.scheme_id,
            reason: result.reason,
            units: result.units,
            natural_language_instruction: message,
          };
          const richMsg = {
            id: `confirm-${Date.now()}-${call.id}`,
            role: 'assistant',
            message_type: 'status_update_confirmation',
            content: result.message || '',
            structured_data: confirmationData,
            created_at: new Date().toISOString(),
          };
          responseMessages.push(richMsg);

          if (convoId) {
            await admin.from('intelligence_messages').insert({
              conversation_id: convoId,
              role: 'assistant',
              message_type: 'status_update_confirmation',
              content: `Status update confirmation for ${(result.units as Array<{ unit_reference: string }>).length} unit(s)`,
              structured_data: confirmationData,
            });
          }
        }
      }

      // Second OpenAI call with tool results for natural language response
      const followUp = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...contextMessages,
          { role: 'user', content: message },
          ...toolResults,
        ],
        temperature: 0.3,
        max_tokens: 800,
      });

      assistantContent = followUp.choices[0]?.message?.content || '';
    }

    // Add the text response
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
        await admin.from('intelligence_messages').insert({
          conversation_id: convoId,
          role: 'assistant',
          message_type: 'text',
          content: assistantContent,
        });

        // Update conversation
        await admin
          .from('intelligence_conversations')
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
