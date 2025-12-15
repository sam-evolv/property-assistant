import { UnitTypesClient } from './unit-types-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { projectId: string };
}

export default function UnitTypesPage({ params }: PageProps) {
  return <UnitTypesClient projectId={params.projectId} />;
}
