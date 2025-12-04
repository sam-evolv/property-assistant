'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdminSession, isSuperAdmin, isDeveloper, canAccessDevelopment } from '@openhouse/api/session';
import { db } from '@openhouse/db/client';
import { homeowners, developments } from '@openhouse/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export async function createHomeowner(formData: FormData) {
  const session = await getAdminSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  const developmentId = formData.get('developmentId') as string;
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const houseType = formData.get('houseType') as string;
  const address = formData.get('address') as string;

  if (!developmentId || !name || !email) {
    throw new Error('Development, name, and email are required');
  }

  const hasAccess = await canAccessDevelopment(session, developmentId);
  
  if (!hasAccess) {
    throw new Error('Access denied to this development');
  }

  // Get tenant_id from development
  const development = await db.query.developments.findFirst({
    where: (developments, { eq }) => eq(developments.id, developmentId),
    columns: {
      tenant_id: true,
    },
  });

  if (!development) {
    throw new Error('Development not found');
  }

  const qrToken = randomBytes(32).toString('hex');

  await db.insert(homeowners).values({
    tenant_id: development.tenant_id,
    development_id: developmentId,
    name,
    email,
    house_type: houseType || undefined,
    address: address || undefined,
    unique_qr_token: qrToken,
  });

  revalidatePath('/dashboard/homeowners');
  revalidatePath(`/dashboard/homeowners?developmentId=${developmentId}`);
  redirect('/dashboard/homeowners');
}

export async function getHomeownersByDevelopment(developmentId?: string) {
  const session = await getAdminSession();
  
  if (!session) {
    return [];
  }

  let homeownersList: any[] = [];

  if (developmentId) {
    const hasAccess = await canAccessDevelopment(session, developmentId);
    
    if (!hasAccess) {
      return [];
    }

    homeownersList = await db.query.homeowners.findMany({
      where: eq(homeowners.development_id, developmentId),
      with: {
        development: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: (homeowners, { desc }) => [desc(homeowners.created_at)],
    });
  } else {
    if (isSuperAdmin(session)) {
      homeownersList = await db.query.homeowners.findMany({
        with: {
          development: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: (homeowners, { desc }) => [desc(homeowners.created_at)],
      });
    } else if (isDeveloper(session)) {
      const devs = await db.query.developments.findMany({
        where: and(
          eq(developments.developer_user_id, session.id),
          eq(developments.tenant_id, session.tenantId)
        ),
        columns: {
          id: true,
        },
      });

      const devIds = devs.map(d => d.id);

      if (devIds.length === 0) {
        return [];
      }

      homeownersList = await db.query.homeowners.findMany({
        where: inArray(homeowners.development_id, devIds),
        with: {
          development: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: (homeowners, { desc }) => [desc(homeowners.created_at)],
      });
    } else {
      homeownersList = [];
    }
  }

  return homeownersList;
}

export async function getHomeownerById(homeownerId: string) {
  const session = await getAdminSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  const homeowner = await db.query.homeowners.findFirst({
    where: eq(homeowners.id, homeownerId),
    columns: {
      id: true,
      name: true,
      email: true,
      house_type: true,
      address: true,
      development_id: true,
      tenant_id: true,
    },
  });

  if (!homeowner) {
    return null;
  }

  // Verify access
  const hasAccess = await canAccessDevelopment(session, homeowner.development_id);
  
  if (!hasAccess) {
    throw new Error('Access denied to this homeowner');
  }

  return homeowner;
}

export async function updateHomeowner(homeownerId: string, formData: FormData) {
  const session = await getAdminSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  const developmentId = formData.get('developmentId') as string;
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const houseType = formData.get('houseType') as string;
  const address = formData.get('address') as string;

  if (!developmentId || !name || !email) {
    throw new Error('Development, name, and email are required');
  }

  // Verify access to both old and new development
  const oldHomeowner = await db.query.homeowners.findFirst({
    where: eq(homeowners.id, homeownerId),
    columns: {
      development_id: true,
    },
  });

  if (!oldHomeowner) {
    throw new Error('Homeowner not found');
  }

  const hasOldAccess = await canAccessDevelopment(session, oldHomeowner.development_id);
  const hasNewAccess = await canAccessDevelopment(session, developmentId);
  
  if (!hasOldAccess || !hasNewAccess) {
    throw new Error('Access denied');
  }

  // Get tenant_id from new development
  const development = await db.query.developments.findFirst({
    where: (developments, { eq }) => eq(developments.id, developmentId),
    columns: {
      tenant_id: true,
    },
  });

  if (!development) {
    throw new Error('Development not found');
  }

  await db
    .update(homeowners)
    .set({
      development_id: developmentId,
      tenant_id: development.tenant_id,
      name,
      email,
      house_type: houseType || undefined,
      address: address || undefined,
    })
    .where(eq(homeowners.id, homeownerId));

  revalidatePath('/dashboard/homeowners');
  revalidatePath(`/dashboard/homeowners/${homeownerId}/edit`);
  redirect('/dashboard/homeowners');
}

export async function deleteHomeowner(homeownerId: string) {
  const session = await getAdminSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }

  const homeowner = await db.query.homeowners.findFirst({
    where: eq(homeowners.id, homeownerId),
    columns: {
      development_id: true,
    },
  });

  if (!homeowner) {
    throw new Error('Homeowner not found');
  }

  const hasAccess = await canAccessDevelopment(session, homeowner.development_id);
  
  if (!hasAccess) {
    throw new Error('Access denied');
  }

  await db.delete(homeowners).where(eq(homeowners.id, homeownerId));

  revalidatePath('/dashboard/homeowners');
  redirect('/dashboard/homeowners');
}

export async function getHomeownerCountByDevelopment(developmentId: string) {
  const session = await getAdminSession();
  
  if (!session) {
    return 0;
  }

  const hasAccess = await canAccessDevelopment(session, developmentId);
  
  if (!hasAccess) {
    return 0;
  }

  const count = await db.query.homeowners.findMany({
    where: eq(homeowners.development_id, developmentId),
  });

  return count.length;
}
