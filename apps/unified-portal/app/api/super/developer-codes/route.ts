import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateCode(tenantName: string): string {
  const prefix = tenantName.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6) || 'DEV';
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${year}-${suffix}`;
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('developer_codes')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ codes: data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantName, tenantId, notes, expiresInDays } = body;
    
    if (!tenantName) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 });
    }
    
    let code = generateCode(tenantName);
    
    const { data: existing } = await supabase
      .from('developer_codes')
      .select('id')
      .eq('code', code)
      .single();
    
    if (existing) {
      code = generateCode(tenantName);
    }
    
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expiresInDays);
      expiresAt = expiry.toISOString();
    }
    
    const { data, error } = await supabase
      .from('developer_codes')
      .insert({
        code,
        tenant_id: tenantId || null,
        tenant_name: tenantName,
        notes: notes || null,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, code: data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
