import { CareAppProvider } from './care-app-provider';

export default async function CareAppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ installationId: string }>;
}) {
  const { installationId } = await params;

  return (
    <CareAppProvider installationId={installationId}>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      {children}
    </CareAppProvider>
  );
}
