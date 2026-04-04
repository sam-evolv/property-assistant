import type { Metadata, Viewport } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'OpenHouse Agent',
  description: 'Property sales agent command centre',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'OH Agent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F4F4F6',
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
