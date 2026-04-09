'use client';
import { useParams } from 'next/navigation';
import SelectionsTab from '@/components/select/builder/SelectionsTab';

export default function SelectionsPage() {
  const params = useParams();
  return <SelectionsTab projectId={params.projectId as string} />;
}
