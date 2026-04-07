'use client';

import dynamic from 'next/dynamic';

function TrainingJobsSkeleton() {
  return (
    <div className="p-6 lg:p-8 bg-neutral-50 min-h-screen animate-pulse">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 w-72 bg-neutral-200 rounded-lg mb-2" />
            <div className="h-4 w-96 bg-neutral-200 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-neutral-200" />
          ))}
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 h-96" />
      </div>
    </div>
  );
}

const TrainingJobsContent = dynamic(
  () => import('./TrainingJobsContent').then((mod) => ({ default: mod.TrainingJobsContent })),
  { ssr: false, loading: () => <TrainingJobsSkeleton /> }
);

export default function TrainingJobsClientWrapper() {
  return <TrainingJobsContent />;
}
