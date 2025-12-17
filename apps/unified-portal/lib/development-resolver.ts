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

// Known ID mappings between Supabase project IDs and Drizzle development IDs
// This provides a reliable fallback when Supabase queries fail
const KNOWN_ID_MAPPINGS: Record<string, { drizzleId: string; name: string }> = {
  '57dc3919-2725-4575-8046-9179075ac88e': { drizzleId: '34316432-f1e8-4297-b993-d9b5c88ee2d8', name: 'Longview Park' },
  '6d3789de-2e46-430c-bf31-22224bd878da': { drizzleId: 'e0833063-55ac-4201-a50e-f329c090fbd6', name: 'Rathard Park' },
};

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

  // Check hardcoded mapping first (reliable fallback)
  if (supabaseProjectId && KNOWN_ID_MAPPINGS[supabaseProjectId]) {
    const mapping = KNOWN_ID_MAPPINGS[supabaseProjectId];
    console.log('[DevelopmentResolver] Using known mapping:', mapping.name, '->', mapping.drizzleId);
    const resolved: ResolvedDevelopment = {
      drizzleDevelopmentId: mapping.drizzleId,
      supabaseProjectId: supabaseProjectId,
      developmentName: mapping.name,
      tenantId: null,
      logoUrl: null,
    };
    developmentCache.set(cacheKey, resolved);
    return resolved;
  }

  try {
    let supabaseProject: { id: string; name: string; logo_url?: string } | null = null;
    
    if (supabaseProjectId) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, logo_url')
        .eq('id', supabaseProjectId)
        .single();
      if (error) {
        console.error('[DevelopmentResolver] Supabase query error:', error.message);
      }
      supabaseProject = data;
      console.log('[DevelopmentResolver] Supabase project:', supabaseProject?.name || 'not found');
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
