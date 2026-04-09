'use client';
import { useParams } from 'next/navigation';
import DocumentsTab from '@/components/select/builder/DocumentsTab';

export default function DocumentsPage() {
  const params = useParams();
  return <DocumentsTab projectId={params.projectId as string} />;
}
