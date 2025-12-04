import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';

class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowSeconds: number;

  constructor(maxRequests: number, windowSeconds: number) {
    this.maxRequests = maxRequests;
    this.windowSeconds = windowSeconds;
  }

  async check(key: string): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = new Date();
    const newResetTime = new Date(now.getTime() + this.windowSeconds * 1000);

    try {
      const result = await db.execute<{ count: number; reset_time: string }>(sql`
        INSERT INTO rate_limits (key, count, reset_time)
        VALUES (${key}, 1, ${newResetTime.toISOString()}::timestamp)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE 
            WHEN rate_limits.reset_time < CURRENT_TIMESTAMP THEN 1
            ELSE rate_limits.count + 1
          END,
          reset_time = CASE
            WHEN rate_limits.reset_time < CURRENT_TIMESTAMP THEN ${newResetTime.toISOString()}::timestamp
            ELSE rate_limits.reset_time
          END,
          updated_at = CURRENT_TIMESTAMP
        RETURNING count, reset_time
      `);

      if (result.rows && result.rows.length > 0) {
        const { count, reset_time } = result.rows[0];
        const currentCount = Number(count);
        const resetTimestamp = new Date(reset_time).getTime();

        if (currentCount > this.maxRequests) {
          return { 
            allowed: false, 
            remaining: 0, 
            resetTime: resetTimestamp 
          };
        }

        return { 
          allowed: true, 
          remaining: this.maxRequests - currentCount, 
          resetTime: resetTimestamp 
        };
      }

      return { allowed: true, remaining: this.maxRequests - 1, resetTime: newResetTime.getTime() };
    } catch (error) {
      console.error('Rate limiter error:', error);
      return { allowed: true, remaining: this.maxRequests, resetTime: newResetTime.getTime() };
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await db.execute(sql`DELETE FROM rate_limits WHERE key = ${key}`);
    } catch (error) {
      console.error('Rate limiter reset error:', error);
    }
  }
}

export const adminAnalyticsLimiter = new RateLimiter(100, 60);
export const developerApiLimiter = new RateLimiter(150, 60);
export const developerBurstLimiter = new RateLimiter(20, 5);
export const homeownerChatLimiter = new RateLimiter(10, 30);
export const ipFallbackLimiter = new RateLimiter(50, 60);
export const chatRateLimiter = new RateLimiter(60, 60);
export const trainRateLimiter = new RateLimiter(10, 60);
export const uploadRateLimiter = new RateLimiter(20, 60);

export function getRateLimitKey(tenantId: string, resource: string, userId?: string): string {
  return userId ? `${tenantId}:${userId}:${resource}` : `${tenantId}:${resource}`;
}

export function getIpRateLimitKey(ipAddress: string, resource: string): string {
  return `ip:${ipAddress}:${resource}`;
}

export async function checkAdminRateLimit(adminId: string, tenantId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const key = getRateLimitKey(tenantId, 'admin-api', adminId);
  return await adminAnalyticsLimiter.check(key);
}

export async function checkDeveloperRateLimit(developerId: string, tenantId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
  burstAllowed?: boolean;
}> {
  const key = getRateLimitKey(tenantId, 'developer-api', developerId);
  const mainLimit = await developerApiLimiter.check(key);
  
  if (!mainLimit.allowed) {
    return mainLimit;
  }
  
  const burstKey = getRateLimitKey(tenantId, 'developer-burst', developerId);
  const burstLimit = await developerBurstLimiter.check(burstKey);
  
  if (!burstLimit.allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: burstLimit.resetTime,
      burstAllowed: false,
    };
  }
  
  return {
    ...mainLimit,
    burstAllowed: true,
  };
}

export async function checkHomeownerChatLimit(homeownerId: string, tenantId: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const key = getRateLimitKey(tenantId, 'homeowner-chat', homeownerId);
  return await homeownerChatLimiter.check(key);
}

export async function checkIpLimit(ipAddress: string, resource: string): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const key = getIpRateLimitKey(ipAddress, resource);
  return await ipFallbackLimiter.check(key);
}
