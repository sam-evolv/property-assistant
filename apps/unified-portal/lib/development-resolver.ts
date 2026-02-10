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

const DEVELOPMENT_CACHE_TTL_MS = 60_000;
const developmentCache = new Map<string, { data: ResolvedDevelopment; expiresAt: number }>();

function getCachedDevelopment(key: string): ResolvedDevelopment | null {
  const entry = developmentCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    developmentCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedDevelopment(key: string, data: ResolvedDevelopment): void {
  developmentCache.set(key, { data, expiresAt: Date.now() + DEVELOPMENT_CACHE_TTL_MS });
}

const KNOWN_ID_MAPPINGS: Record<string, { drizzleId: string }> = {
  '57dc3919-2725-4575-8046-9179075ac88e': { drizzleId: '34316432-f1e8-4297-b993-d9b5c88ee2d8' },
  '6d3789de-2e46-430c-bf31-22224bd878da': { drizzleId: 'e0833063-55ac-4201-a50e-f329c090fbd6' },
  '9598cf36-3e3f-4b7d-be6d-d1e80f708f46': { drizzleId: '9598cf36-3e3f-4b7d-be6d-d1e80f708f46' },
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
  const cached = getCachedDevelopment(cacheKey);
  if (cached) {
    return cached;
  }

  console.log('[DevelopmentResolver] Resolving development for project_id:', supabaseProjectId, 'address:', address);

  if (supabaseProjectId && KNOWN_ID_MAPPINGS[supabaseProjectId]) {
    const mapping = KNOWN_ID_MAPPINGS[supabaseProjectId];
    console.log('[DevelopmentResolver] Known mapping found, querying DB for drizzleId:', mapping.drizzleId);
    try {
      const { rows } = await db.execute(sql`
        SELECT id, name, tenant_id, logo_url FROM developments WHERE id = ${mapping.drizzleId} LIMIT 1
      `);
      if (rows.length > 0) {
        const dev = rows[0] as any;
        const resolved: ResolvedDevelopment = {
          drizzleDevelopmentId: dev.id,
          supabaseProjectId: supabaseProjectId,
          developmentName: dev.name,
          tenantId: dev.tenant_id || null,
          logoUrl: dev.logo_url || null,
        };
        setCachedDevelopment(cacheKey, resolved);
        console.log('[DevelopmentResolver] Resolved from DB via known mapping:', resolved.developmentName, 'logo:', resolved.logoUrl);
        return resolved;
      }
    } catch (err) {
      console.error('[DevelopmentResolver] DB lookup for known mapping failed:', err);
    }
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
        setCachedDevelopment(cacheKey, resolved);
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
            setCachedDevelopment(cacheKey, resolved);
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
