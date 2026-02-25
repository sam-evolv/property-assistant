'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/dev-app/layout/Header';
import MobileShell from '@/components/dev-app/layout/MobileShell';
import DevelopmentCards from '@/components/dev-app/overview/DevelopmentCards';
import type { DevelopmentSummary } from '@/components/dev-app/overview/DevelopmentCards';

export default function DevelopmentsPage() {
  const router = useRouter();
  const [developments, setDevelopments] = useState<DevelopmentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dev-app/developments')
      .then((r) => r.json())
      .then((data) => setDevelopments(data.developments || []))
      .catch(() => setDevelopments([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MobileShell>
      <Header title="Developments" onNotificationTap={() => router.push('/dev-app/activity')} />

      {loading ? (
        <div className="px-4 py-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-[#f3f4f6] animate-pulse" />
          ))}
        </div>
      ) : developments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="text-4xl mb-3 text-[#e5e7eb]">🏗️</div>
          <p className="text-[15px] font-semibold text-[#111827]">No developments yet</p>
          <p className="text-[13px] text-[#6b7280] mt-1">
            Your developments will appear here once set up.
          </p>
        </div>
      ) : (
        <div className="py-3">
          <DevelopmentCards
            developments={developments}
            onTap={(dev) => router.push(`/dev-app/developments/${dev.id}`)}
          />
        </div>
      )}
    </MobileShell>
  );
}
