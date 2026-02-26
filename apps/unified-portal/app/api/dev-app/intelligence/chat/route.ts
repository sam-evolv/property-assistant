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
];

// Tool execution functions
async function executeTool(
  toolName: string,
  args: any,
  userId: string,
  devIds: string[]
): Promise<any> {
  const supabase = getSupabaseAdmin();

  // Get all unit IDs for this developer
  const { data: units } = await supabase
    .from('units')
    .select('id, unit_number, development_id')
    .in('development_id', devIds);

  const allUnits: any[] = units || [];
  const unitIds = allUnits.map((u: any) => u.id);

  switch (toolName) {
    case 'lookup_unit': {
      const identifier = args.unit_identifier.replace(/[^0-9a-zA-Z]/g, '');
      let matchingUnits = allUnits.filter(
        (u: any) =>
          u.unit_number === identifier ||
          u.unit_number === args.unit_identifier ||
          u.unit_number.toLowerCase().includes(identifier.toLowerCase())
      );

      if (args.development_id) {
        matchingUnits = matchingUnits.filter(
          (u: any) => u.development_id === args.development_id
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
        .maybeSingle();

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

      const fields: any[] = [];
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

      (compDocs || []).forEach((d: any) => {
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

      const openSnags = (snags || []).filter((s: any) => s.status !== 'resolved');
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
          .filter((u: any) => u.development_id === args.development_id)
          .map((u: any) => u.id);
      }

      if (filteredUnitIds.length === 0) {
        return { count: 0, pipeline: [] };
      }

      const { data: pipelineRows } = await supabase
        .from('unit_sales_pipeline')
        .select(PIPELINE_SELECT_COLUMNS)
        .in('unit_id', filteredUnitIds);

      let results = (pipelineRows || []).map((p: any) => ({
        ...p,
        ...derivePipelineStage(p),
        days: daysAtStage(p),
      }));

      if (args.stage) {
        const stageFilter = args.stage.toLowerCase();
        results = results.filter((p: any) =>
          p.stage.toLowerCase().includes(stageFilter)
        );
      }

      if (args.days_at_stage_min) {
        results = results.filter((p: any) => p.days >= args.days_at_stage_min);
      }

      const enriched = results.map((p: any) => {
        const unit = allUnits.find((u: any) => u.id === p.unit_id);
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
          .filter((u: any) => u.development_id === args.development_id)
          .map((u: any) => u.id);
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
        const dbStatus = dbStatusMap[args.status] || args.status;
        query = query.eq('status', dbStatus);
      }

      const { data: docs } = await query;
      let filteredDocs = docs || [];

      // Filter by document type name (in JS since it's from a join)
      if (args.document_type) {
        const typeFilter = args.document_type.toLowerCase();
        filteredDocs = filteredDocs.filter((d: any) =>
          (d.compliance_document_types?.name || '').toLowerCase().includes(typeFilter)
        );
      }

      const enriched = filteredDocs.map((d: any) => {
        const unit = allUnits.find((u: any) => u.id === d.unit_id);
        return {
          unit_number: unit?.unit_number || 'Unknown',
          document_type: d.compliance_document_types?.name || 'Unknown',
          status: mapComplianceStatus(d.status),
        };
      });

      return { count: enriched.length, documents: enriched };
    }

    case 'query_selections': {
      let filteredUnitIds = unitIds;
      if (args.development_id) {
        filteredUnitIds = allUnits
          .filter((u: any) => u.development_id === args.development_id)
          .map((u: any) => u.id);
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
          results = results.filter((s: any) => s.has_kitchen === true);
        } else if (args.status === 'pending') {
          results = results.filter((s: any) => !s.has_kitchen);
        }
      }

      const enriched = results.map((s: any) => {
        const unit = allUnits.find((u: any) => u.id === s.unit_id);
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
          .filter((u: any) => u.development_id === args.development_id)
          .map((u: any) => u.id);
      }

      if (filteredUnitIds.length === 0) {
        return { count: 0, snags: [] };
      }

      let query = supabase
        .from('snag_items')
        .select('id, unit_id, description, status, created_at')
        .in('unit_id', filteredUnitIds);

      if (args.status) {
        query = query.eq('status', args.status);
      }
      if (args.unit_id) {
        query = query.eq('unit_id', args.unit_id);
      }

      const { data: snags } = await query;
      const enriched = (snags || []).map((s: any) => {
        const unit = allUnits.find((u: any) => u.id === s.unit_id);
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
      const dateColumn = stageMapping[args.new_stage.toLowerCase()];

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
          .filter((u: any) => u.development_id === args.development_id)
          .map((u: any) => u.id);
      }

      const attentionItems: any[] = [];

      if (filteredUnitIds.length > 0) {
        // Stuck pipeline items (>30 days at current stage)
        const { data: pipelineItems } = await supabase
          .from('unit_sales_pipeline')
          .select(PIPELINE_SELECT_COLUMNS)
          .in('unit_id', filteredUnitIds);

        const stuckUnits = (pipelineItems || []).filter(
          (p: any) => daysAtStage(p) > 30 && !p.handover_date
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

    // Get developer's developments (filter test/junk data)
    const { data: developments } = await admin
      .from('developments')
      .select('id, name')
      .eq('developer_user_id', user.id)
      .not('name', 'ilike', '%test%')
      .not('name', 'ilike', 'NULL%')
      .not('name', 'ilike', '%demo%')
      .not('name', 'ilike', '%sample%');

    const devs = developments || [];
    const devIds = devs.map((d: any) => d.id);
    const devList = devs.map((d: any) => `${d.name} (${d.id})`).join(', ');

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
        .filter((m: any) => m.role !== 'system')
        .map((m: any) => ({
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

    const systemPrompt = `You are OpenHouse Intelligence, an AI assistant for property developers. You help developers manage their residential developments by answering questions about units, purchasers, compliance, pipeline status, and more.

You have access to the developer's real data across all their developments. You can also take actions on their behalf: drafting emails, updating pipeline stages, and more.

IMPORTANT RULES:
- Always be concise and direct. Developers are busy, on-site.
- When you have structured data, return it as a rich card (use the appropriate tool to fetch data first).
- When drafting emails, always show the draft first and wait for confirmation before sending.
- When updating pipeline stages, confirm the change before executing.
- Reference specific unit numbers and names — never be vague.
- If you're unsure about data, say so. Never guess.
- Use Irish property terminology (solicitor not lawyer, estate agent not realtor).

CURRENT CONTEXT:
Developer ID: ${user.id}
Developments: ${devList || 'None'}
Current date: ${today}`;

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
    const responseMessages: any[] = [];

    if (toolCalls && toolCalls.length > 0) {
      // Execute tool calls
      const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'assistant', content: null as any, tool_calls: toolCalls },
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
    console.error('[dev-app/intelligence/chat] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
