export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSessionWithStatus } from '@/lib/supabase-server';

export async function GET() {
  try {
    const result = await getServerSessionWithStatus();
    
    if (result.status === 'authenticated') {
      return NextResponse.json({
        id: result.session.id,
        email: result.session.email,
        role: result.session.role,
        tenantId: result.session.tenantId,
      });
    }
    
    if (result.status === 'not_provisioned') {
      return NextResponse.json({ 
        error: 'not_provisioned',
        email: result.email,
        message: result.reason
      }, { status: 403 });
    }
    
    return NextResponse.json({ 
      error: 'not_authenticated',
      message: result.reason 
    }, { status: 401 });
  } catch (error: any) {
    console.error('[AUTH ME] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
