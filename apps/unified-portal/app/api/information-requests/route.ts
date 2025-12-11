import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db';
import { informationRequests } from '@openhouse/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
const DEFAULT_DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';

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

    const newRequest = await db.insert(informationRequests).values({
      tenant_id: DEFAULT_TENANT_ID,
      development_id: DEFAULT_DEVELOPMENT_ID,
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
    const limit = parseInt(searchParams.get('limit') || '50');

    const conditions = [
      eq(informationRequests.tenant_id, DEFAULT_TENANT_ID),
      eq(informationRequests.development_id, DEFAULT_DEVELOPMENT_ID),
    ];

    if (status) {
      conditions.push(eq(informationRequests.status, status));
    }

    const requests = await db
      .select()
      .from(informationRequests)
      .where(and(...conditions))
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
