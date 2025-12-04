import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

export interface AnomalyAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  actorId: string;
  tenantId: string;
  metadata: Record<string, any>;
  detectedAt: Date;
}

export async function detectSuspiciousLoginPatterns(tenantId: string, hours: number = 1): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  const result = await db.execute<{ actor_id: string; ip_address: string; count: number }>(sql`
    SELECT actor_id, ip_address, COUNT(*) as count
    FROM audit_log
    WHERE tenant_id = ${tenantId}
    AND type = 'login_failure'
    AND created_at > NOW() - INTERVAL '${sql.raw(hours.toString())} hours'
    GROUP BY actor_id, ip_address
    HAVING COUNT(*) >= 5
  `);

  for (const row of result.rows || []) {
    alerts.push({
      type: 'multiple_login_failures',
      severity: row.count >= 10 ? 'critical' : 'high',
      description: `${row.count} failed login attempts detected`,
      actorId: row.actor_id,
      tenantId,
      metadata: { ipAddress: row.ip_address, failureCount: row.count },
      detectedAt: new Date(),
    });
  }

  return alerts;
}

export async function detectUnauthorizedAccessAttempts(tenantId: string, hours: number = 24): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  const result = await db.execute<{ actor_id: string; actor_role: string; count: number }>(sql`
    SELECT actor_id, actor_role, COUNT(*) as count
    FROM audit_log
    WHERE tenant_id = ${tenantId}
    AND type = 'unauthorized_tenant_access'
    AND created_at > NOW() - INTERVAL '${sql.raw(hours.toString())} hours'
    GROUP BY actor_id, actor_role
    HAVING COUNT(*) >= 3
  `);

  for (const row of result.rows || []) {
    alerts.push({
      type: 'unauthorized_access_attempts',
      severity: 'high',
      description: `${row.count} unauthorized access attempts detected`,
      actorId: row.actor_id,
      tenantId,
      metadata: { actorRole: row.actor_role, attemptCount: row.count },
      detectedAt: new Date(),
    });
  }

  return alerts;
}

export async function detectMassDataExport(tenantId: string, hours: number = 1): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  const result = await db.execute<{ actor_id: string; actor_role: string; total_records: number; export_count: number }>(sql`
    SELECT 
      actor_id, 
      actor_role,
      SUM((metadata->>'record_count')::int) as total_records,
      COUNT(*) as export_count
    FROM audit_log
    WHERE tenant_id = ${tenantId}
    AND type = 'data_export'
    AND created_at > NOW() - INTERVAL '${sql.raw(hours.toString())} hours'
    GROUP BY actor_id, actor_role
    HAVING SUM((metadata->>'record_count')::int) > 1000
    OR COUNT(*) >= 5
  `);

  for (const row of result.rows || []) {
    alerts.push({
      type: 'mass_data_export',
      severity: row.total_records > 10000 ? 'critical' : 'medium',
      description: `Unusual data export activity: ${row.total_records} records in ${row.export_count} exports`,
      actorId: row.actor_id,
      tenantId,
      metadata: { 
        actorRole: row.actor_role,
        totalRecords: row.total_records,
        exportCount: row.export_count
      },
      detectedAt: new Date(),
    });
  }

  return alerts;
}

export async function detectAbnormalRateLimitHits(tenantId: string, hours: number = 1): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  const result = await db.execute<{ actor_id: string; count: number }>(sql`
    SELECT actor_id, COUNT(*) as count
    FROM audit_log
    WHERE tenant_id = ${tenantId}
    AND type = 'rate_limit_trigger'
    AND created_at > NOW() - INTERVAL '${sql.raw(hours.toString())} hours'
    GROUP BY actor_id
    HAVING COUNT(*) >= 10
  `);

  for (const row of result.rows || []) {
    alerts.push({
      type: 'excessive_rate_limit_hits',
      severity: row.count >= 50 ? 'high' : 'medium',
      description: `User hit rate limits ${row.count} times`,
      actorId: row.actor_id || 'unknown',
      tenantId,
      metadata: { hitCount: row.count },
      detectedAt: new Date(),
    });
  }

  return alerts;
}

export async function detectAllAnomalies(tenantId: string): Promise<AnomalyAlert[]> {
  const [loginFailures, unauthorizedAccess, massExports, rateLimitHits] = await Promise.all([
    detectSuspiciousLoginPatterns(tenantId, 1),
    detectUnauthorizedAccessAttempts(tenantId, 24),
    detectMassDataExport(tenantId, 1),
    detectAbnormalRateLimitHits(tenantId, 1),
  ]);

  return [...loginFailures, ...unauthorizedAccess, ...massExports, ...rateLimitHits]
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
}
