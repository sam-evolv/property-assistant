export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Fixed: Use @supabase/auth-helpers-nextjs instead of missing @supabase/ssr package
    const supabase = createServerComponentClient({ cookies });

    const {
      data: { user: authUser },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', authUser.id)
      .single();

    if (!user || !user.tenant_id) {
      return NextResponse.json({ error: 'User not associated with a tenant' }, { status: 403 });
    }

    if (user.role !== 'developer' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { primary_color, secondary_color, accent_color, background_color, button_radius, heading_font_weight, logo_url, dark_mode } = body;

    const tenant_id = user.tenant_id;

    const isValidColor = (color: string | null | undefined) => {
      if (!color) return false;
      return /^#[0-9A-F]{6}$/i.test(color);
    };

    if (!isValidColor(primary_color)) {
      return NextResponse.json({ error: 'Invalid primary_color format' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existing, error: fetchError } = await adminClient
      .from('theme_config')
      .select('id')
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[THEME] Error checking existing config:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    const themeData = {
      tenant_id,
      primary_color: primary_color || '#3b82f6',
      secondary_color: isValidColor(secondary_color) ? secondary_color : null,
      accent_color: isValidColor(accent_color) ? accent_color : null,
      background_color: isValidColor(background_color) ? background_color : null,
      button_radius: typeof button_radius === 'number' ? button_radius : null,
      heading_font_weight: typeof heading_font_weight === 'number' ? heading_font_weight : null,
      logo_url: logo_url || null,
      dark_mode: dark_mode ?? false,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (existing) {
      const { data, error } = await adminClient
        .from('theme_config')
        .update(themeData)
        .eq('tenant_id', tenant_id)
        .select()
        .single();

      result = { data, error };
    } else {
      const { data, error } = await adminClient
        .from('theme_config')
        .insert(themeData)
        .select()
        .single();

      result = { data, error };
    }

    if (result.error) {
      console.error('[THEME] Error saving config:', result.error);
      return NextResponse.json({ error: 'Failed to save theme' }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, theme: result.data },
      { status: 200 }
    );

  } catch (error) {
    console.error('[THEME] Error in save route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
