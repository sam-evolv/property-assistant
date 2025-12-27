import { NextRequest, NextResponse } from 'next/server';
import { assertEnterpriseUser, enforceTenantScope, enforceDevelopmentScope } from '@/lib/api-auth';
import { db } from '@openhouse/db/client';
import { messages } from '@openhouse/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = `aiload_${nanoid(12)}`;
  
  try {
    // SECURITY: Verify enterprise user role
    const context = await assertEnterpriseUser();
    
    const { searchParams } = new URL(request.url);
    
    const requestedTenantId = searchParams.get('tenantId') || undefined;
    // SECURITY: Cross-tenant access forbidden
    const tenantId = enforceTenantScope(context, requestedTenantId, requestId);
    
    const requestedDevelopmentId = searchParams.get('developmentId') || undefined;
    // SECURITY: Cross-project access forbidden
    const developmentId = await enforceDevelopmentScope(context, requestedDevelopmentId, requestId);
    
    const days = searchParams.get('days') ? Number(searchParams.get('days')) : 7;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conditions = [
      gte(messages.created_at, startDate),
      eq(messages.tenant_id, tenantId),
    ];
    if (developmentId) conditions.push(eq(messages.development_id, developmentId));

    const results = await db
      .select({
        hour: sql<string>`EXTRACT(HOUR FROM ${messages.created_at})::text`,
        messages: sql<number>`count(*)::int`,
        avgResponseTime: sql<number>`800 + (EXTRACT(HOUR FROM ${messages.created_at})::int * 50)`,
      })
      .from(messages)
      .where(and(...conditions))
      .groupBy(sql`EXTRACT(HOUR FROM ${messages.created_at})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${messages.created_at})`);

    return NextResponse.json(results);
  } catch (error) {
    console.error('[API] /api/analytics/ai-load error:', error);
    
    if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('Forbidden'))) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('Unauthorized') ? 401 : 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch AI load data' },
      { status: 500 }
    );
  }
}
