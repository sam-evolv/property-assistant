import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface ActiveSession {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSessionRecord(
  token: string,
  userId: string,
  tenantId: string,
  role: string,
  expiresAt: Date,
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  const tokenHash = hashToken(token);

  try {
    await db.execute(sql`
      INSERT INTO sessions (user_id, tenant_id, role, token_hash, ip_address, user_agent, expires_at)
      VALUES (
        ${userId}, 
        ${tenantId}, 
        ${role}, 
        ${tokenHash}, 
        ${metadata?.ipAddress || null}, 
        ${metadata?.userAgent || null}, 
        ${expiresAt.toISOString()}::timestamp
      )
    `);
  } catch (error) {
    console.error('[Session Manager] Failed to create session record:', error);
  }
}

export async function validateSessionRecord(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  try {
    const result = await db.execute<{ valid: boolean }>(sql`
      SELECT 
        CASE 
          WHEN revoked_at IS NOT NULL THEN FALSE
          WHEN expires_at < NOW() THEN FALSE
          ELSE TRUE
        END AS valid
      FROM sessions
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `);

    if (!result.rows || result.rows.length === 0) {
      return false;
    }

    return result.rows[0].valid || false;
  } catch (error) {
    console.error('[Session Manager] Failed to validate session:', error);
    return false;
  }
}

export async function updateSessionActivity(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  try {
    await db.execute(sql`
      UPDATE sessions
      SET last_activity_at = NOW()
      WHERE token_hash = ${tokenHash}
      AND revoked_at IS NULL
      AND expires_at > NOW()
    `);
  } catch (error) {
    console.error('[Session Manager] Failed to update session activity:', error);
  }
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  try {
    await db.execute(sql`
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE token_hash = ${tokenHash}
    `);

    console.log(`[Session Manager] Session revoked: ${tokenHash.substring(0, 8)}...`);
  } catch (error) {
    console.error('[Session Manager] Failed to revoke session:', error);
  }
}

export async function revokeUserSessions(userId: string, exceptToken?: string): Promise<void> {
  const exceptHash = exceptToken ? hashToken(exceptToken) : null;

  try {
    await db.execute(sql`
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE user_id = ${userId}
      AND revoked_at IS NULL
      ${exceptHash ? sql`AND token_hash != ${exceptHash}` : sql``}
    `);

    console.log(`[Session Manager] All sessions revoked for user: ${userId}`);
  } catch (error) {
    console.error('[Session Manager] Failed to revoke user sessions:', error);
  }
}

export async function getActiveSessions(userId: string): Promise<ActiveSession[]> {
  try {
    const result = await db.execute<ActiveSession>(sql`
      SELECT 
        id,
        user_id AS "userId",
        tenant_id AS "tenantId",
        role,
        ip_address AS "ipAddress",
        user_agent AS "userAgent",
        last_activity_at AS "lastActivityAt",
        expires_at AS "expiresAt",
        created_at AS "createdAt"
      FROM sessions
      WHERE user_id = ${userId}
      AND revoked_at IS NULL
      AND expires_at > NOW()
      ORDER BY last_activity_at DESC
    `);

    return result.rows || [];
  } catch (error) {
    console.error('[Session Manager] Failed to get active sessions:', error);
    return [];
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.execute(sql`
      DELETE FROM sessions
      WHERE expires_at < NOW() - INTERVAL '7 days'
      OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')
    `);

    const rowCount = result.rowCount || 0;
    if (rowCount > 0) {
      console.log(`[Session Manager] Cleaned up ${rowCount} expired/revoked sessions`);
    }

    return rowCount;
  } catch (error) {
    console.error('[Session Manager] Failed to cleanup sessions:', error);
    return 0;
  }
}
