import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public paths that bypass authentication (purchaser/QR code flows)
const PUBLIC_PATHS = [
  '/homes',
  '/qr',
  '/chat',
  '/unauthorized',
  '/test-hub',
];

// Protected paths that require authentication
const PROTECTED_PATHS = [
  '/admin',
  '/super',
  '/developer',
  '/portal',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path)) ||
         Boolean(pathname.match(/^\/developments\/[^\/]+\/units\/[^\/]+$/)); // /developments/:id/units/:unitId
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => pathname.startsWith(path));
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  // Skip middleware for API routes, static files, auth callbacks, and Next.js internals
  // Purchaser APIs are public and require no authentication
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/auth/callback') ||
    pathname.includes('.')
  ) {
    return res;
  }

  const isLoginPage = pathname === '/login';
  
  // Allow public paths to bypass authentication entirely (purchaser QR flow)
  if (isPublicPath(pathname)) {
    return res;
  }

  // Create Supabase client and refresh session for all other paths
  const supabase = createMiddlewareClient({ req, res });

  // Use getUser() instead of getSession() for security
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user) && !error;

  // DEFAULT: Require authentication for all non-public paths
  // Redirect unauthenticated users to login (except login page itself)
  if (!isAuthenticated && !isLoginPage) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users away from login page
  if (isAuthenticated && isLoginPage) {
    const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/dashboard';
    // Prevent open redirect attacks - only allow internal paths
    const safeRedirectTo = redirectTo.startsWith('/') && !redirectTo.startsWith('//') 
      ? redirectTo 
      : '/dashboard';
    return NextResponse.redirect(new URL(safeRedirectTo, req.url));
  }

  // CRITICAL: Return the Supabase-updated response to persist cookies
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
