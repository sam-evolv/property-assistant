import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { Metadata, Viewport } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OpenHouse AI Developer',
  description: 'Developer mobile command centre for property developments',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'OH Developer',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default async function DevAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth gate — redirect unauthenticated users
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
