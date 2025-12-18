import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export interface ResolvedUnit {
  id: string;
  tenant_id: string;
  development_id: string | null;
  address: string;
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getUnitInfo(unitUid: string): Promise<ResolvedUnit | null> {
  const drizzleUnit = await db.query.units.findFirst({
    where: eq(units.id, unitUid),
    columns: { id: true, tenant_id: true, development_id: true, address_line_1: true },
  });

  if (drizzleUnit) {
    return {
      id: drizzleUnit.id,
      tenant_id: drizzleUnit.tenant_id,
      development_id: drizzleUnit.development_id,
      address: drizzleUnit.address_line_1 || 'Unknown Unit',
    };
  }

  const supabase = getSupabaseClient();
  console.log('[UnitResolver] Unit not in Drizzle, checking Supabase...');
  const { data: supabaseUnit, error } = await supabase
    .from('units')
    .select('id, address, project_id')
    .eq('id', unitUid)
    .single();

  if (error || !supabaseUnit) {
    return null;
  }

  console.log('[UnitResolver] Found in Supabase:', supabaseUnit.id);

  if (supabaseUnit.project_id) {
    const dev = await db.query.developments.findFirst({
      where: eq(developments.id, supabaseUnit.project_id),
      columns: { id: true, tenant_id: true },
    });

    if (dev) {
      return {
        id: supabaseUnit.id,
        tenant_id: dev.tenant_id,
        development_id: dev.id,
        address: supabaseUnit.address || 'Unknown Unit',
      };
    }
  }

  if (supabaseUnit.address) {
    const addressLower = supabaseUnit.address.toLowerCase();
    const allDevs = await db.query.developments.findMany({
      columns: { id: true, tenant_id: true, name: true },
    });
    
    for (const dev of allDevs) {
      const devNameLower = dev.name.toLowerCase();
      const devWords = devNameLower.split(/\s+/).filter((w: string) => w.length > 3);
      for (const word of devWords) {
        if (addressLower.includes(word)) {
          console.log('[UnitResolver] Matched development by address pattern:', dev.name);
          return {
            id: supabaseUnit.id,
            tenant_id: dev.tenant_id,
            development_id: dev.id,
            address: supabaseUnit.address || 'Unknown Unit',
          };
        }
      }
    }
  }

  return null;
}
