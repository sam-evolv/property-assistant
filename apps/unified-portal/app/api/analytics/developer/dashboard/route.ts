import { NextRequest, NextResponse } from 'next/server';
import { assertDeveloper, enforceTenantScope, enforceDevelopmentScope } from '@/lib/api-auth';
import { db } from '@openhouse/db';
import { messages, homeowners, documents } from '@openhouse/db/schema';
import { sql, gte, and, eq, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createClient } from '@supabase/supabase-js';
import { resolveArchiveProjectIds } from '@/lib/archive-documents';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

export const dynamic = 'force-dynamic';

function createErrorResponse(
  requestId: string, 
  error: string, 
  details: string | null,
  status: number
) {
  return NextResponse.json(
    { 
      error, 
      details,
      requestId,
      endpoint: '/api/analytics/developer/dashboard',
      timestamp: new Date().toISOString(),
    },
    { 
      status,
      headers: { 'x-request-id': requestId }
    }
  );
}

export async function GET(request: NextRequest) {
  const requestId = `dash_${nanoid(12)}`;
  
  try {
    // SECURITY: Verify developer role - fails if not authenticated
    const context = await assertDeveloper();
    
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get('tenantId') || undefined;
    // SECURITY: Cross-tenant access forbidden - logs violation and throws on mismatch
    const tenantId = enforceTenantScope(context, requestedTenantId, requestId);
    
    const requestedDevelopmentId = searchParams.get('developmentId') || undefined;
    // SECURITY: Cross-project access forbidden - logs violation and throws on mismatch
    const developmentId = await enforceDevelopmentScope(context, requestedDevelopmentId, requestId);
    
    const days = parseInt(searchParams.get('days') || '30');

    const now = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - (days * 2));
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const supabaseAdmin = getSupabaseAdmin();

    // Swallow per-query failures so one broken source never blocks the dashboard
    // (same graceful-fallback semantics as before, now allowing independent queries to run concurrently).
    const safe = async <T,>(fallback: T, fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (_e) {
        return fallback;
      }
    };

    // SQL fragments scoping unit-keyed tables (via the units table) to this tenant / development
    const unitScope = developmentId
      ? sql`u.tenant_id = ${tenantId}::uuid AND u.project_id::text = ${developmentId}`
      : sql`u.tenant_id = ${tenantId}::uuid`;

    // Units are stored in Supabase, use Supabase client to query them
    // SECURITY: Always filter by tenant_id unconditionally (defense-in-depth)
    const countUnits = async (onlyOnboarded: boolean): Promise<number> => {
      let q = supabaseAdmin.from('units').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId); // SECURITY: Always filter by tenant
      if (onlyOnboarded) {
        // Onboarded units - those with purchaser_name set
        q = q.not('purchaser_name', 'is', null);
      }
      if (developmentId) {
        q = q.eq('project_id', developmentId);
      }
      const { count: c, error } = await q;
      return error ? 0 : (c || 0);
    };

    // Full unit list (paginated past the 1000-row Supabase default)
    // SECURITY: Always filter by tenant_id unconditionally (defense-in-depth)
    type UnitRow = { id: string; project_id: string; house_type_code: string | null };
    const fetchAllUnits = async (): Promise<UnitRow[]> => {
      const PAGE_SIZE = 1000;
      const rows: UnitRow[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        let q = supabaseAdmin.from('units').select('id, project_id, house_type_code')
          .eq('tenant_id', tenantId) // SECURITY: Always filter by tenant
          .order('id', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (developmentId) {
          q = q.eq('project_id', developmentId);
        }
        const { data, error } = await q;
        if (error) throw error;
        rows.push(...((data || []) as UnitRow[]));
        if (!data || data.length < PAGE_SIZE) break;
      }
      return rows;
    };

    // Active homeowners - distinct identities with a real portal interaction in [from, to):
    // 1. Chat messages (messages) and analytics events like logins, QR scans, doc opens, signups (analytics_events)
    // 2. Document acknowledgements (purchaser_agreements + units.important_docs_agreed_at), scoped to this tenant's units
    const fetchActiveIds = async (from: Date, to: Date | null): Promise<Set<string>> => {
      const msgTo = to ? sql`AND m.created_at < ${to}` : sql``;
      const aeTo = to ? sql`AND ae.created_at < ${to}` : sql``;
      const paTo = to ? sql`AND pa.agreed_at < ${to}` : sql``;
      const docsTo = to ? sql`AND u.important_docs_agreed_at < ${to}` : sql``;

      const [engagementIds, acknowledgementIds] = await Promise.all([
        safe<string[]>([], async () => {
          const result = await (developmentId
            ? db.execute(sql`
                SELECT DISTINCT user_id FROM (
                  -- Users who sent chat messages
                  SELECT m.user_id::text AS user_id FROM messages m
                  WHERE m.development_id = ${developmentId}::uuid
                    AND m.created_at >= ${from} ${msgTo}
                    AND m.user_id IS NOT NULL AND m.user_id::text != 'anonymous'

                  UNION

                  -- Users with analytics events (logins, QR scans, doc opens, signups)
                  SELECT COALESCE(ae.event_data->>'unit_id', ae.session_hash) as user_id
                  FROM analytics_events ae
                  WHERE ae.development_id = ${developmentId}::uuid
                    AND ae.created_at >= ${from} ${aeTo}
                    AND ae.event_type IN ('portal_visit', 'login', 'qr_scan', 'document_open', 'purchaser_signup')
                    AND (ae.event_data->>'unit_id' IS NOT NULL OR ae.session_hash IS NOT NULL)
                ) all_active
                WHERE user_id IS NOT NULL
              `)
            : db.execute(sql`
                SELECT DISTINCT user_id FROM (
                  -- Users who sent chat messages
                  SELECT m.user_id::text AS user_id FROM messages m
                  INNER JOIN developments d ON m.development_id = d.id
                  WHERE d.tenant_id = ${tenantId}::uuid
                    AND m.created_at >= ${from} ${msgTo}
                    AND m.user_id IS NOT NULL AND m.user_id::text != 'anonymous'

                  UNION

                  -- Users with analytics events (logins, QR scans, doc opens, signups)
                  SELECT COALESCE(ae.event_data->>'unit_id', ae.session_hash) as user_id
                  FROM analytics_events ae
                  WHERE ae.tenant_id = ${tenantId}::uuid
                    AND ae.created_at >= ${from} ${aeTo}
                    AND ae.event_type IN ('portal_visit', 'login', 'qr_scan', 'document_open', 'purchaser_signup')
                    AND (ae.event_data->>'unit_id' IS NOT NULL OR ae.session_hash IS NOT NULL)
                ) all_active
                WHERE user_id IS NOT NULL
              `));
          return (result.rows as { user_id: string }[]).map(r => String(r.user_id));
        }),
        safe<string[]>([], async () => {
          const result = await db.execute(sql`
            SELECT pa.unit_id::text AS unit_id
            FROM purchaser_agreements pa
            INNER JOIN units u ON pa.unit_id::text = u.id::text
            WHERE ${unitScope}
              AND pa.agreed_at >= ${from} ${paTo}

            UNION

            SELECT u.id::text AS unit_id
            FROM units u
            WHERE ${unitScope}
              AND u.important_docs_agreed_at >= ${from} ${docsTo}
          `);
          return (result.rows as { unit_id: string }[]).map(r => String(r.unit_id));
        }),
      ]);
      return new Set([...engagementIds, ...acknowledgementIds]);
    };

    const messageCount = async (from: Date, to: Date | null): Promise<number> => {
      const msgTo = to ? sql`AND m.created_at < ${to}` : sql``;
      const result = await (developmentId
        ? db.execute(sql`SELECT COUNT(*)::int as count FROM messages m WHERE m.development_id = ${developmentId} AND m.created_at >= ${from} ${msgTo}`)
        : db.execute(sql`SELECT COUNT(*)::int as count FROM messages m INNER JOIN developments d ON m.development_id = d.id WHERE d.tenant_id = ${tenantId} AND m.created_at >= ${from} ${msgTo}`));
      return (result.rows[0] as { count: number } | undefined)?.count || 0;
    };

    // Independent queries run concurrently; each falls back gracefully on failure.
    const [
      totalUnits,
      onboardedUnits,
      allUnits,
      activeIds,
      previousActiveIds,
      totalMessages,
      previousMessages,
      questionTopicsResult,
      docStats,
      acknowledgedUnitsMap,
      recentQuestionsResult,
      chatActivityResult,
      upcomingHandovers,
      registrationEvents,
      acknowledgmentEvents,
    ] = await Promise.all([
      safe(0, () => countUnits(false)),
      safe(0, () => countUnits(true)),
      safe<UnitRow[] | null>(null, fetchAllUnits),
      safe(new Set<string>(), () => fetchActiveIds(sevenDaysAgo, null)),
      // Previous period for comparison
      safe(new Set<string>(), () => fetchActiveIds(previousStartDate, sevenDaysAgo)),
      // Message counts - Use JOIN through developments for tenant filtering
      safe(0, () => messageCount(startDate, null)),
      safe(0, () => messageCount(previousStartDate, startDate)),
      // Question topics - Use JOIN through developments for tenant filtering
      safe({ rows: [] as { topic: string; count: number }[] }, async () => {
        const result = await (developmentId
          ? db.execute(sql`
              SELECT COALESCE(question_topic, 'general') as topic, COUNT(*)::int as count
              FROM messages m WHERE m.development_id = ${developmentId} AND m.created_at >= ${startDate} AND m.user_message IS NOT NULL
              GROUP BY COALESCE(question_topic, 'general') ORDER BY COUNT(*) DESC LIMIT 8
            `)
          : db.execute(sql`
              SELECT COALESCE(m.question_topic, 'general') as topic, COUNT(*)::int as count
              FROM messages m INNER JOIN developments d ON m.development_id = d.id
              WHERE d.tenant_id = ${tenantId} AND m.created_at >= ${startDate} AND m.user_message IS NOT NULL
              GROUP BY COALESCE(m.question_topic, 'general') ORDER BY COUNT(*) DESC LIMIT 8
            `));
        return result as unknown as { rows: { topic: string; count: number }[] };
      }),
      // Documents filed - distinct archive files (not RAG chunks), counted the same way as
      // the Documents page: document_sections deduped by metadata.source / file_name.
      safe({ total: 0, houseTypeCodes: [] as string[] }, async () => {
        const projectIds = await resolveArchiveProjectIds(tenantId, developmentId);
        if (projectIds.length === 0) return { total: 0, houseTypeCodes: [] as string[] };
        const files = new Set<string>();
        const houseTypeCodes = new Set<string>();
        const PAGE_SIZE = 1000;
        for (let from = 0; ; from += PAGE_SIZE) {
          let q = supabaseAdmin.from('document_sections').select('id, metadata')
            .order('id', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);
          q = projectIds.length === 1 ? q.eq('project_id', projectIds[0]) : q.in('project_id', projectIds);
          const { data, error } = await q;
          if (error) throw error;
          for (const row of (data || []) as { metadata: Record<string, unknown> | null }[]) {
            const meta = row.metadata || {};
            files.add(String(meta.source || meta.file_name || 'Unknown'));
            if (meta.house_type_code) houseTypeCodes.add(String(meta.house_type_code));
          }
          if (!data || data.length < PAGE_SIZE) break;
        }
        return { total: files.size, houseTypeCodes: [...houseTypeCodes] };
      }),
      // Must-read acknowledgements from purchaser_agreements (same source as Homeowners page),
      // scoped to this tenant's units: latest agreed docs_version per unit
      safe(new Map<string, number>(), async () => {
        const result = await db.execute(sql`
          SELECT DISTINCT ON (pa.unit_id) pa.unit_id::text AS unit_id, pa.docs_version
          FROM purchaser_agreements pa
          INNER JOIN units u ON pa.unit_id::text = u.id::text
          WHERE ${unitScope}
          ORDER BY pa.unit_id, pa.agreed_at DESC
        `);
        const map = new Map<string, number>();
        for (const row of result.rows as { unit_id: string; docs_version: number | null }[]) {
          map.set(row.unit_id, row.docs_version || 1);
        }
        return map;
      }),
      // Recent questions - Use JOIN through developments for tenant filtering
      safe({ rows: [] as { user_message: string; question_topic: string; created_at: string; metadata: Record<string, unknown> | null }[] }, async () => {
        const result = await (developmentId
          ? db.execute(sql`
              SELECT user_message, question_topic, created_at, metadata FROM messages m
              WHERE m.development_id = ${developmentId} AND m.user_message IS NOT NULL AND m.created_at >= ${startDate}
              ORDER BY m.created_at DESC LIMIT 20
            `)
          : db.execute(sql`
              SELECT m.user_message, m.question_topic, m.created_at, m.metadata FROM messages m
              INNER JOIN developments d ON m.development_id = d.id
              WHERE d.tenant_id = ${tenantId} AND m.user_message IS NOT NULL AND m.created_at >= ${startDate}
              ORDER BY m.created_at DESC LIMIT 20
            `));
        return result as unknown as { rows: { user_message: string; question_topic: string; created_at: string; metadata: Record<string, unknown> | null }[] };
      }),
      // Chat activity - Use JOIN through developments for tenant filtering
      safe({ rows: [] as { date: string; count: number }[] }, async () => {
        const result = await (developmentId
          ? db.execute(sql`
              SELECT DATE(created_at) as date, COUNT(*)::int as count FROM messages m
              WHERE m.development_id = ${developmentId} AND m.created_at >= ${startDate}
              GROUP BY DATE(m.created_at) ORDER BY DATE(m.created_at) ASC
            `)
          : db.execute(sql`
              SELECT DATE(m.created_at) as date, COUNT(*)::int as count FROM messages m
              INNER JOIN developments d ON m.development_id = d.id
              WHERE d.tenant_id = ${tenantId} AND m.created_at >= ${startDate}
              GROUP BY DATE(m.created_at) ORDER BY DATE(m.created_at) ASC
            `));
        return result as unknown as { rows: { date: string; count: number }[] };
      }),
      // Upcoming handovers: units handing over in the next 60 days
      safe<Array<{ address: string; unit_id: string | null; unit_uid: string | null; handover_date: string }>>([], async () => {
        const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
        let handoverQuery = supabaseAdmin
          .from('unit_sales_pipeline')
          .select('unit_id, handover_date, units!inner(id, address, unit_uid, tenant_id, development_id)')
          .eq('units.tenant_id', tenantId)
          .gte('handover_date', now.toISOString().split('T')[0])
          .lte('handover_date', in60Days.toISOString().split('T')[0])
          .order('handover_date', { ascending: true })
          .limit(10);
        if (developmentId) {
          handoverQuery = handoverQuery.eq('units.development_id', developmentId);
        }
        const { data: handoverData, error: handoverError } = await handoverQuery;
        if (handoverError || !handoverData) return [];
        return (handoverData as unknown as Array<{ unit_id?: string | null; units?: { id?: string | null; address?: string; unit_uid?: string | null } | null; handover_date: string }>).map((row) => ({
          address: row.units?.address || 'Unknown address',
          unit_id: row.units?.id || row.unit_id || null,
          unit_uid: row.units?.unit_uid || null,
          handover_date: row.handover_date,
        }));
      }),
      // Activity feed 1: recent unit registrations (last 30 days)
      safe<Array<{ type: string; label: string; sublabel: string; date: string; link?: string }>>([], async () => {
        let regQuery = supabaseAdmin.from('units')
          .select('purchaser_name, address, created_at')
          .eq('tenant_id', tenantId)
          .not('purchaser_name', 'is', null)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(10);
        if (developmentId) {
          regQuery = regQuery.eq('project_id', developmentId);
        }
        const { data: regData, error: regError } = await regQuery;
        if (regError || !regData) return [];
        return regData.map((u) => ({
          type: 'registration',
          label: `${u.purchaser_name} registered`,
          sublabel: u.address || 'Unknown address',
          date: u.created_at,
          link: '/developer/homeowners',
        }));
      }),
      // Activity feed 2: recent document acknowledgments (purchaser_agreements), scoped to tenant / development
      safe<Array<{ type: string; label: string; sublabel: string; date: string; link?: string }>>([], async () => {
        const ackResult = await db.execute(sql`
          SELECT pa.agreed_at, u.address
          FROM purchaser_agreements pa
          INNER JOIN units u ON pa.unit_id::text = u.id::text
          WHERE ${unitScope}
            AND pa.agreed_at >= ${startDate}
          ORDER BY pa.agreed_at DESC
          LIMIT 10
        `);
        return (ackResult.rows as { agreed_at: string; address: string | null }[]).map((row) => ({
          type: 'acknowledgment',
          label: `${row.address || 'A unit'} acknowledged documents`,
          sublabel: 'Must-read docs confirmed',
          date: row.agreed_at,
          link: '/developer/homeowners',
        }));
      }),
    ]);

    // Use onboarded units as registered homeowners
    const registeredHomeowners = onboardedUnits;

    // Active homeowners = distinct identities with real activity, never more than the units in scope
    const activeHomeowners = Math.min(activeIds.size, totalUnits);
    const previousActive = Math.min(previousActiveIds.size, totalUnits);

    // Document coverage: house types (from this scope's units) that have at least one active document
    const normaliseHouseType = (code: string) => code.trim().toUpperCase();
    const unitHouseTypes = new Set(
      (allUnits || [])
        .map(u => u.house_type_code)
        .filter((c): c is string => !!c && c.trim() !== '')
        .map(normaliseHouseType)
    );
    const documentedHouseTypes = new Set(docStats.houseTypeCodes.map(normaliseHouseType));
    const coveredHouseTypes = [...unitHouseTypes].filter(ht => documentedHouseTypes.has(ht)).length;
    const docCoverage = {
      total_docs: docStats.total,
      covered_house_types: coveredHouseTypes,
      total_house_types: unitHouseTypes.size,
    };

    // Must-read compliance - Count units that have acknowledged important docs
    // Use the same approach as Homeowners page: purchaser_agreements docs_version vs project important_docs_version
    let mustRead = { total_units: totalUnits, acknowledged: 0 };
    if (allUnits && allUnits.length > 0) {
      try {
        // Get development version from 'projects' table (Supabase)
        const developmentIds = [...new Set(allUnits.map(u => u.project_id))];
        const { data: projects } = await supabaseAdmin
          .from('projects')
          .select('id, important_docs_version')
          .in('id', developmentIds);

        // Create a map of development_id -> important_docs_version
        const devVersionMap: Record<string, number> = {};
        (projects || []).forEach((p: { id: string; important_docs_version: number | null }) => {
          devVersionMap[p.id] = p.important_docs_version || 0;
        });

        // Count units that have acknowledged - same logic as Homeowners page
        let acknowledgedCount = 0;
        for (const unit of allUnits) {
          const agreedVersion = acknowledgedUnitsMap.get(unit.id) || 0;
          const devVersion = devVersionMap[unit.project_id] || 0;

          // If no version is set anywhere (devVersion === 0), check if agreed at least version 1
          // Otherwise, check if agreed >= dev version
          if (devVersion === 0) {
            if (agreedVersion >= 1) {
              acknowledgedCount++;
            }
          } else {
            if (agreedVersion >= devVersion) {
              acknowledgedCount++;
            }
          }
        }

        mustRead = { total_units: totalUnits, acknowledged: acknowledgedCount };
      } catch (_e) {
          // error handled silently
      }
    }

    // House type breakdown from the (complete) unit list
    const houseTypeCounts = (allUnits || []).reduce((acc: Record<string, number>, u) => {
      if (u.house_type_code) {
        acc[u.house_type_code] = (acc[u.house_type_code] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    const houseTypeEngagementResult = {
      rows: Object.entries(houseTypeCounts).slice(0, 10).map(([ht, count]) => ({
        house_type_code: ht, active_users: 0, message_count: count as number
      }))
    };

    // All values are now set above with graceful fallbacks
    // Debug logging

    // Onboarding rate = units with purchaser info / total units
    const onboardingRate = totalUnits > 0 
      ? Math.round((registeredHomeowners / totalUnits) * 100) 
      : 0;
    
    // Engagement rate = active users in 7 days / total units
    const engagementRate = totalUnits > 0 
      ? Math.round((activeHomeowners / totalUnits) * 100) 
      : 0;
    
    const activeGrowth = previousActive > 0 
      ? Math.round(((activeHomeowners - previousActive) / previousActive) * 100) 
      : (activeHomeowners > 0 ? 100 : 0);
    
    const messageGrowth = previousMessages > 0 
      ? Math.round(((totalMessages - previousMessages) / previousMessages) * 100) 
      : (totalMessages > 0 ? 100 : 0);

    const documentCoverageRate = docCoverage.total_house_types > 0
      ? Math.round((docCoverage.covered_house_types / docCoverage.total_house_types) * 100)
      : 0;

    const mustReadRate = mustRead.total_units > 0
      ? Math.round((mustRead.acknowledged / mustRead.total_units) * 100)
      : 0;

    // Calculate previous period rates for comparison
    // Engagement has historical data via previousActive from messages table
    const previousEngagementRate = totalUnits > 0 
      ? Math.round((previousActive / totalUnits) * 100)
      : 0;
    
    // Calculate deltas (percentage points difference)
    // Engagement delta is always calculated when we have units (even if previous was 0)
    const engagementDelta = totalUnits > 0 ? engagementRate - previousEngagementRate : undefined;
    
    // Onboarding and Must-Read don't have historical snapshots yet
    // Return undefined to indicate no comparison available (UI will not show badge)
    const onboardingDelta = undefined;
    const mustReadDelta = undefined;

    const formatTopicLabel = (topic: string): string => {
      if (!topic) return 'General';
      // Exclude POI (point-of-interest) geographic entries misclassified as homeowner topics
      if (topic.startsWith('poi_') || topic === 'poi') return '';
      return topic
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    const questionTopics = questionTopicsResult.rows
      .map(row => ({
        topic: row.topic,
        label: formatTopicLabel(row.topic),
        count: row.count,
      }))
      .filter(item => item.label !== '');

    const chatActivity = chatActivityResult.rows.map(row => ({
      date: row.date,
      count: row.count,
    }));

    const onboardingFunnel = [
      { stage: 'Total Units', count: totalUnits, colour: '#D4AF37' },
      { stage: 'Registered', count: registeredHomeowners, colour: '#93C5FD' },
      { stage: 'Active (7d)', count: activeHomeowners, colour: '#34D399' },
    ];

    const unansweredQueries = recentQuestionsResult.rows
      .filter(row => {
        const meta = row.metadata as Record<string, unknown> | null;
        return meta?.confidence === 'low' || meta?.no_context === true;
      })
      .slice(0, 5)
      .map(row => ({
        question: row.user_message?.substring(0, 100) + (row.user_message?.length > 100 ? '...' : ''),
        topic: formatTopicLabel(row.question_topic || 'general'),
        date: row.created_at,
      }));

    const houseTypeEngagement = houseTypeEngagementResult.rows.map(row => ({
      houseType: row.house_type_code,
      activeUsers: row.active_users,
      messageCount: row.message_count,
    }));


    // --- Real activity feed events ---
    // 1. Recent unit registrations, 2. Recent document acknowledgments (fetched above)
    const recentEvents: Array<{ type: string; label: string; sublabel: string; date: string; link?: string }> = [
      ...registrationEvents,
      ...acknowledgmentEvents,
    ];

    // 3. Knowledge gap questions (reuse unansweredQueries already computed above)
    for (const q of unansweredQueries) {
      recentEvents.push({
        type: 'gap',
        label: `Knowledge gap: ${q.question.slice(0, 40)}${q.question.length > 40 ? '...' : ''}`,
        sublabel: `Topic: ${q.topic}`,
        date: q.date,
      });
    }

    // 4. Fallback: chat activity summary if total events < 3
    if (recentEvents.length < 3) {
      for (const day of chatActivity.slice().reverse()) {
        if (day.count > 0) {
          recentEvents.push({
            type: 'chat',
            label: `${day.count} homeowner conversation${day.count > 1 ? 's' : ''}`,
            sublabel: 'Chat activity',
            date: day.date,
          });
        }
      }
    }

    // Sort all events by date descending and limit to 10
    recentEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    recentEvents.splice(10);

    return NextResponse.json({
      requestId,
      kpis: {
        onboardingRate: {
          value: onboardingRate,
          label: 'Onboarding Rate',
          description: `${registeredHomeowners} of ${totalUnits} units onboarded`,
          suffix: '%',
          delta: onboardingDelta,
          inactiveCount: Math.max(0, totalUnits - registeredHomeowners),
        },
        engagementRate: {
          value: engagementRate,
          label: 'Engagement Rate',
          description: `${activeHomeowners} of ${totalUnits} active (7d)`,
          suffix: '%',
          growth: activeGrowth,
          delta: engagementDelta,
          inactiveCount: Math.max(0, totalUnits - activeHomeowners),
        },
        documentCoverage: {
          value: documentCoverageRate,
          label: 'Document Coverage',
          description: `${docCoverage?.covered_house_types || 0} of ${docCoverage?.total_house_types || 0} house types`,
          suffix: '%',
        },
        mustReadCompliance: {
          value: mustReadRate,
          label: 'Must-Read Compliance',
          description: `${mustRead?.acknowledged || 0} of ${mustRead?.total_units || 0} units acknowledged`,
          suffix: '%',
          delta: mustReadDelta,
          pendingCount: (mustRead?.total_units || 0) - (mustRead?.acknowledged || 0),
        },
      },
      questionTopics,
      chatActivity,
      onboardingFunnel,
      unansweredQueries,
      houseTypeEngagement,
      upcomingHandovers,
      recentEvents,
      summary: {
        totalUnits,
        registeredHomeowners,
        activeHomeowners,
        totalMessages,
        messageGrowth,
        totalDocuments: docCoverage?.total_docs || 0,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return createErrorResponse(requestId, 'Authentication required', errorMessage, 401);
    }
    
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return createErrorResponse(requestId, 'Access denied', errorMessage, 403);
    }
    
    // Database or query errors
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return createErrorResponse(requestId, 'Database schema error', 'Required table missing - contact support', 500);
    }
    
    if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
      return createErrorResponse(requestId, 'Database connection failed', 'Unable to connect to database', 503);
    }
    
    return createErrorResponse(requestId, 'Failed to load dashboard', errorMessage, 500);
  }
}
