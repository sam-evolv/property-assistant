'use client';
import { useParams } from 'next/navigation';
import PhotosTab from '@/components/select/builder/PhotosTab';

export default function PhotosPage() {
  const params = useParams();
  return <PhotosTab projectId={params.projectId as string} />;
}
