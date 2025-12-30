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

const ROLE_PRECEDENCE: Record<AdminRole, number> = {
  'developer': 1,
  'tenant_admin': 2,
  'admin': 3,
  'super_admin': 4,
};

function getEffectiveRoleForLanding(roles: AdminRole[]): AdminRole | null {
  if (!roles || roles.length === 0) {
    return null;
  }
  
  if (roles.length === 1) {
    return roles[0];
  }
  
  const sorted = [...roles].sort((a, b) => {
    const priorityA = ROLE_PRECEDENCE[a] ?? 999;
    const priorityB = ROLE_PRECEDENCE[b] ?? 999;
    return priorityA - priorityB;
  });
  
  console.log('[Middleware] Multiple roles detected:', roles, '-> landing role:', sorted[0]);
  return sorted[0];
}

function resolveDefaultRoute(roles: AdminRole[]): string {
  const effectiveRole = getEffectiveRoleForLanding(roles);
  
  if (!effectiveRole) {
    return '/access-pending';
  }
  
  switch (effectiveRole) {
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

function isAnyRoleAllowedForPath(roles: AdminRole[], pathname: string): boolean {
  if (!roles || roles.length === 0) {
    return false;
  }
  
  for (const role of roles) {
    if (role === 'super_admin') {
      return true;
    }
  }
  
  if (pathname.startsWith('/super')) {
    return false;
  }
  
  if (pathname.startsWith('/admin')) {
    return false;
  }
  
  for (const role of roles) {
    if (role === 'developer' || role === 'admin' || role === 'tenant_admin') {
      if (pathname.startsWith('/developer') || pathname.startsWith('/portal')) {
        return true;
      }
    }
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
    } catch (e) {
      console.error('[Middleware] Error fetching admin roles:', e);
    }
    
    if (!isAnyRoleAllowedForPath(roles, pathname)) {
      const correctRoute = resolveDefaultRoute(roles);
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
