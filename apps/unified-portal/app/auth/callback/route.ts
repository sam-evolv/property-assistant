import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const context = requestUrl.searchParams.get('context');
  const unitId = requestUrl.searchParams.get('unit_id');
  const installationId = requestUrl.searchParams.get('installation_id');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    try {
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error || !session) {
        console.error('Error exchanging code for session:', error);
        return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
      }

      // Handle homeowner context
      if (context === 'homeowner' && unitId) {
        const { data: unit } = await supabase
          .from('units')
          .select('id, address_line_1')
          .eq('id', unitId)
          .single();

        if (unit) {
          await supabase.from('user_contexts').upsert({
            auth_user_id: session.user.id,
            product: 'homeowner',
            context_type: 'unit',
            context_id: unit.id,
            display_name: unit.address_line_1 || 'My Property',
            display_subtitle: 'Homeowner',
            display_icon: 'home',
            last_active_at: new Date().toISOString(),
          }, { onConflict: 'auth_user_id,context_type,context_id' });

          // Update unit to link this user
          await supabase
            .from('units')
            .update({ user_id: session.user.id })
            .eq('id', unit.id);
        }

        return NextResponse.redirect(new URL(`/homes/${unitId}`, requestUrl.origin));
      }

      // Handle Care context
      if (context === 'care' && installationId) {
        const { data: installation } = await supabase
          .from('installations')
          .select('id, address_line_1, system_type')
          .eq('id', installationId)
          .single();

        if (installation) {
          await supabase.from('user_contexts').upsert({
            auth_user_id: session.user.id,
            product: 'care',
            context_type: 'installation',
            context_id: installation.id,
            display_name: installation.address_line_1 || 'My Installation',
            display_subtitle: installation.system_type || 'Energy system',
            display_icon: 'sun',
            last_active_at: new Date().toISOString(),
          }, { onConflict: 'auth_user_id,context_type,context_id' });
        }

        return NextResponse.redirect(new URL(`/care/${installationId}`, requestUrl.origin));
      }

    } catch (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
    }
  }

  // Preserve the redirectTo parameter if it exists (existing developer/admin flow)
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/developer/overview';
  // Prevent open redirect attacks - only allow internal paths
  const safeRedirectTo = redirectTo.startsWith('/') && !redirectTo.startsWith('//')
    ? redirectTo
    : '/developer/overview';
  return NextResponse.redirect(new URL(safeRedirectTo, requestUrl.origin));
}
