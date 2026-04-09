import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OpenHouse Select — Builder Dashboard',
  description: 'Premium builder project management',
};

export default async function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login?redirectTo=/builder');
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0b0c0f',
        fontFamily: '"Inter", system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        color: '#eef2f8',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
