import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { units, developments, documents } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateQRToken } from '@openhouse/api/qr-tokens';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const unitUid = searchParams.get('unitUid');

    if (!token || !unitUid) {
      return NextResponse.json(
        { error: 'Token and unit UID are required' },
        { status: 400 }
      );
    }

    const payload = await validateQRToken(token);
    if (!payload || payload.unitUid !== unitUid) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const unit = await db
      .select({
        id: units.id,
        development_id: units.development_id,
        important_docs_agreed_version: units.important_docs_agreed_version,
        important_docs_agreed_at: units.important_docs_agreed_at,
        purchaser_name: units.purchaser_name,
      })
      .from(units)
      .where(eq(units.unit_uid, unitUid))
      .limit(1);

    if (!unit || unit.length === 0) {
      return NextResponse.json(
        { error: 'Unit not found' },
        { status: 404 }
      );
    }

    const development = await db
      .select({
        important_docs_version: developments.important_docs_version,
      })
      .from(developments)
      .where(eq(developments.id, unit[0].development_id))
      .limit(1);

    if (!development || development.length === 0) {
      return NextResponse.json(
        { error: 'Development not found' },
        { status: 404 }
      );
    }

    const importantDocs = await db
      .select({
        id: documents.id,
        title: documents.title,
        file_url: documents.file_url,
        important_rank: documents.important_rank,
        mime_type: documents.mime_type,
        original_file_name: documents.original_file_name,
      })
      .from(documents)
      .where(
        and(
          eq(documents.development_id, unit[0].development_id),
          eq(documents.is_important, true)
        )
      )
      .orderBy(documents.important_rank);

    // Consent is required if:
    // 1. There are important documents for this development AND
    // 2. The user hasn't agreed to the latest version (agreed_version < current_version)
    const hasImportantDocs = importantDocs.length > 0;
    const currentVersion = development[0].important_docs_version || (hasImportantDocs ? 1 : 0);
    const agreedVersion = unit[0].important_docs_agreed_version || 0;
    const requiresConsent = hasImportantDocs && agreedVersion < currentVersion;

    console.log('[Important Docs Status] Debug:', {
      unitUid,
      developmentId: unit[0].development_id,
      hasImportantDocs,
      currentVersion,
      agreedVersion,
      requiresConsent,
      importantDocsCount: importantDocs.length,
      importantDocs: importantDocs.map(d => ({ id: d.id, title: d.title, rank: d.important_rank })),
    });

    return NextResponse.json({
      requiresConsent,
      currentVersion,
      agreedVersion,
      agreedAt: unit[0].important_docs_agreed_at,
      importantDocuments: importantDocs,
    });
  } catch (error) {
    console.error('[Important Docs Status API Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch important docs status' },
      { status: 500 }
    );
  }
}
