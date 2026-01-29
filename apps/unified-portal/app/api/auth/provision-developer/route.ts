import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, tenantId, companyName } = body;
    
    if (!email || !tenantId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email and tenant ID required' 
      }, { status: 400 });
    }
    
    const { data: existing } = await supabase
      .from('admins')
      .select('id, role')
      .eq('email', email)
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
    
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenantId)
      .single();
    
    if (!tenant) {
      console.error('[ProvisionDeveloper] Tenant not found:', tenantId);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid tenant' 
      }, { status: 400 });
    }
    
    const { data: newAdmin, error: insertError } = await supabase
      .from('admins')
      .insert({
        email: email.toLowerCase().trim(),
        name: fullName || email.split('@')[0],
        role: 'developer',
        tenant_id: tenantId,
        company_name: companyName || null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
    
    console.log('[ProvisionDeveloper] Created admin:', email, 'role:', newAdmin.role, 'tenant:', tenantId);
    
    return NextResponse.json({ 
      success: true, 
      adminId: newAdmin.id,
      role: newAdmin.role,
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
