import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import DevelopmentAnalyticsClient from './analytics-client';

export default async function DevelopmentAnalyticsPage({
  params,
}: {
  params: { id: string };
}) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);

    const development = await db
      .select()
      .from(developments)
      .where(eq(developments.id, params.id))
      .limit(1)
      .then((rows) => rows[0]);

    if (!development) {
      notFound();
    }

    if (development.tenant_id !== session.tenantId && session.role !== 'super_admin') {
      redirect('/unauthorized');
    }

    return (
      <DevelopmentAnalyticsClient
        tenantId={session.tenantId}
        developmentId={development.id}
        developmentName={development.name}
      />
    );
  } catch (error) {
    redirect('/unauthorized');
  }
}
