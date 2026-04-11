import { SupabaseClient } from '@supabase/supabase-js';

export interface AgentContext {
  agentId: string;
  userId: string;
  tenantId: string;
  displayName: string;
  assignedSchemes: Array<{
    developmentId: string;
    schemeName: string;
    unitCount: number;
    location?: string | null;
    developerName?: string | null;
  }>;
}

export interface ToolResult {
  data: any;
  summary: string;
}

export type ToolFunction = (
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext,
  params: Record<string, any>
) => Promise<ToolResult>;

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required: string[];
  };
  execute: ToolFunction;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
