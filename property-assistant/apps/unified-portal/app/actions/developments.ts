'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminSession, isSuperAdmin, isDeveloper, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { developments, admins, tenants } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export async function createDevelopment(formData: FormData) {
  const session = await getAdminSession();
  
  if (!session || !isSuperAdmin(session)) {
    throw new Error('Unauthorized. Super-admin access required.');
  }

  const name = formData.get('name') as string;
  const address = formData.get('address') as string;
  const description = formData.get('description') as string;
  const systemInstructions = formData.get('systemInstructions') as string;
  const tenantId = formData.get('tenantId') as string;
  const developerUserId = formData.get('developerUserId') as string;

  if (!name || !tenantId || !developerUserId) {
    throw new Error('Name, tenant, and developer are required');
  }

  await db.insert(developments).values({
    name,
    address: address || '',
    description: description || undefined,
    system_instructions: systemInstructions || undefined,
    tenant_id: tenantId,
    developer_user_id: developerUserId,
  });

  revalidatePath('/admin');
  redirect('/admin');
}

export async function updateDevelopment(developmentId: string, formData: FormData) {
  const session = await getAdminSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  const hasAccess = await canAccessDevelopment(session, developmentId);
  
  if (!hasAccess) {
    throw new Error('Access denied to this development');
  }

  const name = formData.get('name') as string;
  const address = formData.get('address') as string;
  const description = formData.get('description') as string;
  const systemInstructions = formData.get('systemInstructions') as string;

  if (!name) {
    throw new Error('Name is required');
  }

  await db
    .update(developments)
    .set({
      name,
      address: address || '',
      description: description || undefined,
      system_instructions: systemInstructions || undefined,
    })
    .where(eq(developments.id, developmentId));

  revalidatePath('/admin');
  revalidatePath(`/admin/developments/${developmentId}/edit`);
  redirect('/admin');
}

export async function getDevelopmentById(developmentId: string) {
  const session = await getAdminSession();
  
  if (!session) {
    return null;
  }

  const hasAccess = await canAccessDevelopment(session, developmentId);
  
  if (!hasAccess) {
    return null;
  }

  const development = await db.query.developments.findFirst({
    where: eq(developments.id, developmentId),
    with: {
      tenant: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  return development;
}

export async function getAllDevelopmentsForList() {
  const session = await getAdminSession();
  
  if (!session) {
    return [];
  }

  let devs: any[] = [];

  if (isSuperAdmin(session)) {
    devs = await db.query.developments.findMany({
      orderBy: (developments, { desc }) => [desc(developments.created_at)],
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  } else if (isDeveloper(session)) {
    devs = await db.query.developments.findMany({
      where: and(
        eq(developments.developer_user_id, session.id),
        eq(developments.tenant_id, session.tenantId)
      ),
      orderBy: (developments, { desc }) => [desc(developments.created_at)],
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  } else {
    devs = [];
  }

  return devs;
}
