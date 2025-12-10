import { redirect } from 'next/navigation';
import { getAdminSession } from '@openhouse/api/session';
import { HomeownerDetailClient } from './detail-client';

export const dynamic = 'force-dynamic';

export default async function HomeownerDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const session = await getAdminSession();
  
  if (!session) {
    redirect('/login');
  }

  const { id } = await params;

  return <HomeownerDetailClient homeownerId={id} />;
}
