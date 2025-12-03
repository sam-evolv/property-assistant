import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    try {
      await supabase.auth.exchangeCodeForSession(code);
    } catch (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
    }
  }

  // Preserve the redirectTo parameter if it exists
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';
  // Prevent open redirect attacks - only allow internal paths
  const safeRedirectTo = redirectTo.startsWith('/') && !redirectTo.startsWith('//') 
    ? redirectTo 
    : '/dashboard';
  return NextResponse.redirect(new URL(safeRedirectTo, requestUrl.origin));
}
