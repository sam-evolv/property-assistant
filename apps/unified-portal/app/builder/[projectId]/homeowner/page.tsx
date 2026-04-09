'use client';
import { useParams } from 'next/navigation';
import HomeownerTab from '@/components/select/builder/HomeownerTab';

export default function HomeownerPage() {
  const params = useParams();
  return <HomeownerTab projectId={params.projectId as string} />;
}
