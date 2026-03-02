import type { Metadata, Viewport } from 'next';
import { createClient } from '@supabase/supabase-js';
import { CareAppProvider } from './care-app-provider';
import { notFound } from 'next/navigation';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ installationId: string }>;
}): Promise<Metadata> {
  const { installationId } = await params;
  return {
    title: 'OpenHouse Care',
    description: 'Your home system care portal',
    manifest: `/api/care/manifest/${installationId}`,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'OpenHouse Care',
    },
  };
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export default async function CareAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ installationId: string }>;
}) {
  const { installationId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: installation, error } = await supabase
    .from('installations')
    .select('*, tenants(name, contact)')
    .eq('id', installationId)
    .single();

  if (error || !installation) {
    notFound();
  }

  const installationData = {
    ...installation,
    installer_name: installation.tenants?.name || 'Your Installer',
    installer_contact: installation.tenants?.contact || {},
  };

  return (
    <CareAppProvider installationId={installationId} installation={installationData}>
      {children}
    </CareAppProvider>
  );
}
