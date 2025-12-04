import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from './session';

export async function handleGetSession(req: NextRequest) {
  try {
    const session = await getAdminSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        email: session.email,
        role: session.role,
        tenantId: session.tenantId,
      }
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}
