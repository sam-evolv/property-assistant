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

function isAnyRoleAllowedForPath(roles: AdminRole[], pathname: string): boolean {
  if (!roles || roles.length === 0) {
    console.log('[Middleware] No roles, blocking access');
    return false;
  }
  
  const hasSuperAdmin = roles.includes('super_admin');
  const hasDeveloper = roles.includes('developer');
  const hasAdmin = roles.includes('admin');
  const hasTenantAdmin = roles.includes('tenant_admin');
  
  if (pathname.startsWith('/super')) {
    const allowed = hasSuperAdmin;
    console.log('[Middleware] /super access:', allowed, 'roles:', roles);
    return allowed;
  }
  
  if (pathname.startsWith('/admin')) {
    const allowed = hasSuperAdmin || hasAdmin;
    console.log('[Middleware] /admin access:', allowed, 'roles:', roles);
    return allowed;
  }
  
  if (pathname.startsWith('/developer') || pathname.startsWith('/portal')) {
    const allowed = hasSuperAdmin || hasDeveloper || hasAdmin || hasTenantAdmin;
    console.log('[Middleware] /developer access:', allowed, 'roles:', roles);
    return allowed;
  }
  
  return false;
}

function getDefaultRouteForRoles(roles: AdminRole[]): string {
  if (roles.includes('developer')) {
    return '/developer';
  }
  if (roles.includes('tenant_admin')) {
    return '/developer';
  }
  if (roles.includes('admin')) {
    return '/developer';
  }
  if (roles.includes('super_admin')) {
    return '/super';
  }
  return '/access-pending';
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
    console.log('[Middleware] Authenticated user on /login, redirecting to /api/auth/post-login');
    return NextResponse.redirect(new URL('/api/auth/post-login', req.url));
  }

  if (isAuthenticated && isProtectedPath(pathname)) {
    const roles: AdminRole[] = [];
    
    try {
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('role')
        .eq('email', user!.email);
      
      if (!adminError && adminData && adminData.length > 0) {
        for (const record of adminData) {
          if (record.role) {
            roles.push(record.role as AdminRole);
          }
        }
      }
      
      console.log('[Middleware] Path:', pathname, 'Email:', user!.email, 'Roles:', roles);
    } catch (e) {
      console.error('[Middleware] Error fetching admin roles:', e);
    }
    
    if (!isAnyRoleAllowedForPath(roles, pathname)) {
      const correctRoute = getDefaultRouteForRoles(roles);
      console.log('[Middleware] Access denied, redirecting to:', correctRoute);
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
