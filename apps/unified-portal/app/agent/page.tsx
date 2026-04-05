import { redirect } from 'next/navigation';

export default function AgentPage({
  searchParams,
}: {
  searchParams: { preview?: string };
}) {
  const preview = searchParams.preview;
  redirect(preview ? `/agent/home?preview=${preview}` : '/agent/home');
}
