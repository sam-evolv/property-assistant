import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { ApplicantListItem, ApplicationStatus } from '@/lib/agent-intelligence/applicants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/applicants
 * Optional ?filter=preferred|invited|received|referencing|approved
 * Returns every applicant for the authenticated agent with enrichment
 * fields (linked property count, latest status, last activity) so the
 * list view renders in a single round trip.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const agentProfile = await resolveAgentProfile(supabase, user?.id);
    if (!agentProfile) {
      return NextResponse.json({ applicants: [], count: 0 });
    }

    const filter = request.nextUrl.searchParams.get('filter') || 'all';

    const { data: applicants, error } = await supabase
      .from('agent_applicants')
      .select('id, full_name, email, phone, source, created_at, updated_at')
      .eq('agent_id', agentProfile.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!applicants || applicants.length === 0) {
      return NextResponse.json({ applicants: [], count: 0 });
    }

    const applicantIds = applicants.map((a) => a.id);

    const [
      { data: applications },
      { data: attendees },
    ] = await Promise.all([
      supabase
        .from('agent_rental_applications')
        .select('id, applicant_id, letting_property_id, status, application_date, updated_at')
        .in('applicant_id', applicantIds)
        .order('application_date', { ascending: false }),
      supabase
        .from('agent_rental_viewing_attendees')
        .select('applicant_id, was_preferred, created_at')
        .in('applicant_id', applicantIds),
    ]);

    const appsByApplicant = new Map<string, typeof applications>();
    for (const app of applications || []) {
      if (!appsByApplicant.has(app.applicant_id)) appsByApplicant.set(app.applicant_id, [] as any);
      appsByApplicant.get(app.applicant_id)!.push(app);
    }

    const preferredCountByApplicant = new Map<string, number>();
    const lastAttendanceAt = new Map<string, string>();
    for (const att of attendees || []) {
      if (!att.applicant_id) continue;
      if (att.was_preferred) {
        preferredCountByApplicant.set(att.applicant_id, (preferredCountByApplicant.get(att.applicant_id) || 0) + 1);
      }
      const prev = lastAttendanceAt.get(att.applicant_id);
      if (!prev || att.created_at > prev) {
        lastAttendanceAt.set(att.applicant_id, att.created_at);
      }
    }

    const items: ApplicantListItem[] = applicants.map((a) => {
      const apps = appsByApplicant.get(a.id) || [];
      const latest = apps[0];
      const uniqueProperties = new Set(apps.map((x: any) => x.letting_property_id));
      const attendanceAt = lastAttendanceAt.get(a.id);
      const lastActivity =
        latest?.updated_at || latest?.application_date || attendanceAt || a.updated_at || a.created_at;
      return {
        id: a.id,
        fullName: a.full_name,
        email: a.email,
        phone: a.phone,
        source: a.source,
        linkedPropertyCount: uniqueProperties.size,
        latestStatus: (latest?.status as ApplicationStatus | undefined) ?? null,
        lastActivityAt: lastActivity,
        preferredCount: preferredCountByApplicant.get(a.id) || 0,
      };
    });

    const filtered = applyFilter(items, filter);
    return NextResponse.json({ applicants: filtered, count: filtered.length });
  } catch (error: any) {
    console.error('[agent/applicants GET] Error:', error.message);
    return NextResponse.json(
      { error: 'Failed to list applicants', details: error.message },
      { status: 500 }
    );
  }
}

function applyFilter(items: ApplicantListItem[], filter: string): ApplicantListItem[] {
  switch (filter) {
    case 'preferred':
      return items.filter((i) => i.preferredCount > 0);
    case 'invited':
      return items.filter((i) => i.latestStatus === 'invited');
    case 'applied':
    case 'received':
      return items.filter((i) => i.latestStatus === 'received' || i.latestStatus === 'referencing');
    case 'approved':
      return items.filter((i) => i.latestStatus === 'approved' || i.latestStatus === 'offer_accepted');
    default:
      return items;
  }
}

async function resolveAgentProfile(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string | undefined,
): Promise<{ id: string; tenant_id: string } | null> {
  if (userId) {
    const { data } = await supabase
      .from('agent_profiles')
      .select('id, tenant_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data as any;
  }
  const { data } = await supabase
    .from('agent_profiles')
    .select('id, tenant_id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as any) || null;
}
