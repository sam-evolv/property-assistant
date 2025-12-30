import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
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
];

const PROTECTED_PATHS = [
  '/admin',
  '/super',
  '/developer',
  '/portal',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/')) ||
         Boolean(pathname.match(/^\/developments\/[^\/]+\/units\/[^\/]+$/));
}

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(path => pathname.startsWith(path));
}

type AdminRole = 'super_admin' | 'developer' | 'admin' | 'tenant_admin';

function resolveDefaultRoute(role: AdminRole | null, preferredRole?: AdminRole | null): string {
  if (!role) {
    return '/access-pending';
  }
  
  const routingRole = preferredRole || role;
  
  switch (routingRole) {
    case 'super_admin':
      return '/super';
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
  
  if (role === 'developer' || role === 'admin' || role === 'tenant_admin') {
    return pathname.startsWith('/developer') || pathname.startsWith('/portal');
  }
  
  return false;
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

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

  const isLoginPage = pathname === '/login';
  const isAccessPendingPage = pathname === '/access-pending';
  
  if (isPublicPath(pathname) && !isLoginPage) {
    return res;
  }

  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

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

  return res;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
