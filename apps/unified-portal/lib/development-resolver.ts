import { createClient } from '@supabase/supabase-js';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

export interface ResolvedDevelopment {
  drizzleDevelopmentId: string;
  supabaseProjectId: string;
  developmentName: string;
  tenantId: string | null;
  logoUrl: string | null;
}

const developmentCache = new Map<string, ResolvedDevelopment>();

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function resolveDevelopment(
  supabaseProjectId: string | null,
  address?: string
): Promise<ResolvedDevelopment | null> {
  if (!supabaseProjectId && !address) {
    return null;
  }

  const cacheKey = supabaseProjectId || address || '';
  if (developmentCache.has(cacheKey)) {
    return developmentCache.get(cacheKey)!;
  }

  console.log('[DevelopmentResolver] Resolving development for project_id:', supabaseProjectId, 'address:', address);

  try {
    let supabaseProject: { id: string; name: string; logo_url?: string } | null = null;
    
    if (supabaseProjectId) {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('projects')
        .select('id, name, logo_url')
        .eq('id', supabaseProjectId)
        .single();
      supabaseProject = data;
      console.log('[DevelopmentResolver] Supabase project:', supabaseProject?.name);
    }

    if (supabaseProject) {
      const { rows: devRows } = await db.execute(sql`
        SELECT id, name, tenant_id, logo_url
        FROM developments
        WHERE LOWER(name) = LOWER(${supabaseProject.name})
        LIMIT 1
      `);

      if (devRows.length > 0) {
        const dev = devRows[0] as any;
        const resolved: ResolvedDevelopment = {
          drizzleDevelopmentId: dev.id,
          supabaseProjectId: supabaseProjectId!,
          developmentName: dev.name || supabaseProject.name,
          tenantId: dev.tenant_id,
          logoUrl: dev.logo_url || supabaseProject.logo_url || null,
        };
        developmentCache.set(cacheKey, resolved);
        console.log('[DevelopmentResolver] Matched by name:', resolved.developmentName, 'Drizzle ID:', resolved.drizzleDevelopmentId);
        return resolved;
      }
    }

    if (address) {
      const addressLower = address.toLowerCase();
      const { rows: allDevs } = await db.execute(sql`
        SELECT id, name, tenant_id, logo_url FROM developments
      `);

      for (const dev of allDevs as any[]) {
        const devNameLower = dev.name.toLowerCase();
        const devWords = devNameLower.split(/\s+/).filter((w: string) => w.length > 3);
        for (const word of devWords) {
          if (addressLower.includes(word)) {
            const resolved: ResolvedDevelopment = {
              drizzleDevelopmentId: dev.id,
              supabaseProjectId: supabaseProjectId || dev.id,
              developmentName: dev.name,
              tenantId: dev.tenant_id,
              logoUrl: dev.logo_url,
            };
            developmentCache.set(cacheKey, resolved);
            console.log('[DevelopmentResolver] Matched by address pattern:', resolved.developmentName);
            return resolved;
          }
        }
      }
    }

    console.log('[DevelopmentResolver] Could not resolve development');
    return null;
  } catch (error) {
    console.error('[DevelopmentResolver] Error:', error);
    return null;
  }
}

export async function getSupabaseProjectIdForDevelopment(developmentName: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .ilike('name', developmentName)
      .single();
    return data?.id || null;
  } catch {
    return null;
  }
}
