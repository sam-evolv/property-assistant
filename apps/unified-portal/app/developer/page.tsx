import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function DeveloperDashboard() {
  // Redirect to the overview page which uses the proper UI components
  redirect('/developer/overview');
}
