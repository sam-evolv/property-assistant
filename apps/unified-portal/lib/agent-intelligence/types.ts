import { SupabaseClient } from '@supabase/supabase-js';

export interface AgentContext {
  agentId: string;
  userId: string;
  tenantId: string;
  displayName: string;
  agencyName?: string | null;
  agentType?: string | null;
  assignedSchemes: Array<{
    developmentId: string;
    schemeName: string;
    unitCount: number;
    location?: string | null;
    developerName?: string | null;
  }>;
  /**
   * Flat lists of the agent's in-scope development ids and names. Populated
   * once at request time by `resolveAgentContext`. Tools MUST use these
   * instead of re-querying `agent_scheme_assignments`.
   */
  assignedDevelopmentIds: string[];
  assignedDevelopmentNames: string[];
  /**
   * The currently-selected scheme from the UI dropdown (or null/undefined for
   * "All Schemes"). Threaded from the chat route's `activeDevelopmentId` body
   * param.
   */
  activeDevelopmentId?: string | null;
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

/**
 * A JSON Schema parameter as accepted by OpenAI function-calling. Shaped
 * recursively: `array` types MUST carry an `items` sub-schema, `object`
 * types MUST carry a `properties` map — OpenAI 400s otherwise.
 */
export interface ToolParameterSchema {
  type: string;
  description?: string;
  enum?: string[];
  /** Required when `type === 'array'`. */
  items?: ToolParameterSchema;
  /** Required when `type === 'object'`. */
  properties?: Record<string, ToolParameterSchema>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameterSchema>;
    required: string[];
  };
  execute: ToolFunction;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}
