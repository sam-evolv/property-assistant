import { ImportUnitsClient } from './import-units-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ImportUnitsPage(props: PageProps) {
  const params = await props.params;
  return <ImportUnitsClient projectId={params.projectId} />;
}
