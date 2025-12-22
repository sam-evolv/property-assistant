export const dynamic = 'force-dynamic';

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    await supabase.auth.signOut();
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Auth API] Logout error:', error);
    return NextResponse.json({ error: error.message || 'Logout failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    await supabase.auth.signOut();
    
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'));
  } catch (error: any) {
    console.error('[Auth API] Logout error:', error);
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'));
  }
}
