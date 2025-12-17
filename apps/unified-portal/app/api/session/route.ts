export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ 
        authenticated: false,
        session: null 
      }, { status: 200 });
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        id: session.id,
        email: session.email,
        role: session.role,
        tenantId: session.tenantId,
      }
    }, { status: 200 });
  } catch (error) {
    console.error('[API Session] Error fetching session:', error);
    return NextResponse.json({ 
      authenticated: false,
      session: null,
      error: 'Failed to fetch session'
    }, { status: 500 });
  }
}
