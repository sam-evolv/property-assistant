import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminContextFromSession, isSuperAdmin } from '@/lib/api-auth';
import { runBackfill, findProjectsNeedingBackfill, BackfillSummary } from '@/lib/backfill-unit-types';

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

const jobLock = {
  inProgress: false,
  lastRun: null as Date | null,
  lastRunBy: null as string | null,
};

const RATE_LIMIT_MS = 30000;

export async function GET() {
  try {
    const adminContext = await getAdminContextFromSession();
    
    if (!adminContext || !isSuperAdmin(adminContext)) {
      return NextResponse.json(
        { error: 'Unauthorized. Super-admin access required.' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const projectsNeedingBackfill = await findProjectsNeedingBackfill(supabase);

    const { data: allProjects } = await supabase
      .from('projects')
      .select('id, name')
      .order('name');

    return NextResponse.json({
      projectsNeedingBackfill,
      allProjects: allProjects || [],
      jobStatus: {
        inProgress: jobLock.inProgress,
        lastRun: jobLock.lastRun?.toISOString() || null,
        lastRunBy: jobLock.lastRunBy,
      },
    });
  } catch (error) {
    console.error('[Admin Backfill Unit Types] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch status' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminContext = await getAdminContextFromSession();
    
    if (!adminContext || !isSuperAdmin(adminContext)) {
      console.warn(`[Admin Backfill] Unauthorized attempt by ${adminContext?.email || 'unknown'}`);
      return NextResponse.json(
        { error: 'Unauthorized. Super-admin access required.' },
        { status: 403 }
      );
    }

    if (jobLock.inProgress) {
      return NextResponse.json(
        { error: 'A backfill job is already in progress. Please wait.' },
        { status: 429 }
      );
    }

    if (jobLock.lastRun && Date.now() - jobLock.lastRun.getTime() < RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil((RATE_LIMIT_MS - (Date.now() - jobLock.lastRun.getTime())) / 1000);
      return NextResponse.json(
        { error: `Rate limited. Please wait ${waitSeconds} seconds before running again.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { dryRun, projectId, allProjects, confirmAll } = body as {
      dryRun: boolean;
      projectId?: string;
      allProjects?: boolean;
      confirmAll?: boolean;
    };

    if (typeof dryRun !== 'boolean') {
      return NextResponse.json(
        { error: 'dryRun parameter is required (boolean)' },
        { status: 400 }
      );
    }

    if (!projectId && !allProjects) {
      return NextResponse.json(
        { error: 'Either projectId or allProjects must be specified' },
        { status: 400 }
      );
    }

    if (allProjects && !confirmAll) {
      return NextResponse.json(
        { error: 'Running on all projects requires confirmAll=true' },
        { status: 400 }
      );
    }

    jobLock.inProgress = true;
    jobLock.lastRunBy = adminContext.email;

    console.log(`[Admin Backfill] Started by ${adminContext.email} - mode: ${dryRun ? 'dry-run' : 'apply'}, target: ${projectId || 'all projects'}`);

    try {
      const supabase = getSupabaseAdmin();
      
      const summary: BackfillSummary = await runBackfill(supabase, {
        dryRun,
        projectId,
        allProjects,
        executedBy: adminContext.email,
      });

      console.log(`[Admin Backfill] Completed by ${adminContext.email} - ${summary.projectsProcessed} projects, ${summary.totalUnitTypesCreated} types created, ${summary.totalUnitsUpdated} units updated`);

      jobLock.lastRun = new Date();
      jobLock.inProgress = false;

      return NextResponse.json({
        success: true,
        summary,
      });
    } catch (error) {
      jobLock.inProgress = false;
      throw error;
    }
  } catch (error) {
    console.error('[Admin Backfill Unit Types] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backfill failed' },
      { status: 500 }
    );
  }
}
