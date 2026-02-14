export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, documents, units } from '@openhouse/db/schema';
import { and, eq, sql } from 'drizzle-orm';

async function getCurrentImportantDocsVersion(
  developmentId: string
): Promise<number> {
  try {
    const result = await db.execute(sql<{ version: number }>`
      SELECT COALESCE(MAX(important_docs_version), 0)::int AS version
      FROM important_docs_agreements
      WHERE development_id = ${developmentId}::uuid
    `);
    return Number(result.rows[0]?.version ?? 0);
  } catch (error) {
    // If agreements table is unavailable in this environment, default to 0.
    return 0;
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant ID found' }, { status: 400 });
    }

    const developmentId = params.id;

    const development = await db
      .select({ id: developments.id })
      .from(developments)
      .where(
        and(eq(developments.id, developmentId), eq(developments.tenant_id, tenantId))
      )
      .limit(1);

    if (!development.length) {
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    const importantDocs = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.development_id, developmentId),
          eq(documents.is_important, true)
        )
      );

    if (!importantDocs.length) {
      return NextResponse.json(
        { error: 'No important documents found for this development' },
        { status: 400 }
      );
    }

    const currentVersion = await getCurrentImportantDocsVersion(developmentId);
    const newVersion = currentVersion + 1;

    // Update legacy column when present (some deployments still have it),
    // otherwise continue without hard-failing the publish action.
    try {
      await db.execute(sql`
        UPDATE developments
        SET important_docs_version = ${newVersion}
        WHERE id = ${developmentId}::uuid
      `);
    } catch {
      // Column not present in current schema - version is derived from agreements fallback.
    }

    const unitsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(units)
      .where(eq(units.development_id, developmentId));

    return NextResponse.json({
      success: true,
      newVersion,
      importantDocsCount: importantDocs.length,
      affectedUnitsCount: Number(unitsCount[0]?.count || 0),
    });
  } catch (error) {
    console.error('[Publish Important Docs API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to publish important documents' },
      { status: 500 }
    );
  }
}
