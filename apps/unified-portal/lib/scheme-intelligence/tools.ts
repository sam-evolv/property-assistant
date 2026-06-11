/**
 * Scheme Intelligence tool registry — Phase 6 of the north star.
 *
 * Wraps the existing FUNCTION_REGISTRY data fetchers (zero new data code)
 * plus document search as OpenAI tools, so the developer assistant decides
 * for itself which live data to pull and can chain calls — replacing the
 * single-shot classifier. Read-only by design; write tools arrive later
 * behind the draft-first pattern.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { FUNCTION_REGISTRY } from './functions';

export interface DataToolResult {
  name: string;
  summary: string;
  data: unknown;
  chartData?: unknown;
}

export interface DocumentSearchResult {
  text: string;
  sources: Array<{ title: string; type: string; excerpt: string }>;
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  getRegistrationRate: 'Homeowner registration rate for the scheme: how many purchasers have activated their portal.',
  getHandoverPipeline: 'Upcoming and recent handovers with dates per unit.',
  getHomeownerActivity: 'Recent homeowner activity: logins, chats, engagement.',
  getStagePaymentStatus: 'Stage payment / sales pipeline stage status across units.',
  getProjectedRevenue: 'Projected and committed revenue from sale prices and stages.',
  getDocumentCoverage: 'Document coverage: which homes/house types are missing documents.',
  getMostAskedQuestions: 'What homeowners ask the assistant most, by topic.',
  getOutstandingSnags: 'Open snags across the scheme with severity and age.',
  getKitchenSelections: 'Kitchen/wardrobe selection status and PC sums per unit.',
  getSchemeSummary: 'High-level scheme summary: units, sold, registered, key numbers.',
  getCommunicationsLog: 'Recent communications and broadcasts to homeowners.',
  getUnitTypeBreakdown: 'Breakdown of units by house type with counts and status.',
  getSEAIGrants: 'SEAI grant eligibility and status information for the scheme.',
};

export const SEARCH_DOCUMENTS_TOOL = 'search_documents';
const REGULATIONS_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

export function buildToolDefinitions(): OpenAI.ChatCompletionTool[] {
  const dataTools: OpenAI.ChatCompletionTool[] = Object.keys(FUNCTION_REGISTRY).map((name) => ({
    type: 'function' as const,
    function: {
      name,
      description: TOOL_DESCRIPTIONS[name] || `Live scheme data: ${name}`,
      parameters: { type: 'object', properties: {}, required: [] },
    },
  }));

  dataTools.push({
    type: 'function' as const,
    function: {
      name: SEARCH_DOCUMENTS_TOOL,
      description:
        'Semantic search over documents. scope "scheme" searches this scheme\'s uploaded documents (plans, specs, certs); scope "regulations" searches Irish building regulations and compliance guidance.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for' },
          scope: { type: 'string', enum: ['scheme', 'regulations'] },
        },
        required: ['query', 'scope'],
      },
    },
  });

  return dataTools;
}

export async function executeDataTool(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId: string | undefined,
  name: string,
): Promise<DataToolResult | null> {
  const fn = FUNCTION_REGISTRY[name];
  if (!fn) return null;
  try {
    const result = await fn(supabase, tenantId, developmentId);
    return { name, summary: result.summary, data: result.data, chartData: result.chartData };
  } catch {
    return null;
  }
}

export async function searchDocuments(
  supabase: SupabaseClient,
  openai: OpenAI,
  params: { query: string; scope: 'scheme' | 'regulations'; tenantId: string; developmentId?: string },
): Promise<DocumentSearchResult> {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: params.query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    const matchProjectId =
      params.scope === 'regulations'
        ? REGULATIONS_PROJECT_ID
        : params.developmentId || params.tenantId;

    const { data: chunks, error } = await supabase.rpc('match_document_sections', {
      query_embedding: queryEmbedding,
      match_project_id: matchProjectId,
      match_count: 8,
    });
    if (error || !chunks?.length) {
      return { text: 'No matching documents found.', sources: [] };
    }

    const text = chunks
      .map((c: any) => `[Document: ${c.metadata?.title || c.metadata?.file_name || 'Unknown'}]\n${c.content}`)
      .join('\n\n---\n\n');
    const sources = chunks.map((c: any) => ({
      title: c.metadata?.title || c.metadata?.file_name || 'Document',
      type: params.scope === 'regulations' ? 'regulatory' : 'document',
      excerpt: (c.content || '').slice(0, 200),
    }));
    return { text, sources };
  } catch {
    return { text: 'Document search failed.', sources: [] };
  }
}

/** Same contextual deep-links the classic path offered, keyed by tools used. */
export function actionsForTools(
  used: Set<string>,
  developmentId?: string,
  regulatoryUsed?: boolean,
): Array<{ label: string; href: string }> {
  const actions: Array<{ label: string; href: string }> = [];
  if (used.has('getHandoverPipeline') || used.has('getStagePaymentStatus')) {
    actions.push({
      label: 'View Sales Pipeline',
      href: developmentId ? `/developer/pipeline/${developmentId}` : '/developer/pipeline',
    });
  }
  if (used.has('getDocumentCoverage')) {
    actions.push({ label: 'View Smart Archive', href: '/developer/smart-archive' });
  }
  if (used.has('getHomeownerActivity') || used.has('getMostAskedQuestions')) {
    actions.push({ label: 'View Homeowners', href: '/developer/homeowners' });
  }
  if (used.has('getKitchenSelections')) {
    actions.push({ label: 'View Kitchen Selections', href: '/developer/kitchen-selections' });
  }
  if (used.has('getOutstandingSnags')) {
    actions.push({ label: 'View Snagging', href: '/developer/snagging' });
  }
  if (regulatoryUsed) {
    actions.push({ label: 'View Compliance', href: '/developer/compliance' });
  }
  return actions;
}
