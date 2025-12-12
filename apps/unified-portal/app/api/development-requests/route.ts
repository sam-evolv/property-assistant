import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { developmentRequests, admins } from '@openhouse/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { getServerSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let requests;
    
    if (session.role === 'super_admin') {
      requests = await db.query.developmentRequests.findMany({
        orderBy: [desc(developmentRequests.created_at)],
        with: {
          developer: {
            columns: {
              id: true,
              email: true,
            },
          },
          tenant: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });
    } else if (session.role === 'developer') {
      requests = await db.query.developmentRequests.findMany({
        where: eq(developmentRequests.developer_id, session.id),
        orderBy: [desc(developmentRequests.created_at)],
      });
    } else {
      requests = await db.query.developmentRequests.findMany({
        where: eq(developmentRequests.tenant_id, session.tenantId),
        orderBy: [desc(developmentRequests.created_at)],
        with: {
          developer: {
            columns: {
              id: true,
              email: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error('[Development Requests] Error fetching:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { proposedName, locationCounty, locationAddress, estimatedUnits, targetGoLive, notes } = body;

    if (!proposedName?.trim()) {
      return NextResponse.json(
        { error: 'Proposed development name is required' },
        { status: 400 }
      );
    }

    const newRequest = await db.insert(developmentRequests).values({
      developer_id: session.id,
      tenant_id: session.tenantId,
      proposed_name: proposedName.trim(),
      location_county: locationCounty?.trim() || null,
      location_address: locationAddress?.trim() || null,
      estimated_units: estimatedUnits ? parseInt(estimatedUnits) : null,
      target_go_live: targetGoLive?.trim() || null,
      notes: notes?.trim() || null,
      status: 'new',
    }).returning();

    console.log(`[Development Requests] New request created: ${proposedName} by ${session.email}`);

    return NextResponse.json({ 
      success: true, 
      request: newRequest[0] 
    }, { status: 201 });
  } catch (error) {
    console.error('[Development Requests] Error creating:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create request' },
      { status: 500 }
    );
  }
}
