import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins, userDevelopments, documents } from '@openhouse/db/schema';
import { eq, and, isNull, or, notInArray, sql } from 'drizzle-orm';
import { classifyDocumentWithAI } from '@/lib/ai-classify';

const VALID_DISCIPLINES = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape'];

async function validateTenantAdminAccess(
  userId: string,
  tenantId: string,
  developmentId?: string
): Promise<{ valid: boolean; error?: string }> {
  const admin = await db.query.admins.findFirst({
    where: and(
      eq(admins.id, userId),
      eq(admins.tenant_id, tenantId)
    ),
    columns: { id: true, role: true }
  });

  if (!admin) {
    return { valid: false, error: 'Admin not found' };
  }

  if (admin.role === 'super_admin' || admin.role === 'tenant_admin') {
    return { valid: true };
  }

  if (developmentId) {
    const hasAccess = await db.query.userDevelopments.findFirst({
      where: and(
        eq(userDevelopments.user_id, userId),
        eq(userDevelopments.development_id, developmentId)
      ),
      columns: { user_id: true }
    });

    if (!hasAccess) {
      return { valid: false, error: 'No access to this development' };
    }
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, developmentId, limit = 50 } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const access = await validateTenantAdminAccess(user.id, tenantId, developmentId);
    if (!access.valid) {
      return NextResponse.json({ error: access.error }, { status: 403 });
    }

    const conditions = [
      eq(documents.tenant_id, tenantId),
      eq(documents.status, 'active'),
      or(
        isNull(documents.discipline),
        notInArray(sql`lower(${documents.discipline})`, VALID_DISCIPLINES)
      )
    ];

    if (developmentId) {
      conditions.push(eq(documents.development_id, developmentId));
    }

    const unclassifiedDocs = await db
      .select({
        id: documents.id,
        file_name: documents.file_name,
        title: documents.title
      })
      .from(documents)
      .where(and(...conditions))
      .limit(Math.min(limit, 100));

    console.log(`[BulkClassify] Found ${unclassifiedDocs.length} unclassified documents`);

    const results: Array<{
      id: string;
      fileName: string;
      discipline: string;
      confidence: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const doc of unclassifiedDocs) {
      try {
        const classification = await classifyDocumentWithAI(doc.file_name || doc.title || '');

        await db
          .update(documents)
          .set({
            discipline: classification.discipline,
            ai_classified: true,
            ai_classified_at: new Date(),
            ai_tags: classification.suggestedTags,
            processing_status: 'complete',
            updated_at: new Date()
          })
          .where(eq(documents.id, doc.id));

        results.push({
          id: doc.id,
          fileName: doc.file_name || doc.title || '',
          discipline: classification.discipline,
          confidence: classification.confidence,
          success: true
        });

        console.log(`[BulkClassify] ${doc.file_name || doc.title} => ${classification.discipline}`);
      } catch (error) {
        console.error(`[BulkClassify] Failed for ${doc.file_name}:`, error);
        results.push({
          id: doc.id,
          fileName: doc.file_name || doc.title || '',
          discipline: 'other',
          confidence: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    await db.execute(sql`
      DELETE FROM search_cache 
      WHERE tenant_id = ${tenantId}::uuid
    `);

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      processed: results.length,
      successCount,
      failCount,
      remaining: Math.max(0, unclassifiedDocs.length - limit),
      results
    });

  } catch (error) {
    console.error('[BulkClassify] Error:', error);
    return NextResponse.json(
      { error: 'Bulk classification failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const conditions = [
      eq(documents.tenant_id, tenantId),
      eq(documents.status, 'active'),
      or(
        isNull(documents.discipline),
        notInArray(sql`lower(${documents.discipline})`, VALID_DISCIPLINES)
      )
    ];

    if (developmentId) {
      conditions.push(eq(documents.development_id, developmentId));
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(...conditions));

    return NextResponse.json({
      unclassifiedCount: result?.count || 0
    });

  } catch (error) {
    console.error('[BulkClassify] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get unclassified count' },
      { status: 500 }
    );
  }
}
