'use client';
import { useParams } from 'next/navigation';
import IntelligenceTab from '@/components/select/builder/IntelligenceTab';

export default function IntelligencePage() {
  const params = useParams();
  return <IntelligenceTab projectId={params.projectId as string} />;
}
