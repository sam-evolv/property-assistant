import { notFound } from 'next/navigation';
import PlacesHealthClient from './client';

export const dynamic = 'force-dynamic';

export default async function PlacesHealthPage() {
  if (process.env.DEV_TOOLS !== 'true') {
    notFound();
  }

  if (!process.env.ASSISTANT_TEST_SECRET) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Places Healthcheck Tool</h1>
        <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg">
          <p className="text-red-300">ASSISTANT_TEST_SECRET not set</p>
        </div>
      </div>
    );
  }

  const gateStatus = {
    devToolsEnabled: process.env.DEV_TOOLS === 'true',
    secretPresent: !!process.env.ASSISTANT_TEST_SECRET,
  };

  return <PlacesHealthClient gateStatus={gateStatus} />;
}
