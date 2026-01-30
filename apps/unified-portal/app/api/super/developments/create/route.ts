import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      name,
      address,
      county,
      description,
      estimated_units,
      tenant_id,
      planning_reference,
      expected_handover,
      status,
      sidebar_logo_url,
      assistant_logo_url,
      toolbar_logo_url,
      system_instructions,
      from_submission_id
    } = body;

    if (!name || !address || !tenant_id) {
      return NextResponse.json(
        { error: 'name, address, and tenant_id are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: existing } = await supabaseAdmin
      .from('developments')
      .select('id')
      .eq('slug', slug)
      .single();

    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const { data: development, error } = await supabaseAdmin
      .from('developments')
      .insert({
        name,
        slug: finalSlug,
        address,
        county: county || null,
        description: description || null,
        estimated_units: estimated_units || null,
        tenant_id,
        planning_reference: planning_reference || null,
        expected_handover_date: expected_handover || null,
        status: status || 'active',
        sidebar_logo_url: sidebar_logo_url || null,
        assistant_logo_url: assistant_logo_url || null,
        toolbar_logo_url: toolbar_logo_url || null,
        system_instructions: system_instructions || null,
        from_submission_id: from_submission_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating development:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (from_submission_id) {
      await supabaseAdmin
        .from('onboarding_submissions')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', from_submission_id);
    }

    return NextResponse.json({ development }, { status: 201 });
  } catch (err) {
    console.error('Server error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
