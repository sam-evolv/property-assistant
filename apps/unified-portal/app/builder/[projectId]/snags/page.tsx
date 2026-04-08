'use client';
import { useParams } from 'next/navigation';
import SnagsTab from '@/components/select/builder/SnagsTab';

export default function SnagsPage() {
  const params = useParams();
  return <SnagsTab projectId={params.projectId as string} />;
}
