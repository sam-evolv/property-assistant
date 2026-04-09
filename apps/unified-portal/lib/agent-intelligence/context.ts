import { SupabaseClient } from '@supabase/supabase-js';
import { AgentContext } from './types';

/**
 * Load the agent profile and assigned schemes for the authenticated user.
 */
export async function loadAgentContext(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<AgentContext | null> {
  // Get agent profile
  const { data: profile } = await supabase
    .from('agent_profiles')
    .select('id, display_name')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  // Get assigned schemes with unit counts
  const { data: assignments } = await supabase
    .from('agent_scheme_assignments')
    .select('development_id')
    .eq('agent_id', profile.id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const developmentIds = (assignments || []).map((a: any) => a.development_id);

  let assignedSchemes: AgentContext['assignedSchemes'] = [];

  if (developmentIds.length > 0) {
    const { data: devs } = await supabase
      .from('developments')
      .select('id, name')
      .in('id', developmentIds);

    // Get unit counts per development
    const schemesWithCounts = await Promise.all(
      (devs || []).map(async (dev: any) => {
        const { count } = await supabase
          .from('units')
          .select('id', { count: 'exact', head: true })
          .eq('development_id', dev.id)
          .eq('tenant_id', tenantId);

        return {
          developmentId: dev.id,
          schemeName: dev.name,
          unitCount: count || 0,
        };
      })
    );

    assignedSchemes = schemesWithCounts;
  }

  return {
    agentId: profile.id,
    userId,
    tenantId,
    displayName: profile.display_name,
    assignedSchemes,
  };
}

/**
 * Build a summary of recent activity across assigned schemes (last 7 days).
 */
export async function getRecentActivitySummary(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext
): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const devIds = agentContext.assignedSchemes.map(s => s.developmentId);

  if (!devIds.length) return 'No schemes assigned.';

  // Get pipeline activity counts
  const { data: pipeline } = await supabase
    .from('unit_sales_pipeline')
    .select('sale_agreed_date, contracts_issued_date, signed_contracts_date, counter_signed_date, handover_date')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds);

  let newSaleAgreed = 0;
  let contractsIssued = 0;
  let contractsReturned = 0;
  let unitsClosed = 0;

  for (const p of pipeline || []) {
    if (p.sale_agreed_date && p.sale_agreed_date >= sevenDaysAgo) newSaleAgreed++;
    if (p.contracts_issued_date && p.contracts_issued_date >= sevenDaysAgo) contractsIssued++;
    if ((p.signed_contracts_date && p.signed_contracts_date >= sevenDaysAgo) ||
        (p.counter_signed_date && p.counter_signed_date >= sevenDaysAgo)) contractsReturned++;
    if (p.handover_date && p.handover_date >= sevenDaysAgo) unitsClosed++;
  }

  // Get communication event count
  const { count: commsCount } = await supabase
    .from('communication_events')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('development_id', devIds)
    .gte('created_at', sevenDaysAgo);

  // Get overdue tasks
  const { count: overdueTasks } = await supabase
    .from('agent_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agentContext.agentId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress'])
    .lt('due_date', new Date().toISOString());

  const lines = [
    `${newSaleAgreed} units gone sale agreed`,
    `${contractsIssued} contracts issued`,
    `${contractsReturned} contracts returned/signed`,
    `${unitsClosed} units closed/handed over`,
    `${commsCount || 0} communications logged`,
    `${overdueTasks || 0} overdue tasks`,
  ];

  return lines.map(l => `- ${l}`).join('\n');
}

/**
 * Get upcoming deadlines across assigned schemes (next 14 days).
 */
export async function getUpcomingDeadlines(
  supabase: SupabaseClient,
  tenantId: string,
  agentContext: AgentContext
): Promise<string> {
  const devIds = agentContext.assignedSchemes.map(s => s.developmentId);
  if (!devIds.length) return 'No schemes assigned.';

  const fourteenDaysFromNow = new Date(Date.now() + 14 * 86400000).toISOString();

  // Get upcoming tasks
  const { data: tasks } = await supabase
    .from('agent_tasks')
    .select('title, due_date, priority')
    .eq('agent_id', agentContext.agentId)
    .eq('tenant_id', tenantId)
    .in('status', ['pending', 'in_progress'])
    .lte('due_date', fourteenDaysFromNow)
    .order('due_date', { ascending: true })
    .limit(10);

  // Get upcoming handovers
  const { data: handovers } = await supabase
    .from('unit_sales_pipeline')
    .select('purchaser_name, handover_date, unit_id')
    .eq('tenant_id', tenantId)
    .in('development_id', devIds)
    .gte('handover_date', new Date().toISOString())
    .lte('handover_date', fourteenDaysFromNow)
    .order('handover_date', { ascending: true })
    .limit(10);

  const lines: string[] = [];

  for (const t of tasks || []) {
    lines.push(`- [${t.priority?.toUpperCase() || 'MEDIUM'}] Task: ${t.title} — due ${new Date(t.due_date).toLocaleDateString('en-IE')}`);
  }

  for (const h of handovers || []) {
    lines.push(`- Handover: ${h.purchaser_name || 'Unknown buyer'} — ${new Date(h.handover_date).toLocaleDateString('en-IE')}`);
  }

  return lines.length ? lines.join('\n') : 'No deadlines in the next 14 days.';
}

/**
 * Load cross-session entity memory for mentioned entities.
 */
export async function loadEntityMemory(
  supabase: SupabaseClient,
  agentId: string,
  message: string
): Promise<string> {
  // Extract potential entity references from the message
  // Only match on substantial terms (3+ chars) to avoid false positives on common words
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length >= 3);

  // Skip entity memory for generic queries that don't reference specific entities
  const genericPatterns = ['overview', 'outstanding', 'update', 'report', 'what\'s', 'whats', 'summary', 'briefing', 'this week', 'today'];
  const isGenericQuery = genericPatterns.some(p => message.toLowerCase().includes(p)) &&
    !words.some(w => /\d+/.test(w)); // Allow if there's a unit number

  if (isGenericQuery) return '';

  // Look for recent conversations about any mentioned names or unit numbers
  const { data: recentConversations } = await supabase
    .from('intelligence_conversations')
    .select('content, created_at, entities_mentioned')
    .eq('agent_id', agentId)
    .eq('role', 'assistant')
    .order('created_at', { ascending: false })
    .limit(20);

  if (!recentConversations?.length) return '';

  // Filter conversations that mention any of the same entities
  // Require at least a 4-character match to avoid false positives
  const relevant = recentConversations.filter((conv: any) => {
    if (!conv.entities_mentioned) return false;
    const entities = conv.entities_mentioned as any;
    const allEntityNames = [
      ...(entities.buyers || []),
      ...(entities.units || []),
      ...(entities.schemes || []),
    ].map((e: string) => e.toLowerCase());

    return words.some(w => w.length >= 4 && allEntityNames.some(e => e.includes(w) || w.includes(e)));
  });

  if (!relevant.length) return '';

  return relevant
    .slice(0, 5)
    .map((r: any) => `- On ${new Date(r.created_at).toLocaleDateString('en-IE')}: ${r.content.slice(0, 200)}`)
    .join('\n');
}
