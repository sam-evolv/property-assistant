import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { email, fullName, tenantId, companyName } = body;
    
    console.log('[ProvisionDeveloper] Request received:', { email, fullName, tenantId: tenantId || 'MISSING', companyName });
    
    if (!email) {
      console.error('[ProvisionDeveloper] Missing email');
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
      console.log('[ProvisionDeveloper] Admin already exists:', email, existing.role);
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
        console.log('[ProvisionDeveloper] Tenant not found, will create new one');
        finalTenantId = null;
      }
    }
    
    if (!finalTenantId) {
      const tenantName = companyName || email.split('@')[0] + ' Development';
      const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      
      console.log('[ProvisionDeveloper] Creating new tenant:', tenantName);
      
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
        console.error('[ProvisionDeveloper] Failed to create tenant:', tenantError);
        return NextResponse.json({ 
          success: false, 
          error: 'Failed to create organization' 
        }, { status: 500 });
      }
      
      finalTenantId = newTenant.id;
      console.log('[ProvisionDeveloper] Created new tenant:', finalTenantId);
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
      console.error('[ProvisionDeveloper] Insert error:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to create admin record' 
      }, { status: 500 });
    }
    
    console.log('[ProvisionDeveloper] Created admin:', email, 'role:', newAdmin.role, 'tenant:', finalTenantId);
    
    return NextResponse.json({ 
      success: true, 
      adminId: newAdmin.id,
      role: newAdmin.role,
      tenantId: finalTenantId,
      message: 'Developer account created'
    });
  } catch (error: any) {
    console.error('[ProvisionDeveloper] Server error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error' 
    }, { status: 500 });
  }
}
