import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AgentLettingsRootPage() {
  redirect('/agent/lettings/home');
}
