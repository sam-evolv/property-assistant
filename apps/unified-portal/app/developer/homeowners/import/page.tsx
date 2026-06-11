import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { getAllDevelopmentsForList } from '@/app/actions/developments';
import { ImportClient } from './import-client';

export const dynamic = 'force-dynamic';

export default async function ImportHomesPage() {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  const developments = await getAllDevelopmentsForList();

  return (
    <ImportClient
      developments={(developments || []).map((d: any) => ({ id: d.id, name: d.name }))}
    />
  );
}
