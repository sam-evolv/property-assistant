'use client';
import { useParams } from 'next/navigation';
import BuildTimeline from '@/components/select/builder/BuildTimeline';

export default function TimelinePage() {
  const params = useParams();
  return <BuildTimeline projectId={params.projectId as string} />;
}
