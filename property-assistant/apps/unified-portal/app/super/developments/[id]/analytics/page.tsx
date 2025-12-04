import { requireRole } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import DevelopmentAnalyticsClient from './analytics-client';

export default async function DevelopmentAnalyticsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireRole(['super_admin', 'admin']);

  const development = await db.query.developments.findFirst({
    where: eq(developments.id, params.id),
  });

  if (!development) {
    notFound();
  }

  return (
    <DevelopmentAnalyticsClient
      developmentId={params.id}
      developmentName={development.name}
    />
  );
}
