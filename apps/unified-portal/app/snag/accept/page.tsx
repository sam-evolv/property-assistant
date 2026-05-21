/**
 * /snag/accept
 *
 * Assistant V2 Sprint 2. Page reached from a snagger invitation link.
 * Reads the token from the URL, ensures the visitor is signed in, and
 * delegates to a small client component that POSTs to /api/snag/accept.
 *
 * Spec section 5.2 + 7.
 */

import { notFound, redirect } from 'next/navigation';
import { isBuilderSnagAppEnabled } from '@/lib/feature-flags';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { AcceptInviteClient } from './AcceptInviteClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { token?: string };
}

export default async function AcceptInvitePage({ searchParams }: PageProps) {
  if (!isBuilderSnagAppEnabled()) notFound();

  const token = typeof searchParams?.token === 'string' ? searchParams.token.trim() : '';

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const redirectBack = token
      ? `/snag/accept?token=${encodeURIComponent(token)}`
      : '/snag/accept';
    redirect(`/login?redirectTo=${encodeURIComponent(redirectBack)}`);
  }

  return <AcceptInviteClient token={token} signedInEmail={user.email ?? ''} />;
}
