import { NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { onboardingSubmissions, tenants, admins } from '@openhouse/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { requireRole } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireRole(['super_admin']);

    const submissions = await db
      .select({
        id: onboardingSubmissions.id,
        tenant_id: onboardingSubmissions.tenant_id,
        tenant_name: tenants.name,
        developer_id: onboardingSubmissions.developer_id,
        developer_email: onboardingSubmissions.developer_email,
        developer_name: onboardingSubmissions.developer_name,
        company_name: onboardingSubmissions.company_name,
        development_name: onboardingSubmissions.development_name,
        development_address: onboardingSubmissions.development_address,
        county: onboardingSubmissions.county,
        estimated_units: onboardingSubmissions.estimated_units,
        expected_handover_date: onboardingSubmissions.expected_handover_date,
        planning_reference: onboardingSubmissions.planning_reference,
        planning_pack_url: onboardingSubmissions.planning_pack_url,
        master_spreadsheet_url: onboardingSubmissions.master_spreadsheet_url,
        supporting_documents_urls: onboardingSubmissions.supporting_documents_urls,
        notes: onboardingSubmissions.notes,
        status: onboardingSubmissions.status,
        admin_notes: onboardingSubmissions.admin_notes,
        created_at: onboardingSubmissions.created_at,
        updated_at: onboardingSubmissions.updated_at,
      })
      .from(onboardingSubmissions)
      .leftJoin(tenants, eq(onboardingSubmissions.tenant_id, tenants.id))
      .orderBy(desc(onboardingSubmissions.created_at));

    const stats = {
      total: submissions.length,
      pending: submissions.filter(s => s.status === 'pending').length,
      in_review: submissions.filter(s => s.status === 'in_review').length,
      completed: submissions.filter(s => s.status === 'completed').length,
      rejected: submissions.filter(s => s.status === 'rejected').length,
    };

    return NextResponse.json({ 
      submissions,
      stats,
    });
  } catch (error: any) {
    console.error('[Super Onboarding Submissions API] Error:', error);
    if (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch submissions' }, { status: 500 });
  }
}
