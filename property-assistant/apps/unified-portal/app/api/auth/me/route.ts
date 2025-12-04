import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/supabase-server';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      id: session.id,
      email: session.email,
      role: session.role,
      tenantId: session.tenantId,
    });
  } catch (error: any) {
    console.error('[AUTH ME] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
