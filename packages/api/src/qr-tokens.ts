import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { db } from '@openhouse/db/client';
import { qr_tokens } from '@openhouse/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const SECRET: string = process.env.SESSION_SECRET || process.env.SUPABASE_JWT_SECRET || '';

if (!SECRET) {
  throw new Error('CRITICAL: SESSION_SECRET or SUPABASE_JWT_SECRET environment variable is required for QR token generation');
}

interface QRTokenPayload {
  supabaseUnitId: string;  // Supabase units.id (UUID) - primary identifier
  projectId: string;       // Supabase projects.id
}

interface GeneratedToken {
  token: string;
  url: string;
  expiresAt: Date;
}

/**
 * Generate a secure, signed token for QR code onboarding
 * Format: {supabaseUnitId}:{projectId}:{timestamp}:{nonce}:{signature}
 * Uses Supabase units.id (UUID) as the primary identifier
 */
export function signQRToken(payload: QRTokenPayload, expiryHours: number = 720): GeneratedToken {
  const timestamp = Date.now();
  const nonce = nanoid(16);
  const expiresAt = new Date(timestamp + expiryHours * 60 * 60 * 1000);
  
  // Create payload string with Supabase UUID as primary identifier
  const payloadString = `${payload.supabaseUnitId}:${payload.projectId}:${timestamp}:${nonce}`;
  
  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadString)
    .digest('base64url');
  
  // Combine into token
  const token = `${payloadString}:${signature}`;
  
  // Create purchaser onboarding URL - points to /homes/:supabaseUnitId?token=...
  // Priority: NEXT_PUBLIC_TENANT_PORTAL_URL > REPLIT_DEV_DOMAIN > localhost
  const baseUrl = 
    process.env.NEXT_PUBLIC_TENANT_PORTAL_URL || 
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000');
  const url = `${baseUrl}/homes/${payload.supabaseUnitId}?token=${encodeURIComponent(token)}`;
  
  return { token, url, expiresAt };
}

/**
 * Verify a QR token and extract its payload
 * Returns null if token is invalid or expired
 * Token format: {supabaseUnitId}:{projectId}:{timestamp}:{nonce}:{signature}
 */
export function verifyQRToken(token: string): QRTokenPayload | null {
  try {
    const parts = token.split(':');
    if (parts.length !== 5) {
      console.error('[QR Token] Invalid token format, expected 5 parts, got', parts.length);
      return null;
    }
    
    const [supabaseUnitId, projectId, timestampStr, nonce, providedSignature] = parts;
    
    // Recreate payload string
    const payloadString = `${supabaseUnitId}:${projectId}:${timestampStr}:${nonce}`;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', SECRET)
      .update(payloadString)
      .digest('base64url');
    
    if (expectedSignature !== providedSignature) {
      console.error('[QR Token] Invalid signature');
      return null;
    }
    
    // Check expiry (720 hours = 30 days default)
    const timestamp = parseInt(timestampStr, 10);
    const expiryTime = timestamp + (720 * 60 * 60 * 1000);
    
    if (Date.now() > expiryTime) {
      console.error('[QR Token] Token expired');
      return null;
    }
    
    return { supabaseUnitId, projectId };
  } catch (error) {
    console.error('[QR Token] Verification failed:', error);
    return null;
  }
}

/**
 * Generate a QR token for a unit and store it in the database
 * ALWAYS generates a new token and invalidates old ones to prevent token reuse
 * Uses Supabase units.id (UUID) as the primary identifier
 */
export async function generateQRTokenForUnit(
  supabaseUnitId: string,
  projectId: string
): Promise<GeneratedToken> {
  // Invalidate ALL existing tokens for this unit (both used and unused)
  // This ensures each PDF generation creates fresh, unique tokens
  await db
    .delete(qr_tokens)
    .where(eq(qr_tokens.unit_id, supabaseUnitId));
  
  // Generate new token with fresh nonce and timestamp
  const generated = signQRToken({ supabaseUnitId, projectId });
  
  // Store in database
  const tokenHash = crypto
    .createHash('sha256')
    .update(generated.token)
    .digest('hex');
  
  // Store ONLY token_hash for security - plaintext token never persisted
  // Token is returned in response but not stored in DB
  await db.insert(qr_tokens).values({
    unit_id: supabaseUnitId,
    tenant_id: projectId,  // Reusing tenant_id column for projectId
    development_id: projectId,
    token: null,  // Null - we only store the hash for security
    token_hash: tokenHash,
    expires_at: generated.expiresAt,
    created_at: new Date(),
  });
  
  console.log(`[QR Token] Generated fresh token for Supabase unit ${supabaseUnitId}, invalidated old tokens`);
  
  return generated;
}

/**
 * Mark a QR token as used after successful onboarding
 * Uses token_hash for security (DB access can't leak usable tokens)
 */
export async function markTokenAsUsed(token: string): Promise<boolean> {
  try {
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
    
    const result = await db
      .update(qr_tokens)
      .set({ used_at: new Date() })
      .where(eq(qr_tokens.token_hash, tokenHash))
      .returning();
    
    return result.length > 0;
  } catch (error) {
    console.error('[QR Token] Failed to mark token as used:', error);
    return false;
  }
}

/**
 * Validate a token from the database (checks if it exists, is unused, and not expired)
 * Uses token_hash for security - prevents token leakage via DB access
 * Returns payload with FOR UPDATE lock to prevent race conditions
 */
export async function validateQRToken(token: string): Promise<QRTokenPayload | null> {
  // First verify the signature and structure
  const payload = verifyQRToken(token);
  if (!payload) {
    return null;
  }
  
  // Calculate token hash for secure DB lookup
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  
  // Check database for token using hash (not plaintext)
  // Note: FOR UPDATE lock will be handled at transaction level in resolver
  const dbTokens = await db
    .select()
    .from(qr_tokens)
    .where(eq(qr_tokens.token_hash, tokenHash))
    .limit(1);
  
  if (dbTokens.length === 0) {
    console.error('[QR Token] Token not found in database');
    return null;
  }
  
  const dbToken = dbTokens[0];
  
  // Check if already used
  if (dbToken.used_at) {
    console.error('[QR Token] Token already used');
    return null;
  }
  
  // Check if expired
  if (dbToken.expires_at && dbToken.expires_at < new Date()) {
    console.error('[QR Token] Token expired');
    return null;
  }
  
  return payload;
}
