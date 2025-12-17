export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Test login only available in development' }, { status: 403 });
  }

  try {
    const { email } = await request.json();
    
    const supabase = createServerComponentClient({ cookies });
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: 'test123', // Test password
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[TEST LOGIN] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
