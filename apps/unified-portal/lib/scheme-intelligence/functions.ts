import { SupabaseClient } from '@supabase/supabase-js';

export interface FunctionResult {
  data: any;
  summary: string;
  chartData?: {
    type: 'bar' | 'donut' | 'line';
    labels: string[];
    values: number[];
  };
}

export async function getRegistrationRate(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string
): Promise<FunctionResult> {
  // Count units total (from units table)
  let unitsQuery = supabase
    .from('units')
    .select('id, unit_number, unit_uid')
    .eq('tenant_id', tenantId);
  if (developmentId) unitsQuery = unitsQuery.eq('development_id', developmentId);
  const { data: units, error: unitsError } = await unitsQuery;
  if (unitsError) throw new Error(`getRegistrationRate: ${unitsError.message}`);

  const total = units?.length || 0;

  // Count registered via purchaser_agreements (actual portal registrations)
  let regQuery = supabase
    .from('purchaser_agreements')
    .select('unit_id')
    .in('unit_id', (units || []).map((u: any) => u.id));
  const { data: agreements, error: agError } = await regQuery;
  if (agError) throw new Error(`getRegistrationRate agreements: ${agError.message}`);

  const registeredUnitIds = new Set((agreements || []).map((a: any) => a.unit_id));
  const registered = registeredUnitIds.size;
  const unregistered = (units || [])
    .filter((u: any) => !registeredUnitIds.has(u.id))
    .map((u: any) => u.unit_uid || u.unit_number);
  const rate = total > 0 ? Math.round((registered / total) * 100) : 0;

  return {
    data: { total, registered, rate, unregistered },
    summary: `${registered} of ${total} units (${rate}%) have registered homeowners. ${unregistered.length} units unregistered.`,
    chartData: {
      type: 'donut',
      labels: ['Registered', 'Unregistered'],
      values: [registered, total - registered],
    },
  };
}

export async function getHandoverPipeline(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string,
  month?: string
): Promise<FunctionResult> {
  let query = supabase
    .from('unit_sales_pipeline')
    .select('id, unit_id, handover_date, purchaser_name')
    .eq('tenant_id', tenantId)
    .not('handover_date', 'is', null)
    .order('handover_date', { ascending: true });

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: pipeline, error } = await query;
  if (error) throw new Error(`getHandoverPipeline: ${error.message}`);

  const monthGroups: Record<string, number> = {};
  const upcoming: any[] = [];
  const now = new Date();

  for (const row of pipeline || []) {
    const date = new Date(row.handover_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthGroups[key] = (monthGroups[key] || 0) + 1;
    if (date >= now) {
      upcoming.push({
        unitId: row.unit_id,
        purchaser: row.purchaser_name,
        handoverDate: row.handover_date,
      });
    }
  }

  const labels = Object.keys(monthGroups).slice(-6);
  const values = labels.map((k) => monthGroups[k]);

  return {
    data: { monthGroups, upcoming: upcoming.slice(0, 20) },
    summary: `${upcoming.length} upcoming handovers. Next 6 months: ${labels.map((l, i) => `${l}: ${values[i]}`).join(', ')}.`,
    chartData: { type: 'bar', labels, values },
  };
}

export async function getHomeownerActivity(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string,
  days = 7
): Promise<FunctionResult> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('messages')
    .select('id, user_id, question_topic, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', since);

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: msgs, error } = await query;
  if (error) throw new Error(`getHomeownerActivity: ${error.message}`);

  const uniqueUsers = new Set((msgs || []).map((m: any) => m.user_id).filter(Boolean));
  const topicCounts: Record<string, number> = {};
  for (const m of msgs || []) {
    if (m.question_topic) {
      topicCounts[m.question_topic] = (topicCounts[m.question_topic] || 0) + 1;
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));

  return {
    data: { messageCount: msgs?.length || 0, uniqueUsers: uniqueUsers.size, topTopics },
    summary: `${msgs?.length || 0} messages from ${uniqueUsers.size} homeowners in the last ${days} days. Top topics: ${topTopics.map((t) => `${t.topic} (${t.count})`).join(', ') || 'none'}.`,
  };
}

export async function getStagePaymentStatus(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string
): Promise<FunctionResult> {
  let query = supabase
    .from('unit_sales_pipeline')
    .select('id, release_date, sale_agreed_date, deposit_date, contracts_issued_date, signed_contracts_date, counter_signed_date, drawdown_date, handover_date, sale_price')
    .eq('tenant_id', tenantId);

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: pipeline, error } = await query;
  if (error) throw new Error(`getStagePaymentStatus: ${error.message}`);

  const stageNames = [
    'release', 'sale_agreed', 'deposit', 'contracts_issued',
    'signed_contracts', 'counter_signed', 'drawdown', 'handover',
  ] as const;

  const dateFields: Record<string, string> = {
    release: 'release_date',
    sale_agreed: 'sale_agreed_date',
    deposit: 'deposit_date',
    contracts_issued: 'contracts_issued_date',
    signed_contracts: 'signed_contracts_date',
    counter_signed: 'counter_signed_date',
    drawdown: 'drawdown_date',
    handover: 'handover_date',
  };

  const stages = stageNames.map((name) => {
    const field = dateFields[name];
    const atStage = (pipeline || []).filter((p: any) => p[field]);
    const totalValue = atStage.reduce((sum: number, p: any) => sum + (Number(p.sale_price) || 0), 0);
    return { name, count: atStage.length, totalValue };
  });

  return {
    data: { stages },
    summary: stages.map((s) => `${s.name}: ${s.count} units`).join(', '),
    chartData: {
      type: 'bar',
      labels: stages.map((s) => s.name.replace(/_/g, ' ')),
      values: stages.map((s) => s.count),
    },
  };
}

export async function getProjectedRevenue(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string,
  month?: string
): Promise<FunctionResult> {
  const targetMonth = month || new Date().toISOString().slice(0, 7);
  const startDate = `${targetMonth}-01`;
  const endParts = targetMonth.split('-');
  const endYear = parseInt(endParts[0]);
  const endMonth = parseInt(endParts[1]);
  const endDate = endMonth === 12
    ? `${endYear + 1}-01-01`
    : `${endYear}-${String(endMonth + 1).padStart(2, '0')}-01`;

  let query = supabase
    .from('unit_sales_pipeline')
    .select('id, unit_id, sale_price, handover_date, purchaser_name')
    .eq('tenant_id', tenantId)
    .gte('handover_date', startDate)
    .lt('handover_date', endDate);

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: pipeline, error } = await query;
  if (error) throw new Error(`getProjectedRevenue: ${error.message}`);

  const projectedRevenue = (pipeline || []).reduce((sum: number, p: any) => sum + (Number(p.sale_price) || 0), 0);
  const units = (pipeline || []).map((p: any) => ({
    unitId: p.unit_id,
    purchaser: p.purchaser_name,
    salePrice: Number(p.sale_price) || 0,
    handoverDate: p.handover_date,
  }));

  return {
    data: { month: targetMonth, projectedRevenue, unitCount: units.length, units },
    summary: `Projected revenue for ${targetMonth}: €${(projectedRevenue / 1000).toFixed(0)}k across ${units.length} units.`,
  };
}

export async function getDocumentCoverage(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string
): Promise<FunctionResult> {
  let query = supabase
    .from('documents')
    .select('id, discipline, processing_status, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: docs, error } = await query;
  if (error) throw new Error(`getDocumentCoverage: ${error.message}`);

  const totalDocs = docs?.length || 0;
  const processedDocs = docs?.filter((d: any) => d.processing_status === 'processed').length || 0;
  const coveragePercent = totalDocs > 0 ? Math.round((processedDocs / totalDocs) * 100) : 0;

  const byDiscipline: Record<string, number> = {};
  for (const d of docs || []) {
    const disc = d.discipline || 'unclassified';
    byDiscipline[disc] = (byDiscipline[disc] || 0) + 1;
  }
  const disciplineList = Object.entries(byDiscipline)
    .sort((a, b) => b[1] - a[1])
    .map(([discipline, count]) => ({ discipline, count }));

  return {
    data: { totalDocs, processedDocs, coveragePercent, byDiscipline: disciplineList },
    summary: `${totalDocs} documents, ${processedDocs} processed (${coveragePercent}% coverage). Disciplines: ${disciplineList.map((d) => `${d.discipline} (${d.count})`).join(', ')}.`,
    chartData: {
      type: 'donut',
      labels: disciplineList.slice(0, 6).map((d) => d.discipline),
      values: disciplineList.slice(0, 6).map((d) => d.count),
    },
  };
}

export async function getMostAskedQuestions(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string,
  days = 7
): Promise<FunctionResult> {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  let query = supabase
    .from('messages')
    .select('question_topic')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .not('question_topic', 'is', null);

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: msgs, error } = await query;
  if (error) throw new Error(`getMostAskedQuestions: ${error.message}`);

  const topicCounts: Record<string, number> = {};
  for (const m of msgs || []) {
    topicCounts[m.question_topic] = (topicCounts[m.question_topic] || 0) + 1;
  }

  const total = msgs?.length || 0;
  const topics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));

  return {
    data: { topics, totalMessages: total },
    summary: `Top questions (last ${days} days): ${topics.slice(0, 5).map((t) => `${t.topic} (${t.count}, ${t.percentage}%)`).join(', ')}.`,
    chartData: {
      type: 'bar',
      labels: topics.slice(0, 5).map((t) => t.topic),
      values: topics.slice(0, 5).map((t) => t.count),
    },
  };
}

export async function getOutstandingSnags(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string
): Promise<FunctionResult> {
  let query = supabase
    .from('maintenance_requests')
    .select('id, category, priority, status, title, created_at')
    .neq('status', 'resolved');

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: requests, error } = await query;
  if (error) throw new Error(`getOutstandingSnags: ${error.message}`);

  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const r of requests || []) {
    const cat = r.category || 'uncategorised';
    const pri = r.priority || 'routine';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    byPriority[pri] = (byPriority[pri] || 0) + 1;
  }

  return {
    data: {
      total: requests?.length || 0,
      byCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
      byPriority: Object.entries(byPriority).map(([priority, count]) => ({ priority, count })),
    },
    summary: `${requests?.length || 0} outstanding snags/maintenance requests. By priority: ${Object.entries(byPriority).map(([p, c]) => `${p}: ${c}`).join(', ')}.`,
  };
}

export async function getKitchenSelections(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string
): Promise<FunctionResult> {
  let query = supabase
    .from('unit_sales_pipeline')
    .select('id, kitchen_selected, kitchen_counter, kitchen_cabinet, kitchen_handle, sale_price')
    .eq('tenant_id', tenantId);

  if (developmentId) query = query.eq('development_id', developmentId);

  const { data: pipeline, error } = await query;
  if (error) throw new Error(`getKitchenSelections: ${error.message}`);

  const total = pipeline?.length || 0;
  const selected = pipeline?.filter((p: any) => p.kitchen_selected).length || 0;
  const notSelected = total - selected;

  const byCounter: Record<string, number> = {};
  const byCabinet: Record<string, number> = {};
  for (const p of pipeline || []) {
    if (p.kitchen_counter) byCounter[p.kitchen_counter] = (byCounter[p.kitchen_counter] || 0) + 1;
    if (p.kitchen_cabinet) byCabinet[p.kitchen_cabinet] = (byCabinet[p.kitchen_cabinet] || 0) + 1;
  }

  return {
    data: { selected, notSelected, total, byCounter, byCabinet },
    summary: `${selected} of ${total} units have made kitchen selections (${notSelected} pending).`,
    chartData: {
      type: 'donut',
      labels: ['Selected', 'Pending'],
      values: [selected, notSelected],
    },
  };
}

export async function getSchemeSummary(
  supabase: SupabaseClient,
  tenantId: string,
  developmentId?: string
): Promise<FunctionResult> {
  // Get scheme name — check both developments table (by id) and projects table (by id)
  let schemeName = 'All Schemes';
  if (developmentId) {
    const { data: dev } = await supabase
      .from('developments')
      .select('name')
      .eq('id', developmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (dev?.name) {
      schemeName = dev.name;
    } else {
      // Fallback: check projects table (Supabase project UUID)
      const { data: proj } = await supabase
        .from('projects')
        .select('name')
        .eq('id', developmentId)
        .maybeSingle();
      if (proj?.name) schemeName = proj.name;
    }
  }

  // Run aggregation queries in parallel — fault-tolerant (one failure won't break summary)
  const settled = await Promise.allSettled([
    getRegistrationRate(supabase, tenantId, developmentId),
    getHandoverPipeline(supabase, tenantId, developmentId),
    getHomeownerActivity(supabase, tenantId, developmentId, 7),
    getDocumentCoverage(supabase, tenantId, developmentId),
  ]);

  const [regResult, handoverResult, activityResult, docResult] = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.error(`[getSchemeSummary] sub-query ${i} failed:`, r.reason?.message);
    return { data: {}, summary: '' } as FunctionResult;
  });

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000);
  const upcomingHandovers = (handoverResult.data?.upcoming || []).filter(
    (u: any) => new Date(u.handoverDate) <= thirtyDaysFromNow
  );

  const summary = {
    schemeName,
    totalUnits: regResult.data?.total ?? 0,
    registeredHomeowners: regResult.data?.registered ?? 0,
    registrationRate: regResult.data?.rate ?? 0,
    upcomingHandovers30Days: upcomingHandovers.length,
    activeMessages7Days: activityResult.data?.messageCount ?? 0,
    documentCount: docResult.data?.totalDocs ?? 0,
    documentCoverage: docResult.data?.coveragePercent ?? 0,
  };

  return {
    data: summary,
    summary: `${schemeName}: ${summary.totalUnits} units, ${summary.registeredHomeowners} registered (${summary.registrationRate}%), ${summary.upcomingHandovers30Days} handovers in 30 days, ${summary.activeMessages7Days} messages this week, ${summary.documentCount} documents (${summary.documentCoverage}% processed).`,
  };
}

// Registry for the router to look up functions by name
export const FUNCTION_REGISTRY: Record<string, (supabase: SupabaseClient, tenantId: string, developmentId?: string, ...args: any[]) => Promise<FunctionResult>> = {
  getRegistrationRate,
  getHandoverPipeline,
  getHomeownerActivity,
  getStagePaymentStatus,
  getProjectedRevenue,
  getDocumentCoverage,
  getMostAskedQuestions,
  getOutstandingSnags,
  getKitchenSelections,
  getSchemeSummary,
};
