import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function isIOSSafari(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua) && !/crios/.test(ua) && !/fxios/.test(ua);
  return isIOS && isSafari;
}

function generateNonce(): string {
  // crypto.randomUUID is available in the edge runtime that Next middleware runs in.
  // Base64 of the UUID gives a 22-char nonce, well over the 128-bit minimum the CSP spec asks for.
  return Buffer.from(crypto.randomUUID()).toString('base64');
}

// style-src keeps 'unsafe-inline' because Tailwind and Next.js inject inline <style> tags
// during hydration. Moving styles to nonces would require a sweep we are not doing here.
// connect-src must include wss://*.supabase.co or Supabase realtime breaks in the homeowner
// portal. The Supabase host stays wildcarded so Vercel previews on staging projects still work.
// strict-dynamic in modern browsers ignores the host allowlist for scripts in favour of the
// nonce + dynamically-loaded chain; the host entries are a fallback for older browsers.
function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    'https://*.googleapis.com',
    'https://*.gstatic.com',
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com",
    // frame-src includes *.supabase.co because the Care vertical and developer
    // archive embed PDF previews served from Supabase storage in <iframe>s.
    "frame-src 'self' https://*.supabase.co https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com",
    // 'self' (not 'none') because the admin theme editor iframes a same-origin
    // preview URL. External iframing is blocked because no other origin is allowed.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/login/developer',
  '/login/agent',
  '/login/homeowner',
  '/login/care',
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
  '/care', // Homeowner care app — accessed via QR code, no auth required
  '/agent', // Agent demo — self-contained PWA with hardcoded demo data
];

const PROTECTED_PATHS = [
  '/admin',
  '/super',
  '/developer',
  '/portal',
];

function isPublicPath(pathname: string): boolean {
  // Agent dashboard requires authentication even though /agent is listed as public
  if (pathname.startsWith('/agent/dashboard')) return false;
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
  const pathname = req.nextUrl.pathname;
  const isDev = process.env.NODE_ENV === 'development';

  // Per-request nonce. Forwarded to the app via x-nonce on the request so
  // server components can read it through headers().get('x-nonce') and pass it
  // to <Script> components. Set on the response as Content-Security-Policy so
  // browsers enforce it for the document and its subresources.
  const nonce = generateNonce();
  const csp = buildCsp(nonce, isDev);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);

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

  const isLoginPage = pathname === '/login' || pathname.startsWith('/login/');
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

  let user: { id?: string; email?: string | null } | null = null;
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
      // Route to product-specific login pages
      let loginPath = '/login';
      if (pathname.startsWith('/developer') || pathname.startsWith('/admin') || pathname.startsWith('/super') || pathname.startsWith('/portal')) {
        loginPath = '/login/developer';
      } else if (pathname.startsWith('/agent')) {
        loginPath = '/login/agent';
      }
      const redirectUrl = new URL(loginPath, req.url);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthenticated && isLoginPage) {
      const explicitRedirectTo = req.nextUrl.searchParams.get('redirectTo');

      if (explicitRedirectTo && explicitRedirectTo.startsWith('/') && !explicitRedirectTo.startsWith('//')) {
        return NextResponse.redirect(new URL(explicitRedirectTo, req.url));
      }

      // On the main product selector (/login), always show the product menu
      // so users can choose which product to use. Only auto-redirect from
      // sub-login pages (e.g. /login/developer) if they have a redirectTo param.
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
      let loginPath = '/login';
      if (pathname.startsWith('/developer') || pathname.startsWith('/admin') || pathname.startsWith('/super') || pathname.startsWith('/portal')) {
        loginPath = '/login/developer';
      } else if (pathname.startsWith('/agent')) {
        loginPath = '/login/agent';
      }
      return NextResponse.redirect(new URL(loginPath, req.url));
    }
    return res;
  }

  return res;
}

export const config = {
  // Matcher includes /api/* so API responses also receive CSP and the other
  // baseline security headers. /api/health is excluded because uptime probes
  // hit it on every load-balancer interval and the header set is wasted there.
  // Static assets and common image extensions are excluded because they do not
  // render HTML or run scripts; CSP on them is meaningless.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
