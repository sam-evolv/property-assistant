'use client';

import { useParams } from 'next/navigation';

export default function SelectPage() {
  const { unitUid } = useParams() as { unitUid: string };

  return (
    <div
      style={{
        background: '#04040A',
        color: '#D4AF37',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      OpenHouse Select — {unitUid}
    </div>
  );
}
