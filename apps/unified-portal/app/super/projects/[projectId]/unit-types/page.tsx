import { UnitTypesClient } from './unit-types-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function UnitTypesPage(props: PageProps) {
  const params = await props.params;
  return <UnitTypesClient projectId={params.projectId} />;
}
