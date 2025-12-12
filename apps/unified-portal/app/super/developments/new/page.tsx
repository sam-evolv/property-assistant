import { requireRole } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { db } from '@openhouse/db/client';
import { tenants, admins } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';
import { CreateDevelopmentForm } from './form-client';

export default async function SuperAdminCreateDevelopmentPage() {
  let session;
  try {
    session = await requireRole(['super_admin']);
  } catch (error) {
    redirect('/unauthorized');
  }

  const allTenants = await db.query.tenants.findMany({
    columns: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: (tenants, { asc }) => [asc(tenants.name)],
  });

  const developers = await db.query.admins.findMany({
    where: eq(admins.role, 'developer'),
    columns: {
      id: true,
      email: true,
      tenant_id: true,
    },
    orderBy: (admins, { asc }) => [asc(admins.email)],
  });

  return (
    <div className="min-h-full bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <a
            href="/super/developments"
            className="text-gold-400 hover:text-gold-300 hover:underline mb-4 inline-block"
          >
            ← Back to Developments
          </a>
          <h1 className="text-3xl font-bold text-white mt-2">Create New Development</h1>
          <p className="text-gray-400 mt-2">
            Super Admin: Create a new estate/development and assign it to a developer.
          </p>
        </div>

        <CreateDevelopmentForm 
          tenants={allTenants} 
          developers={developers}
          currentTenantId={session.tenantId}
        />
      </div>
    </div>
  );
}
