import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function DevelopmentsPage() {
  try {
    await requireRole(['super_admin', 'admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  return (
    <div className="p-8 bg-gray-950 min-h-full">
      <h1 className="text-3xl font-bold text-white mb-4">Developments Management</h1>
      <p className="text-gray-400 mb-8">
        Enhanced development management with QR codes and deep dive analytics. Redirecting to existing developments page...
      </p>
      <div className="mt-8">
        <a
          href="/developments"
          className="px-6 py-3 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-all duration-premium shadow-sm hover:shadow-md inline-block font-medium"
        >
          Go to Developments
        </a>
      </div>
    </div>
  );
}
