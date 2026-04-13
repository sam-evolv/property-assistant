export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/homeowner/register
 *
 * Creates a Supabase auth user for a homeowner, links them to their unit,
 * and immediately signs them in (setting auth cookies).
 *
 * Body: { unitId: string, email: string, password: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { unitId, email, password } = body;

    if (!unitId || !email || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();

    // Re-verify unit exists and still has no user_id (safety check before creating user)
    const { data: unit, error: unitError } = await adminClient
      .from('units')
      .select('id, address_line_1, user_id, unit_uid, handover_date')
      .eq('id', unitId)
      .single();

    if (unitError || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 400 });
    }

    if (unit.user_id) {
      return NextResponse.json(
        { error: 'This property is already registered. Please sign in with your email and password.' },
        { status: 409 }
      );
    }

    // Create Supabase auth user — email_confirm:true because the property code was the verification
    const { data: newUserData, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
    });

    if (createError || !newUserData.user) {
      console.error('[REGISTER] Create user error:', createError);
      if (createError?.message?.toLowerCase().includes('already registered') ||
          createError?.message?.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Please sign in instead.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: createError?.message || 'Could not create account' },
        { status: 500 }
      );
    }

    const newUserId = newUserData.user.id;

    // Update unit — WHERE user_id IS NULL prevents race conditions
    // Set handover_date only if it isn't already set
    const updatePayload: Record<string, unknown> = {
      user_id: newUserId,
      purchaser_email: email.trim().toLowerCase(),
      unit_status: 'handed_over',
    };
    if (!unit.handover_date) {
      updatePayload.handover_date = new Date().toISOString();
    }

    const { data: updatedRows, error: updateError } = await adminClient
      .from('units')
      .update(updatePayload)
      .eq('id', unitId)
      .is('user_id', null)
      .select('id');

    if (updateError || !updatedRows || updatedRows.length === 0) {
      // Race condition or DB error — clean up the auth user we just created
      console.error('[REGISTER] Unit update failed (race or error):', updateError);
      await adminClient.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        { error: 'Registration failed — please try again' },
        { status: 409 }
      );
    }

    // Insert user_contexts to link the auth user to their unit
    await adminClient.from('user_contexts').upsert(
      {
        auth_user_id: newUserId,
        product: 'homeowner',
        context_type: 'unit',
        context_id: unitId,
        display_name: unit.address_line_1 || 'My Property',
        display_subtitle: 'Homeowner',
        display_icon: 'home',
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'auth_user_id,context_type,context_id' }
    );

    // Sign them in immediately so the session cookie is set
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError || !signInData.session) {
      console.error('[REGISTER] Auto sign-in failed:', signInError);
      // Account created successfully, just couldn't auto sign-in — send them to sign-in screen
      return NextResponse.json({
        success: true,
        needsSignIn: true,
        redirect: '/login/homeowner',
      });
    }

    const redirect = `/homes/${unit.unit_uid || unitId}`;
    return NextResponse.json({ success: true, redirect });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[REGISTER]', message);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
