import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      code,
      address,
      description,
      tenant_id,
      sidebar_logo_url,
      assistant_logo_url,
      toolbar_logo_url,
      system_instructions,
      from_submission_id,
      created_by,
      developer_user_id
    } = body;

    if (!name || !tenant_id) {
      return NextResponse.json(
        { error: 'name and tenant_id are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const devCode = code?.trim().toUpperCase() || name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .substring(0, 10);

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: existingSlug } = await supabaseAdmin
      .from('developments')
      .select('id')
      .eq('slug', slug)
      .single();

    const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug;

    const { data: existingCode } = await supabaseAdmin
      .from('developments')
      .select('id')
      .eq('code', devCode)
      .single();

    if (existingCode) {
      return NextResponse.json(
        { error: 'A development with this code already exists' },
        { status: 400 }
      );
    }

    const insertData: Record<string, any> = {
      name,
      code: devCode,
      slug: finalSlug,
      tenant_id,
      is_active: true,
    };

    if (address) insertData.address = address;
    if (description) insertData.description = description;
    if (sidebar_logo_url) insertData.sidebar_logo_url = sidebar_logo_url;
    if (assistant_logo_url) insertData.assistant_logo_url = assistant_logo_url;
    if (toolbar_logo_url) insertData.toolbar_logo_url = toolbar_logo_url;
    if (system_instructions) insertData.system_instructions = system_instructions;
    if (from_submission_id) insertData.from_submission_id = from_submission_id;
    if (created_by) insertData.created_by = created_by;
    if (developer_user_id) insertData.developer_user_id = developer_user_id;

    console.log('[Super Developments Create] Inserting development:', { name, code: devCode, tenant_id });

    const { data: development, error } = await supabaseAdmin
      .from('developments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Super Developments Create] Error creating development:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (from_submission_id) {
      await supabaseAdmin
        .from('onboarding_submissions')
        .update({ status: 'completed' })
        .eq('id', from_submission_id);
    }

    console.log('[Super Developments Create] Created development:', development.id);

    return NextResponse.json({ development }, { status: 201 });
  } catch (err: any) {
    console.error('[Super Developments Create] Server error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
