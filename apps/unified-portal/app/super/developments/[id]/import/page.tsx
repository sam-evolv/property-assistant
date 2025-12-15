import { requireRole } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { db } from '@openhouse/db/client';
import { developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import ImportUnitsClient from './import-client';

export default async function ImportUnitsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(['super_admin', 'admin']);

  const developmentId = params.id;

  if (!developmentId) {
    notFound();
  }

  const development = await db.query.developments.findFirst({
    where: eq(developments.id, developmentId),
    columns: {
      id: true,
      code: true,
      name: true,
    },
  });

  if (!development) {
    notFound();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <a
          href={`/super/developments/${developmentId}`}
          className="text-gold-400 hover:text-gold-300 text-sm mb-4 inline-block"
        >
          &larr; Back to {development.name}
        </a>
        <h1 className="text-3xl font-bold text-white mb-2">Import Units</h1>
        <p className="text-gray-400">
          Upload a CSV or Excel file to bulk import units for {development.name}
        </p>
      </div>

      <ImportUnitsClient developmentId={developmentId} developmentName={development.name} />
    </div>
  );
}
