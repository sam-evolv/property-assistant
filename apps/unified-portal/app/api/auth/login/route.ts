export const dynamic = 'force-dynamic';

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let email: string = '';
  
  try {
    const body = await request.json();
    email = body.email;
    const password = body.password;
    
    console.log('[AUTH LOGIN] Starting login attempt for:', email);
    
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log('[AUTH LOGIN] Supabase auth error for', email, ':', error.message, 'Duration:', Date.now() - startTime, 'ms');
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!data.session) {
      console.log('[AUTH LOGIN] No session returned for', email, 'Duration:', Date.now() - startTime, 'ms');
      return NextResponse.json({ error: 'No session returned' }, { status: 401 });
    }

    console.log('[AUTH LOGIN] Success for', email, 'Duration:', Date.now() - startTime, 'ms');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[AUTH LOGIN] Unexpected error for', email, ':', error.message, 'Duration:', Date.now() - startTime, 'ms');
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
