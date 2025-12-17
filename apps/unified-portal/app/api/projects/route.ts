import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const supabaseAdmin = getSupabaseAdmin();
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('id, name, address, image_url, organization_id, created_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('[API /projects] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    const { data: unitCounts, error: countError } = await supabaseAdmin
      .from('units')
      .select('project_id')
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
  } catch (err) {
    console.error('[API /projects] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
