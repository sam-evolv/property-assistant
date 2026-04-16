import CareSelectClient from './CareSelectClient';

export const dynamic = 'force-dynamic';

const DEMO_INSTALLATION_ID = '52ed7a3e-1d3d-4acb-a35e-e069fe7b0c02';

export default function CareSelectPage() {
  return (
    <CareSelectClient
      dashboardHref={`/login/care?next=${encodeURIComponent('/care-dashboard')}`}
      customerHref={`/login/care?next=${encodeURIComponent(`/care/${DEMO_INSTALLATION_ID}`)}`}
    />
  );
}
