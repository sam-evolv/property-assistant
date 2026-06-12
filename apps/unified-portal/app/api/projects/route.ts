import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';
import { resolveAllowedProjectIds } from '@/lib/archive-documents';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface Project {
  id: string;
  name: string;
  address: string | null;
  image_url: string | null;
  organization_id: string | null;
  created_at: string;
}

export async function GET() {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const supabaseAdmin = getSupabaseAdmin();

    // SECURITY: non-super sessions only see their own tenant's projects
    // (resolved via the tenant's developments, as in /api/archive/documents)
    const isSuperAdmin = session.role === 'super_admin';
    const allowedProjectIds = isSuperAdmin ? null : await resolveAllowedProjectIds(session.tenantId);

    if (allowedProjectIds && allowedProjectIds.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    // tenant-scope: projects restricted to the session tenant's allowed project ids for non-super sessions
    let projectsQuery = supabaseAdmin
      .from('projects')
      .select('id, name, address, image_url, organization_id, created_at')
      .order('name', { ascending: true });

    if (allowedProjectIds) {
      projectsQuery = allowedProjectIds.length === 1
        ? projectsQuery.eq('id', allowedProjectIds[0])
        : projectsQuery.in('id', allowedProjectIds);
    }

    const { data: projects, error } = await projectsQuery;

    if (error) {
      console.error('[API /projects] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    // tenant-scope: unit counts restricted to the same allowed project ids for non-super sessions
    let unitCountsQuery = supabaseAdmin
      .from('units')
      .select('project_id');

    if (allowedProjectIds) {
      unitCountsQuery = allowedProjectIds.length === 1
        ? unitCountsQuery.eq('project_id', allowedProjectIds[0])
        : unitCountsQuery.in('project_id', allowedProjectIds);
    }

    const { data: unitCounts, error: countError } = await unitCountsQuery
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        if (data) {
          for (const row of data) {
            counts[row.project_id] = (counts[row.project_id] || 0) + 1;
          }
        }
        return { data: counts, error: null };
      });

    if (countError) {
      console.error('[API /projects] Error counting units:', countError);
    }

    const projectUnitCounts = unitCounts || {};

    const duplicateGroups: Record<string, Project[]> = {};
    for (const project of projects as Project[]) {
      const key = (project.name || '').toLowerCase().trim();
      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }
      duplicateGroups[key].push(project);
    }

    const canonicalProjects: Project[] = [];
    const suppressedIds: string[] = [];

    for (const [key, group] of Object.entries(duplicateGroups)) {
      if (group.length === 1) {
        canonicalProjects.push(group[0]);
      } else {
        group.sort((a, b) => {
          const aCount = projectUnitCounts[a.id] || 0;
          const bCount = projectUnitCounts[b.id] || 0;
          if (aCount !== bCount) {
            return bCount - aCount;
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

        const canonical = group[0];
        canonicalProjects.push(canonical);

        for (let i = 1; i < group.length; i++) {
          suppressedIds.push(group[i].id);
          console.log(`[API /projects] Suppressed duplicate project ${group[i].id} in favor of ${canonical.id}`);
        }
      }
    }

    canonicalProjects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    console.log('[API /projects] Found projects:', projects.length, 'canonical:', canonicalProjects.length);

    const idRemapping: Record<string, string> = {};
    for (const [key, group] of Object.entries(duplicateGroups)) {
      if (group.length > 1) {
        const canonicalId = group[0].id;
        for (let i = 1; i < group.length; i++) {
          idRemapping[group[i].id] = canonicalId;
        }
      }
    }

    return NextResponse.json({ 
      projects: canonicalProjects,
      idRemapping,
      _debug: {
        totalProjects: projects.length,
        canonicalCount: canonicalProjects.length,
        suppressedIds
      }
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED' || err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[API /projects] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
