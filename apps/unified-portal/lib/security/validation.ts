/**
 * OpenHouse AI Security Validation Utilities
 * Input validation, sanitization, and security helpers
 */

import { z } from 'zod';

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize for SQL-like contexts (use parameterized queries instead when possible)
 */
export function sanitizeForDb(input: string): string {
  return input.replace(/['";\\]/g, '');
}

/**
 * Strip all HTML tags
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize filename for safe file operations
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(254, 'Email too long');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number');

export const uuidSchema = z
  .string()
  .uuid('Invalid ID format');

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
  .max(100, 'Slug too long');

export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number');

export const urlSchema = z
  .string()
  .url('Invalid URL')
  .refine(
    (url) => url.startsWith('https://'),
    'URL must use HTTPS'
  );

// ============================================================================
// RATE LIMITING TOKENS
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter
 * For production, use Redis-based solution
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    // New window
    const newEntry = { count: 1, resetAt: now + windowMs };
    rateLimitStore.set(identifier, newEntry);
    return { allowed: true, remaining: limit - 1, resetAt: newEntry.resetAt };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ============================================================================
// CSRF PROTECTION
// ============================================================================

const csrfTokens = new Map<string, number>();

/**
 * Generate CSRF token
 */
export function generateCsrfToken(): string {
  const token = crypto.randomUUID();
  csrfTokens.set(token, Date.now() + 3600000); // 1 hour expiry
  return token;
}

/**
 * Validate CSRF token
 */
export function validateCsrfToken(token: string): boolean {
  const expiry = csrfTokens.get(token);
  if (!expiry) return false;

  if (Date.now() > expiry) {
    csrfTokens.delete(token);
    return false;
  }

  csrfTokens.delete(token); // Single use
  return true;
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

export const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.openai.com https://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export type SecurityEventType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'permission_denied'
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'data_export'
  | 'admin_action';

interface SecurityEvent {
  type: SecurityEventType;
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

const securityLog: SecurityEvent[] = [];

/**
 * Log security event for audit trail
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date(),
  };

  securityLog.push(fullEvent);

  // In production, send to logging service
  console.log('[SECURITY]', JSON.stringify(fullEvent));

  // Keep only last 1000 events in memory
  if (securityLog.length > 1000) {
    securityLog.shift();
  }
}

/**
 * Get recent security events (for admin dashboard)
 */
export function getSecurityEvents(limit = 100): SecurityEvent[] {
  return securityLog.slice(-limit);
}

// ============================================================================
// PASSWORD HASHING (Use bcrypt in production)
// ============================================================================

/**
 * Hash password (placeholder - use bcrypt in production)
 */
export async function hashPassword(password: string): Promise<string> {
  // In production: return bcrypt.hash(password, 12);
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password (placeholder - use bcrypt in production)
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// ============================================================================
// TENANT ISOLATION
// ============================================================================

/**
 * Verify tenant access
 */
export function verifyTenantAccess(
  userTenantId: string,
  resourceTenantId: string
): boolean {
  if (!userTenantId || !resourceTenantId) {
    logSecurityEvent({
      type: 'suspicious_activity',
      details: { reason: 'Missing tenant ID', userTenantId, resourceTenantId },
    });
    return false;
  }

  if (userTenantId !== resourceTenantId) {
    logSecurityEvent({
      type: 'permission_denied',
      details: { reason: 'Tenant mismatch', userTenantId, resourceTenantId },
    });
    return false;
  }

  return true;
}

/**
 * Create tenant-scoped query filter
 */
export function tenantFilter(tenantId: string): { tenant_id: string } {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new Error('Invalid tenant ID');
  }
  return { tenant_id: tenantId };
}
