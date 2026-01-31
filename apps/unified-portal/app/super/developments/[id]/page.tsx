import { requireRole } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import DevelopmentDetailClient from './development-detail-client';

export default async function DevelopmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['super_admin', 'admin']);

  const developmentId = params.id;

  if (!developmentId) {
    notFound();
  }

  return <DevelopmentDetailClient developmentId={developmentId} />;
}
