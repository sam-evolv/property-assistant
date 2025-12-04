import { requireRole } from '@/lib/supabase-server';
import { HomeownersList } from './list';
import { redirect } from 'next/navigation';
import { getHomeownersByDevelopment } from '@/app/actions/homeowners';

export default async function HomeownersPage({ 
  searchParams 
}: { 
  searchParams: { developmentId?: string } 
}) {
  let session;
  
  try {
    session = await requireRole(['developer', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const homeowners = await getHomeownersByDevelopment(searchParams.developmentId);

  return <HomeownersList session={session} homeowners={homeowners} developmentId={searchParams.developmentId} />;
}
