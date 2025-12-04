'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminSession, isSuperAdmin } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { admins, tenants } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';
import { createAdmin } from '@openhouse/api/rbac';

export async function createDeveloper(formData: FormData) {
  const session = await getAdminSession();
  
  if (!session || !isSuperAdmin(session)) {
    throw new Error('Unauthorized. Super-admin access required.');
  }

  const email = formData.get('email') as string;
  const tenantId = formData.get('tenantId') as string;

  if (!email || !tenantId) {
    throw new Error('Email and tenant are required');
  }

  await createAdmin({ email, role: 'developer', tenantId });

  revalidatePath('/admin');
  redirect('/admin');
}

export async function getAllDevelopersForList() {
  const session = await getAdminSession();
  
  if (!session || !isSuperAdmin(session)) {
    return [];
  }

  const developers = await db.query.admins.findMany({
    where: eq(admins.role, 'developer'),
    with: {
      tenant: {
        columns: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: (admins, { desc }) => [desc(admins.created_at)],
  });

  return developers;
}

export async function getAllTenantsForForm() {
  const session = await getAdminSession();
  
  if (!session || !isSuperAdmin(session)) {
    return [];
  }

  const allTenants = await db.query.tenants.findMany({
    orderBy: (tenants, { asc }) => [asc(tenants.name)],
    columns: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return allTenants;
}

export async function getDeveloperById(developerId: string) {
  const session = await getAdminSession();
  
  if (!session || !isSuperAdmin(session)) {
    throw new Error('Unauthorized. Super-admin access required.');
  }

  const developer = await db.query.admins.findFirst({
    where: eq(admins.id, developerId),
    columns: {
      id: true,
      email: true,
      role: true,
      tenant_id: true,
    },
  });

  return developer;
}

export async function updateDeveloper(developerId: string, formData: FormData) {
  const session = await getAdminSession();
  
  if (!session || !isSuperAdmin(session)) {
    throw new Error('Unauthorized. Super-admin access required.');
  }

  const email = formData.get('email') as string;
  const tenantId = formData.get('tenantId') as string;

  if (!email || !tenantId) {
    throw new Error('Email and tenant are required');
  }

  await db
    .update(admins)
    .set({
      email,
      tenant_id: tenantId,
    })
    .where(eq(admins.id, developerId));

  revalidatePath('/admin');
  revalidatePath(`/admin/developers/${developerId}/edit`);
  redirect('/admin');
}

export async function deleteDeveloper(developerId: string) {
  const session = await getAdminSession();
  
  if (!session || !isSuperAdmin(session)) {
    throw new Error('Unauthorized. Super-admin access required.');
  }

  await db.delete(admins).where(eq(admins.id, developerId));

  revalidatePath('/admin');
  redirect('/admin');
}
