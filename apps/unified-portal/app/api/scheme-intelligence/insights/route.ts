import { NextRequest } from 'next/server';
import { getAdminContextFromSession, enforceTenantScope } from '@/lib/api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  getRegistrationRate,
  getHandoverPipeline,
  getDocumentCoverage,
} from '@/lib/scheme-intelligence/functions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Insight {
  icon: string;
  text: string;
  href?: string;
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

    const [registration, handovers, docs] = await Promise.all([
      getRegistrationRate(supabase, tenantId, developmentId),
      getHandoverPipeline(supabase, tenantId, developmentId),
      getDocumentCoverage(supabase, tenantId, developmentId),
    ]);

    const insights: Insight[] = [];

    // Handovers within 30 days
    const thirtyDays = new Date(Date.now() + 30 * 86400000);
    const urgentHandovers = (handovers.data.upcoming || []).filter(
      (u: any) => new Date(u.handoverDate) <= thirtyDays
    );
    if (urgentHandovers.length > 0) {
      insights.push({
        icon: '⚡',
        text: `${urgentHandovers.length} handover${urgentHandovers.length === 1 ? '' : 's'} in the next 30 days`,
        href: '/developer/pipeline',
      });
    }

    // Registration rate below 50%
    if (registration.data.rate < 50 && registration.data.total > 0) {
      insights.push({
        icon: '📉',
        text: `Registration rate at ${registration.data.rate}% — ${registration.data.unregistered.length} units without homeowners`,
        href: '/developer/homeowners',
      });
    }

    // Document coverage below 80%
    if (docs.data.coveragePercent < 80 && docs.data.totalDocs > 0) {
      insights.push({
        icon: '📋',
        text: `Document coverage at ${docs.data.coveragePercent}% — ${docs.data.totalDocs - docs.data.processedDocs} documents pending processing`,
        href: '/developer/archive',
      });
    }

    return Response.json({
      insights: insights.slice(0, 2),
    });
  } catch (error) {
    console.error('[SchemeIntel Insights] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
