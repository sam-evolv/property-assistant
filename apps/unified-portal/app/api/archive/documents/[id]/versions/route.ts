import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { document_versions, admins } from '@openhouse/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const versions = await db
      .select({
        id: document_versions.id,
        version: document_versions.version,
        file_url: document_versions.file_url,
        change_notes: document_versions.change_notes,
        created_at: document_versions.created_at,
        uploaded_by: admins.email,
      })
      .from(document_versions)
      .leftJoin(admins, eq(document_versions.uploaded_by, admins.id))
      .where(eq(document_versions.document_id, params.id))
      .orderBy(desc(document_versions.version));

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('[Versions] Failed:', error);
    return NextResponse.json({ versions: [] });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { tenantId, file_url, change_notes, version } = await req.json();

    await db.insert(document_versions).values({
      document_id: params.id,
      tenant_id: tenantId,
      version,
      file_url,
      change_notes: change_notes || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Versions POST] Failed:', error);
    return NextResponse.json({ error: 'Failed to add version' }, { status: 500 });
  }
}
