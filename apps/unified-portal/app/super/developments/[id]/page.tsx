import { requireRole } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import DevelopmentDetailClient from './development-detail-client';
export const dynamic = 'force-dynamic'

export default async function DevelopmentDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  await requireRole(['super_admin', 'admin']);

  const developmentId = params.id;

  if (!developmentId) {
    notFound();
  }

  return <DevelopmentDetailClient developmentId={developmentId} />;
}
