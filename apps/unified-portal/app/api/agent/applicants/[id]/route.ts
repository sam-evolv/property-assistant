import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import {
  computeIncomeToRentRatio,
  type ApplicantDetail,
} from '@/lib/agent-intelligence/applicants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/applicants/:id
 * Returns the full applicant detail with the signals section
 * (employment, income, household, references + AML statuses) and the
 * linked viewings + applications lists.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = getSupabaseAdmin();

    const { data: applicant, error } = await supabase
      .from('agent_applicants')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!applicant) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const [
      { data: attendees },
      { data: applications },
    ] = await Promise.all([
      supabase
        .from('agent_rental_viewing_attendees')
        .select('id, rental_viewing_id, was_preferred')
        .eq('applicant_id', params.id),
      supabase
        .from('agent_rental_applications')
        .select('id, letting_property_id, status, references_status, aml_status, application_date')
        .eq('applicant_id', params.id)
        .order('application_date', { ascending: false }),
    ]);

    const viewingIds = (attendees || []).map((a) => a.rental_viewing_id).filter(Boolean);
    const propertyIdsFromApps = (applications || []).map((a) => a.letting_property_id).filter(Boolean);
    const propertyIdsFromViewings: string[] = [];

    let viewingRows: any[] = [];
    if (viewingIds.length) {
      const { data } = await supabase
        .from('agent_rental_viewings')
        .select('id, letting_property_id, viewing_date, interest_level')
        .in('id', viewingIds);
      viewingRows = data || [];
      for (const v of viewingRows) {
        if (v.letting_property_id) propertyIdsFromViewings.push(v.letting_property_id);
      }
    }

    const propertyIds = Array.from(new Set([...propertyIdsFromApps, ...propertyIdsFromViewings]));
    let propertyById = new Map<string, { address: string | null; rent_pcm: number | null }>();
    if (propertyIds.length) {
      const { data: props } = await supabase
        .from('agent_letting_properties')
        .select('id, address, address_line_1, rent_pcm')
        .in('id', propertyIds);
      for (const p of props || []) {
        propertyById.set(p.id, {
          address: p.address || p.address_line_1 || null,
          rent_pcm: p.rent_pcm ?? null,
        });
      }
    }

    const latestApp = (applications || [])[0];
    const latestRent = latestApp
      ? propertyById.get(latestApp.letting_property_id)?.rent_pcm ?? null
      : null;

    const detail: ApplicantDetail = {
      id: applicant.id,
      fullName: applicant.full_name,
      email: applicant.email,
      phone: applicant.phone,
      source: applicant.source,
      linkedPropertyCount: new Set(propertyIdsFromApps).size,
      latestStatus: (latestApp?.status as ApplicantDetail['latestStatus']) ?? null,
      lastActivityAt: latestApp?.application_date || applicant.updated_at || applicant.created_at,
      preferredCount: (attendees || []).filter((a) => a.was_preferred).length,
      currentAddress: applicant.current_address,
      budgetMonthly: applicant.budget_monthly,
      requestedMoveInDate: applicant.requested_move_in_date,
      notes: applicant.notes,
      signals: {
        employmentStatus: applicant.employment_status,
        employer: applicant.employer,
        annualIncome: applicant.annual_income,
        incomeToRentRatio: computeIncomeToRentRatio(applicant.annual_income, latestRent),
        householdSize: applicant.household_size,
        hasPets: applicant.has_pets,
        petDetails: applicant.pet_details,
        smoker: applicant.smoker,
        referencesStatus: latestApp?.references_status ?? null,
        amlStatus: latestApp?.aml_status ?? null,
      },
      viewings: viewingRows.map((v) => {
        const preferredMatch = (attendees || []).find((a) => a.rental_viewing_id === v.id);
        return {
          id: v.id,
          propertyAddress: propertyById.get(v.letting_property_id)?.address || null,
          viewingDate: v.viewing_date,
          wasPreferred: !!preferredMatch?.was_preferred,
          interestLevel: v.interest_level,
        };
      }),
      applications: (applications || []).map((a) => ({
        id: a.id,
        propertyAddress: propertyById.get(a.letting_property_id)?.address || null,
        rentPcm: propertyById.get(a.letting_property_id)?.rent_pcm ?? null,
        status: a.status,
        referencesStatus: a.references_status,
        amlStatus: a.aml_status,
        applicationDate: a.application_date,
      })),
    };

    return NextResponse.json({ applicant: detail });
  } catch (error: any) {
    console.error('[agent/applicants/:id GET] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PATCH /api/agent/applicants/:id
 * Basic edit form — only the fields the settings screen allows the agent
 * to change are accepted. Anything else is silently ignored.
 */
const EDITABLE_FIELDS = new Set([
  'full_name',
  'email',
  'phone',
  'current_address',
  'employment_status',
  'employer',
  'annual_income',
  'household_size',
  'has_pets',
  'pet_details',
  'smoker',
  'requested_move_in_date',
  'source',
  'budget_monthly',
  'notes',
]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();
    const cookieStore = cookies();
    const supabaseAuth = createRouteHandlerClient({ cookies: () => cookieStore });
    const { data: { user } } = await supabaseAuth.auth.getUser();

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(body || {})) {
      if (EDITABLE_FIELDS.has(k)) updates[k] = v;
    }

    const { data: existing } = await supabase
      .from('agent_applicants')
      .select('id, agent_id')
      .eq('id', params.id)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (user) {
      const { data: profile } = await supabase
        .from('agent_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profile && existing.agent_id !== profile.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from('agent_applicants')
      .update(updates)
      .eq('id', params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
