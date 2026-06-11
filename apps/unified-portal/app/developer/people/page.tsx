import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { PeopleClient } from './people-client';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }
  return <PeopleClient />;
}
