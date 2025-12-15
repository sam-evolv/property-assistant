import { ImportUnitsClient } from './import-units-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { projectId: string };
}

export default function ImportUnitsPage({ params }: PageProps) {
  return <ImportUnitsClient projectId={params.projectId} />;
}
