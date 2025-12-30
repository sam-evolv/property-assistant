export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { db } from '@openhouse/db/client';
import { admins } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

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
  
  return sorted[0];
}

function resolveDefaultLanding(effectiveRole: AdminRole | null): string {
  if (!effectiveRole) {
    return '/access-pending';
  }
  
  switch (effectiveRole) {
    case 'developer':
      return '/developer';
    case 'admin':
    case 'tenant_admin':
      return '/developer';
    case 'super_admin':
      return '/super';
    default:
      return '/access-pending';
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirectTo');
  
  console.log('[POST-LOGIN] === SERVER REDIRECT START ===');
  
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user?.email) {
      console.log('[POST-LOGIN] No authenticated user, redirecting to /login');
      return NextResponse.redirect(new URL('/login', url.origin));
    }
    
    console.log('[POST-LOGIN] User email:', user.email);
    
    const adminRecords = await db.query.admins.findMany({
      where: eq(admins.email, user.email),
      columns: {
        id: true,
        role: true,
      },
    });
    
    console.log('[POST-LOGIN] Admin records found:', adminRecords.length);
    
    if (!adminRecords || adminRecords.length === 0) {
      console.log('[POST-LOGIN] No admin records, redirecting to /access-pending');
      return NextResponse.redirect(new URL(`/access-pending?email=${encodeURIComponent(user.email)}`, url.origin));
    }
    
    const roles = adminRecords.map(a => a.role as AdminRole);
    console.log('[POST-LOGIN] All roles:', roles);
    
    const effectiveRole = getEffectiveRoleForLanding(roles);
    console.log('[POST-LOGIN] Effective role for landing:', effectiveRole);
    
    let targetRoute = resolveDefaultLanding(effectiveRole);
    
    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      console.log('[POST-LOGIN] Explicit redirectTo provided:', redirectTo);
      targetRoute = redirectTo;
    }
    
    console.log('[POST-LOGIN] === FINAL REDIRECT TO:', targetRoute, '===');
    
    return NextResponse.redirect(new URL(targetRoute, url.origin));
  } catch (error: any) {
    console.error('[POST-LOGIN] Error:', error.message);
    return NextResponse.redirect(new URL('/login', url.origin));
  }
}
