import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;
    
    if (!code) {
      return NextResponse.json({ valid: false, error: 'Code is required' }, { status: 400 });
    }
    
    const normalizedCode = code.toUpperCase().trim();
    
    const { data: codeRecord, error } = await supabase
      .from('developer_codes')
      .select('*')
      .eq('code', normalizedCode)
      .single();
    
    if (error || !codeRecord) {
      return NextResponse.json({ valid: false, error: 'Invalid code' });
    }
    
    if (codeRecord.used_at) {
      return NextResponse.json({ valid: false, error: 'Code already used' });
    }
    
    if (!codeRecord.is_active) {
      return NextResponse.json({ valid: false, error: 'Code is no longer active' });
    }
    
    if (codeRecord.expires_at && new Date(codeRecord.expires_at) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Code has expired' });
    }
    
    return NextResponse.json({
      valid: true,
      tenantName: codeRecord.tenant_name,
      tenantId: codeRecord.tenant_id,
    });
  } catch (error) {
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
  }
}
