import { NextRequest, NextResponse } from 'next/server';
import { requireRole, type AdminSession } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { developments, units } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Houses API] Fetching houses for development:', params.id);
    const session = await requireRole(['developer', 'super_admin']);
    console.log('[Houses API] Session validated');
    const developmentId = params.id;

    const development = await db.query.developments.findFirst({
      where: eq(developments.id, developmentId),
    });

    if (!development) {
      console.log('[Houses API] Development not found:', developmentId);
      return NextResponse.json({ error: 'Development not found' }, { status: 404 });
    }

    console.log('[Houses API] Querying units table for development:', developmentId);
    const houses = await db.query.units.findMany({
      where: eq(units.development_id, developmentId),
      orderBy: (units, { asc }) => [asc(units.created_at)],
    });

    console.log('[Houses API] Found houses:', houses.length);
    if (houses.length > 0) {
      console.log('[Houses API] Sample house fields:', Object.keys(houses[0]));
    }

    return NextResponse.json({ houses });
  } catch (error) {
    console.error('[Development Houses Error]:', error);
    return NextResponse.json(
      { error: 'Failed to fetch houses' },
      { status: 500 }
    );
  }
}
