export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Portal login — handles homeowner (property code) and care (email) logins
 * without requiring magic link emails. Uses admin API to generate a session.
 *
 * POST body:
 *   { portal: "homeowner", email, propertyCode }
 *   { portal: "care", email, password }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { portal, email } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (portal === 'homeowner') {
      const propertyCode = body.propertyCode?.toUpperCase?.()?.trim?.();
      if (!email || !propertyCode) {
        return NextResponse.json({ error: 'Email and property code required' }, { status: 400 });
      }

      // Verify property code exists
      const { data: unit, error: unitError } = await adminClient
        .from('units')
        .select('id, unit_uid, address_line_1, tier')
        .eq('unit_code', propertyCode)
        .single();

      if (unitError || !unit) {
        return NextResponse.json({ error: 'Property code not found' }, { status: 404 });
      }

      // Generate a magic link without sending email
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
      });

      if (linkError || !linkData) {
        return NextResponse.json({ error: linkError?.message || 'Could not create session' }, { status: 500 });
      }

      // Extract the token from the generated link
      const token = linkData.properties?.hashed_token;

      // Exchange the token for a session using the server client
      const supabase = await createServerClient();

      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      });

      if (verifyError || !verifyData.session) {
        return NextResponse.json({ error: verifyError?.message || 'Session creation failed' }, { status: 500 });
      }

      // Link user to unit and upsert user_contexts
      await adminClient
        .from('units')
        .update({ user_id: verifyData.session.user.id })
        .eq('id', unit.id);

      await adminClient.from('user_contexts').upsert({
        auth_user_id: verifyData.session.user.id,
        product: unit.tier === 'select' ? 'homeowner' : 'homeowner',
        context_type: 'unit',
        context_id: unit.id,
        display_name: unit.address_line_1 || 'My Property',
        display_subtitle: unit.tier === 'select' ? 'OpenHouse Select' : 'Homeowner',
        display_icon: 'home',
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'auth_user_id,context_type,context_id' });

      // Determine redirect based on tier
      const redirectPath = unit.tier === 'select'
        ? `/homes/${unit.unit_uid || unit.id}/select`
        : `/homes/${unit.unit_uid || unit.id}`;

      return NextResponse.json({ success: true, redirect: redirectPath });
    }

    if (portal === 'care') {
      const password = body.password;
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }

      // Verify installation exists
      const { data: installation, error: instError } = await adminClient
        .from('installations')
        .select('id, address_line_1, system_type')
        .eq('customer_email', email.trim().toLowerCase())
        .single();

      if (instError || !installation) {
        return NextResponse.json({ error: "No portal found for that email" }, { status: 404 });
      }

      // Sign in with password
      const supabase = await createServerClient();

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError || !authData.session) {
        return NextResponse.json({ error: authError?.message || 'Invalid credentials' }, { status: 401 });
      }

      // Upsert user_contexts
      await adminClient.from('user_contexts').upsert({
        auth_user_id: authData.session.user.id,
        product: 'care',
        context_type: 'installation',
        context_id: installation.id,
        display_name: installation.address_line_1 || 'My Installation',
        display_subtitle: installation.system_type || 'Energy system',
        display_icon: 'sun',
        last_active_at: new Date().toISOString(),
      }, { onConflict: 'auth_user_id,context_type,context_id' });

      return NextResponse.json({ success: true, redirect: `/care/${installation.id}` });
    }

    return NextResponse.json({ error: 'Invalid portal type' }, { status: 400 });
  } catch (error: any) {
    console.error('[PORTAL LOGIN] Error:', error);
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
