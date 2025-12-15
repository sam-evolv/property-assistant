import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/supabase-server';
import NewProjectWizard from './new-project-client';

export default async function NewProjectPage() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  return <NewProjectWizard />;
}
