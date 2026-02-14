import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { code, email } = body;
    
    if (!code || !email) {
      return NextResponse.json({ success: false, error: 'Code and email required' }, { status: 400 });
    }
    
    const normalizedCode = code.toUpperCase().trim();
    
    const { data: codeRecord, error: lookupError } = await supabase
      .from('developer_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();
    
    if (lookupError || !codeRecord) {
      return NextResponse.json({ success: false, error: 'Invalid code' }, { status: 404 });
    }
    
    if (codeRecord.used_at) {
      return NextResponse.json({ success: false, error: 'Code already used' }, { status: 400 });
    }
    
    const { error: updateError } = await supabase
      .from('developer_codes')
      .update({
        used_by_email: email,
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', codeRecord.id);
    
    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      tenantId: codeRecord.tenant_id,
      tenantName: codeRecord.tenant_name,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
