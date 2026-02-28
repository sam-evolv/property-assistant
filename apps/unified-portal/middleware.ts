import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isIOSSafari(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua) && !/crios/.test(ua) && !/fxios/.test(ua);
  return isIOS && isSafari;
}

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/install',
  '/access-pending',
  '/reset-password',
  '/homes',
  '/qr',
  '/units',
  '/purchaser',
  '/welcome',
  '/intro',
  '/onboarding',
  '/chat',
  '/unauthorized',
  '/test-hub',
  '/test-page',
  '/api/public',
  '/archive',
  '/smart-archive',
  '/dev-tools',
  '/care',
];

const PROTECTED_PATHS = [
  '/admin',
  '/super',
  '/developer',
  '/portal',
  '/care-dashboard',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/')) ||
         Boolean(pathname.match(/^\/developments\/[^\/]+\/units\/[^\/]+$/));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => pathname.startsWith(path));
}

type AdminRole = 'super_admin' | 'developer' | 'admin' | 'tenant_admin' | 'installer' | 'installer_admin';

function resolveDefaultRoute(role: AdminRole | null, preferredRole?: AdminRole | null): string {
  if (!role) {
    return '/access-pending';
  }

  const routingRole = preferredRole || role;

  switch (routingRole) {
    case 'super_admin':
      return '/super';
    case 'installer':
    case 'installer_admin':
      return '/care-dashboard';
    case 'developer':
    case 'admin':
    case 'tenant_admin':
      return '/developer';
    default:
      return '/access-pending';
  }
}

function isRoleAllowedForPath(role: AdminRole | null, pathname: string): boolean {
  if (!role) {
    return false;
  }

  if (role === 'super_admin') {
    return true;
  }

  if (pathname.startsWith('/super')) {
    return false;
  }

  if (pathname.startsWith('/admin')) {
    return false;
  }

  if (role === 'installer' || role === 'installer_admin') {
    return pathname.startsWith('/care-dashboard');
  }

  if (role === 'developer' || role === 'admin' || role === 'tenant_admin') {
    return pathname.startsWith('/developer') || pathname.startsWith('/portal');
  }

  return false;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;
  const hasSupabaseAuthEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/branding/') ||
    pathname.includes('.')
  ) {
    return res;
  }

  if (pathname.startsWith('/homes/') && pathname !== '/homes/') {
    const userAgent = req.headers.get('user-agent') || '';
    const iosInstallDismissed = req.cookies.get('ios_install_dismissed')?.value;

    // Check if user has a token in the URL (from login code entry or QR scan)
    // If they have a token, they entered a login code - don't show install prompt
    const hasToken = req.nextUrl.searchParams.has('token');

    // Check referer to see if user came from /purchaser (manual code entry)
    const referer = req.headers.get('referer') || '';
    const cameFromPurchaserLogin = referer.includes('/purchaser');

    // Only show iOS install prompt if:
    // 1. User is on iOS Safari
    // 2. They haven't dismissed it before
    // 3. They DON'T have a token (meaning they didn't enter a login code)
    // 4. They didn't come from the purchaser login page
    if (isIOSSafari(userAgent) && !iosInstallDismissed && !hasToken && !cameFromPurchaserLogin) {
      const installUrl = new URL('/install', req.url);
      installUrl.searchParams.set('target', pathname + req.nextUrl.search);
      return NextResponse.redirect(installUrl);
    }
  }

  const isLoginPage = pathname === '/login';
  const isAccessPendingPage = pathname === '/access-pending';
  
  if (isPublicPath(pathname) && !isLoginPage) {
    return res;
  }

  if (!hasSupabaseAuthEnv) {
    if (isProtectedPath(pathname)) {
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('env', 'missing-supabase-auth');
      return NextResponse.redirect(redirectUrl);
    }
    return res;
  }

  let user: { email?: string | null } | null = null;
  let error: unknown = null;

  try {
    const supabase = createMiddlewareClient({ req, res });
    const authResult = await supabase.auth.getUser();
    user = authResult.data.user;
    error = authResult.error;

    const isAuthenticated = Boolean(user) && !error;

    if (!isAuthenticated) {
      if (isLoginPage || isAccessPendingPage || isPublicPath(pathname)) {
        return res;
      }
      const redirectUrl = new URL('/login', req.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthenticated && isLoginPage) {
      const explicitRedirectTo = req.nextUrl.searchParams.get('redirectTo');
      
      if (explicitRedirectTo && explicitRedirectTo.startsWith('/') && !explicitRedirectTo.startsWith('//')) {
        return NextResponse.redirect(new URL(explicitRedirectTo, req.url));
      }
      
      return res;
    }

    if (isAuthenticated && isProtectedPath(pathname)) {
      let role: AdminRole | null = null;
      let preferredRole: AdminRole | null = null;
      
      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('role, preferred_role')
          .eq('email', user!.email)
          .single();
        
        if (!adminError && adminData?.role) {
          role = adminData.role as AdminRole;
          preferredRole = adminData.preferred_role as AdminRole | null;
        }
      } catch (e) {
        console.error('[Middleware] Error fetching admin role:', e);
      }
      
      if (!isRoleAllowedForPath(role, pathname)) {
        const correctRoute = resolveDefaultRoute(role, preferredRole);
        return NextResponse.redirect(new URL(correctRoute, req.url));
      }
    }
  } catch (middlewareError) {
    console.error('[Middleware] auth middleware failed:', middlewareError);
    if (isProtectedPath(pathname)) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return res;
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
