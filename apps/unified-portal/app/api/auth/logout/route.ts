export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();

    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Auth API] Logout error:', error);
    return NextResponse.json({ error: error.message || 'Logout failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    await supabase.auth.signOut();

    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'));
  } catch (error: any) {
    console.error('[Auth API] Logout error:', error);
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'));
  }
}
