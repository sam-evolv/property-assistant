export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { informationRequests, units } from '@openhouse/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// Helper to resolve tenant/development from unit
async function resolveUnitContext(unitId: string | null): Promise<{ tenantId: string | null; developmentId: string | null }> {
  if (!unitId) return { tenantId: null, developmentId: null };
  
  try {
    const { rows } = await db.execute(sql`
      SELECT u.tenant_id, u.development_id 
      FROM units u 
      WHERE u.id = ${unitId}::uuid OR u.unit_uid = ${unitId}
      LIMIT 1
    `);
    if (rows.length > 0) {
      const unit = rows[0] as any;
      return { tenantId: unit.tenant_id, developmentId: unit.development_id };
    }
  } catch (e) {
    console.log('[InfoRequest] Could not resolve unit context:', e);
  }
  return { tenantId: null, developmentId: null };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, context, unitId, topic } = body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Resolve tenant/development from unit - MUST succeed for proper isolation
    const unitContext = await resolveUnitContext(unitId);
    
    if (!unitContext.tenantId || !unitContext.developmentId) {
      console.error('[InfoRequest] FAIL: Could not resolve tenant/development for unit:', unitId);
      return NextResponse.json(
        { error: 'Could not resolve unit context. Please try again or contact support.' },
        { status: 422 }
      );
    }

    const newRequest = await db.insert(informationRequests).values({
      tenant_id: unitContext.tenantId,
      development_id: unitContext.developmentId,
      unit_id: unitId || null,
      question: question.trim(),
      context: context || null,
      topic: topic || null,
      status: 'pending',
      priority: 'normal',
    }).returning();

    console.log('[InfoRequest] Created new information request:', newRequest[0]?.id);

    return NextResponse.json({
      success: true,
      id: newRequest[0]?.id,
      message: 'Your question has been submitted. The developer team will review it and add this information to help future residents.',
    });
  } catch (error) {
    console.error('[InfoRequest] Error creating request:', error);
    return NextResponse.json(
      { error: 'Failed to submit request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const developmentId = searchParams.get('developmentId');
    const tenantId = searchParams.get('tenantId');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build conditions dynamically based on provided filters
    const conditions: any[] = [];
    
    if (tenantId) {
      conditions.push(eq(informationRequests.tenant_id, tenantId));
    }
    if (developmentId) {
      conditions.push(eq(informationRequests.development_id, developmentId));
    }
    if (status) {
      conditions.push(eq(informationRequests.status, status));
    }

    const requests = await db
      .select()
      .from(informationRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(informationRequests.created_at))
      .limit(limit);

    return NextResponse.json({
      success: true,
      requests,
      total: requests.length,
    });
  } catch (error) {
    console.error('[InfoRequest] Error fetching requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
