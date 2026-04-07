import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
  const rateLimit = checkRateLimit(ip, 'provision-developer');
  if (!rateLimit.allowed) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { email, fullName, tenantId, companyName } = body;

    logger.info('[ProvisionDeveloper] Request received', { email, fullName, tenantId: tenantId || 'MISSING', companyName });

    if (!email) {
      logger.warn('[ProvisionDeveloper] Missing email');
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('admins')
      .select('id, role')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (existing) {
      logger.info('[ProvisionDeveloper] Admin already exists', { email, role: existing.role });
      return NextResponse.json({
        success: true,
        adminId: existing.id,
        role: existing.role,
        message: 'Admin record already exists'
      });
    }

    let finalTenantId = tenantId;

    if (tenantId) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single();

      if (!tenant) {
        logger.info('[ProvisionDeveloper] Tenant not found, will create new one');
        finalTenantId = null;
      }
    }

    if (!finalTenantId) {
      const tenantName = companyName || email.split('@')[0] + ' Development';
      const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      logger.info('[ProvisionDeveloper] Creating new tenant', { tenantName });

      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: tenantName,
          slug: slug + '-' + Date.now(),
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (tenantError) {
        logger.error('[ProvisionDeveloper] Failed to create tenant', tenantError);
        return NextResponse.json({
          success: false,
          error: 'Failed to create organization'
        }, { status: 500 });
      }

      finalTenantId = newTenant.id;
      logger.info('[ProvisionDeveloper] Created new tenant', { tenantId: finalTenantId });
    }

    const { data: newAdmin, error: insertError } = await supabase
      .from('admins')
      .insert({
        email: email.toLowerCase().trim(),
        role: 'developer',
        tenant_id: finalTenantId,
        created_at: new Date().toISOString(),
      })
      .select('id, role')
      .single();

    if (insertError) {
      logger.error('[ProvisionDeveloper] Insert error', insertError);
      return NextResponse.json({
        success: false,
        error: 'Failed to create admin record'
      }, { status: 500 });
    }

    logger.info('[ProvisionDeveloper] Created admin', { email, role: newAdmin.role, tenantId: finalTenantId });

    return NextResponse.json({
      success: true,
      adminId: newAdmin.id,
      role: newAdmin.role,
      tenantId: finalTenantId,
      message: 'Developer account created'
    });
  } catch (error: unknown) {
    logger.error('[ProvisionDeveloper] Server error', error);
    return NextResponse.json({
      success: false,
      error: 'Server error'
    }, { status: 500 });
  }
}
