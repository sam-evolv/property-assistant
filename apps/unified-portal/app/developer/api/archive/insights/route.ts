export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DEVELOPMENT_TO_SUPABASE_PROJECT: Record<string, string> = {
  '34316432-f1e8-4297-b993-d9b5c88ee2d8': '57dc3919-2725-4575-8046-9179075ac88e',
  'e0833063-55ac-4201-a50e-f329c090fbd6': '6d3789de-2e46-430c-bf31-22224bd878da',
  '39c49eeb-54a6-4b04-a16a-119012c531cb': '9598cf36-3e3f-4b7d-be6d-d1e80f708f46',
  '84a559d1-89f1-4eb6-a48b-7ca068bcc164': '84a559d1-89f1-4eb6-a48b-7ca068bcc164',
};

const ALL_DISCIPLINES = [
  'architectural', 'structural', 'mechanical', 'electrical',
  'plumbing', 'civil', 'landscape', 'handover', 'other',
];

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, supabaseKey);
}

function getProjectId(developmentId: string): string {
  return DEVELOPMENT_TO_SUPABASE_PROJECT[developmentId] || developmentId;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Resolve project IDs (same logic as disciplines API)
    let projectIds: string[] = [];

    if (developmentId) {
      const { data: devCheck } = await supabase
        .from('developments')
        .select('id, name')
        .eq('id', developmentId)
        .eq('tenant_id', tenantId)
        .single();

      if (!devCheck) return NextResponse.json({ error: 'No access' }, { status: 403 });

      let pid = getProjectId(developmentId);
      if (pid === developmentId && devCheck.name) {
        const { data: proj } = await supabase.from('projects').select('id').eq('name', devCheck.name).maybeSingle();
        if (proj?.id) pid = proj.id;
      }
      projectIds = [pid];
    } else {
      const { data: devs } = await supabase.from('developments').select('id').eq('tenant_id', tenantId);
      if (!devs?.length) return NextResponse.json(emptyResponse());
      projectIds = devs.map(d => getProjectId(d.id));
    }

    // Fetch all document sections
    let query = supabase.from('document_sections').select('id, metadata, project_id');
    if (projectIds.length === 1) {
      query = query.eq('project_id', projectIds[0]);
    } else {
      query = query.in('project_id', projectIds);
    }

    const { data: sections, error } = await query;
    if (error) throw error;

    // Deduplicate by source filename → unique documents
    const docMap = new Map<string, { discipline: string; houseType: string | null; aiClassified: boolean; createdAt: string }>();
    for (const s of sections || []) {
      const source = s.metadata?.source || s.metadata?.file_name || 'Unknown';
      if (!docMap.has(source)) {
        docMap.set(source, {
          discipline: (s.metadata?.discipline?.toLowerCase() || 'other'),
          houseType: s.metadata?.house_type_code || null,
          aiClassified: s.metadata?.ai_classified === true,
          createdAt: s.metadata?.created_at || new Date().toISOString(),
        });
      }
    }

    const docs = Array.from(docMap.values());
    const totalDocs = docs.length;

    // Discipline coverage
    const disciplineCount: Record<string, number> = {};
    ALL_DISCIPLINES.forEach(d => { disciplineCount[d] = 0; });
    for (const doc of docs) {
      const key = ALL_DISCIPLINES.includes(doc.discipline) ? doc.discipline : 'other';
      disciplineCount[key] = (disciplineCount[key] || 0) + 1;
    }

    const byDiscipline = Object.entries(disciplineCount)
      .filter(([, count]) => count > 0)
      .map(([discipline, count]) => ({
        discipline,
        count,
        percentage: totalDocs > 0 ? Math.round((count / totalDocs) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const foundDisciplines = new Set(byDiscipline.map(d => d.discipline));
    const missingDisciplines = ALL_DISCIPLINES.filter(d => !foundDisciplines.has(d));

    // House type coverage
    const htMap: Record<string, Set<string>> = {};
    for (const doc of docs) {
      if (doc.houseType) {
        if (!htMap[doc.houseType]) htMap[doc.houseType] = new Set();
        const key = ALL_DISCIPLINES.includes(doc.discipline) ? doc.discipline : 'other';
        htMap[doc.houseType].add(key);
      }
    }
    const houseTypeCoverage = Object.entries(htMap).map(([code, disciplines]) => {
      const discArr = Array.from(disciplines);
      const missing = ALL_DISCIPLINES.filter(d => !discArr.includes(d));
      return {
        house_type_code: code,
        development_name: '',
        disciplines: discArr,
        missing_disciplines: missing,
        coverage_percentage: Math.round((discArr.length / ALL_DISCIPLINES.length) * 100),
      };
    });

    // Classification quality
    const aiClassifiedCount = docs.filter(d => d.aiClassified).length;

    // Document currency
    const now = Date.now();
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const olderThanYear = docs.filter(d => now - new Date(d.createdAt).getTime() > oneYear).length;
    const last30 = docs.filter(d => now - new Date(d.createdAt).getTime() < thirtyDays).length;
    const last90 = docs.filter(d => now - new Date(d.createdAt).getTime() < ninetyDays).length;

    // Predicted gaps
    const avgDisc = houseTypeCoverage.length > 0
      ? houseTypeCoverage.reduce((s, h) => s + h.disciplines.length, 0) / houseTypeCoverage.length
      : 0;
    const predictedGaps = houseTypeCoverage
      .filter(h => h.disciplines.length < avgDisc)
      .slice(0, 10)
      .map(h => ({
        house_type_code: h.house_type_code,
        development_name: h.development_name,
        missing: h.missing_disciplines,
        has_count: h.disciplines.length,
        expected_count: Math.round(avgDisc),
      }));

    return NextResponse.json({
      document_coverage: {
        by_discipline: byDiscipline,
        total_documents: totalDocs,
        missing_disciplines: missingDisciplines,
      },
      house_type_coverage: houseTypeCoverage,
      classification_quality: {
        total_documents: totalDocs,
        ai_classified: aiClassifiedCount,
        needs_review: 0,
        classification_rate: totalDocs > 0 ? Math.round((aiClassifiedCount / totalDocs) * 100) : 0,
        avg_confidence: 0,
      },
      currency: {
        total_documents: totalDocs,
        docs_older_than_year: olderThanYear,
        docs_last_30_days: last30,
        docs_last_90_days: last90,
      },
      keyword_trends: [],
      predicted_gaps: predictedGaps,
    });
  } catch (error) {
    console.error('[Insights] Error:', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}

function emptyResponse() {
  return {
    document_coverage: { by_discipline: [], total_documents: 0, missing_disciplines: ALL_DISCIPLINES },
    house_type_coverage: [],
    classification_quality: { total_documents: 0, ai_classified: 0, needs_review: 0, classification_rate: 0, avg_confidence: 0 },
    currency: { total_documents: 0, docs_older_than_year: 0, docs_last_30_days: 0, docs_last_90_days: 0 },
    keyword_trends: [],
    predicted_gaps: [],
  };
}
