'use client';
import { useParams } from 'next/navigation';
import HandoverTab from '@/components/select/builder/HandoverTab';

export default function HandoverPage() {
  const params = useParams();
  return <HandoverTab projectId={params.projectId as string} />;
}
