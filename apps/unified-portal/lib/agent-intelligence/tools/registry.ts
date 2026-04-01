import { ToolDefinition } from '../types';
import {
  getUnitStatus,
  getBuyerDetails,
  getSchemeOverview,
  getOutstandingItems,
  getCommunicationHistory,
  searchKnowledgeBase,
} from './read-tools';
import {
  createTask,
  logCommunication,
  draftMessage,
  generateDeveloperReport,
} from './write-tools';

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
    execute: getUnitStatus,
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
    execute: getBuyerDetails,
  },
  {
    name: 'get_scheme_overview',
    description: 'Get a high-level summary of a scheme sales status, including unit breakdown by status, outstanding items, and key metrics.',
    parameters: {
      type: 'object',
      properties: {
        scheme_name: { type: 'string', description: 'Name of the development/scheme' },
      },
      required: ['scheme_name'],
    },
    execute: getSchemeOverview,
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
    execute: searchKnowledgeBase,
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
    execute: createTask,
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
    execute: logCommunication,
  },
  {
    name: 'draft_message',
    description: 'Draft an email or message for the agent to review and send. NEVER sends anything automatically — returns a draft for review.',
    parameters: {
      type: 'object',
      properties: {
        recipient_type: { type: 'string', description: 'Type of recipient', enum: ['buyer', 'developer', 'solicitor'] },
        recipient_name: { type: 'string', description: 'Name of the recipient' },
        context: { type: 'string', description: 'What the message should cover' },
        tone: { type: 'string', description: 'Message tone', enum: ['warm', 'formal', 'urgent', 'gentle_chase'] },
        related_unit: { type: 'string', description: 'Related unit number' },
        related_scheme: { type: 'string', description: 'Related scheme name' },
      },
      required: ['recipient_type', 'recipient_name', 'context'],
    },
    execute: draftMessage,
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
    execute: generateDeveloperReport,
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
