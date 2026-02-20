import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { getAdminContextFromSession, enforceTenantScope } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  getSchemeSummary,
  getRegistrationRate,
  getHandoverPipeline,
  getDocumentCoverage,
  getHomeownerActivity,
  getStagePaymentStatus,
  getOutstandingSnags,
  getKitchenSelections,
} from '@/lib/scheme-intelligence/functions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BriefingItem {
  priority: 'critical' | 'important' | 'info';
  text: string;
  action?: { label: string; href: string };
}

export async function GET(request: NextRequest) {
  try {
    const adminContext = await getAdminContextFromSession();
    if (!adminContext) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['developer', 'admin', 'super_admin'].includes(adminContext.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = enforceTenantScope(adminContext);
    const developmentId = request.nextUrl.searchParams.get('developmentId') || undefined;

    const supabase = getSupabaseAdmin();

    // Run all Layer 1 functions in parallel
    const [summary, registration, handovers, docs, activity, pipeline, snags, kitchens] =
      await Promise.all([
        getSchemeSummary(supabase, tenantId, developmentId),
        getRegistrationRate(supabase, tenantId, developmentId),
        getHandoverPipeline(supabase, tenantId, developmentId),
        getDocumentCoverage(supabase, tenantId, developmentId),
        getHomeownerActivity(supabase, tenantId, developmentId, 7),
        getStagePaymentStatus(supabase, tenantId, developmentId),
        getOutstandingSnags(supabase, tenantId, developmentId),
        getKitchenSelections(supabase, tenantId, developmentId),
      ]);

    // Apply priority rules
    const items: BriefingItem[] = [];

    // CRITICAL: Handover < 14 days with doc coverage < 60%
    const fourteenDays = new Date(Date.now() + 14 * 86400000);
    const urgentHandovers = (handovers.data.upcoming || []).filter(
      (u: any) => new Date(u.handoverDate) <= fourteenDays
    );
    if (urgentHandovers.length > 0 && docs.data.coveragePercent < 60) {
      items.push({
        priority: 'critical',
        text: `${urgentHandovers.length} unit(s) have handovers within 14 days but document coverage is only ${docs.data.coveragePercent}%. Immediate action required.`,
        action: { label: 'View Pipeline', href: '/developer/pipeline' },
      });
    }

    // IMPORTANT: Registration rate < 50%
    if (registration.data.rate < 50 && registration.data.total > 0) {
      items.push({
        priority: 'important',
        text: `Registration rate is ${registration.data.rate}% (${registration.data.registered} of ${registration.data.total} units). ${registration.data.unregistered.length} units have no registered homeowner.`,
        action: { label: 'View Homeowners', href: '/developer/homeowners' },
      });
    }

    // IMPORTANT: Handover < 30 days with doc coverage < 80%
    const thirtyDays = new Date(Date.now() + 30 * 86400000);
    const upcomingHandovers30 = (handovers.data.upcoming || []).filter(
      (u: any) => new Date(u.handoverDate) <= thirtyDays
    );
    if (upcomingHandovers30.length > 0 && docs.data.coveragePercent < 80) {
      items.push({
        priority: 'important',
        text: `${upcomingHandovers30.length} handover(s) within 30 days. Document coverage at ${docs.data.coveragePercent}% — target is 80%+.`,
        action: { label: 'View Documents', href: '/developer/archive' },
      });
    }

    // INFO: Outstanding snags
    if (snags.data.total > 0) {
      items.push({
        priority: 'info',
        text: `${snags.data.total} outstanding maintenance/snag requests.`,
        action: { label: 'View Snags', href: '/developer/pipeline' },
      });
    }

    // INFO: Message volume
    if (activity.data.messageCount > 0) {
      items.push({
        priority: 'info',
        text: `${activity.data.messageCount} homeowner messages this week from ${activity.data.uniqueUsers} users. ${activity.data.topTopics.length > 0 ? `Top topic: ${activity.data.topTopics[0].topic}.` : ''}`,
      });
    }

    // INFO: Kitchen selections pending
    if (kitchens.data.notSelected > 0) {
      items.push({
        priority: 'info',
        text: `${kitchens.data.notSelected} of ${kitchens.data.total} units still pending kitchen selections.`,
        action: { label: 'View Kitchens', href: '/developer/kitchen-selections' },
      });
    }

    // Generate natural language briefing via GPT
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const briefingPrompt = `Write a concise daily briefing for a property developer. Summarise these items naturally. Keep it professional and actionable. Use bullet points.

Scheme: ${summary.data.schemeName}
Items:
${items.map((i) => `[${i.priority.toUpperCase()}] ${i.text}`).join('\n')}

Summary stats: ${summary.summary}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'You are a concise property development briefing writer. Write in bullet points. Be direct.' },
        { role: 'user', content: briefingPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const briefingText = completion.choices[0]?.message?.content || '';

    return Response.json({
      items,
      briefingText,
      schemeContext: summary.data,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SchemeIntel Briefing] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
