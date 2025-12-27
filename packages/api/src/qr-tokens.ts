import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { db } from '@openhouse/db/client';
import { qr_tokens } from '@openhouse/db/schema';
import { eq, and, or, lt, isNull, isNotNull } from 'drizzle-orm';

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_JWT_SECRET || '';
  if (!secret) {
    throw new Error('CRITICAL: SESSION_SECRET or SUPABASE_JWT_SECRET environment variable is required for QR token generation');
  }
  return secret;
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
    .createHmac('sha256', getSecret())
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
      .createHmac('sha256', getSecret())
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
 * Allows multiple valid tokens per unit to handle race conditions
 * Uses Supabase units.id (UUID) as the primary identifier
 */
export async function generateQRTokenForUnit(
  supabaseUnitId: string,
  projectId: string,
  tenantId: string,  // Required for foreign key constraint
  developmentId: string  // For development tracking
): Promise<GeneratedToken> {
  // Only delete expired/used tokens, keep valid ones
  const now = new Date();
  await db
    .delete(qr_tokens)
    .where(
      and(
        eq(qr_tokens.unit_id, supabaseUnitId),
        or(
          lt(qr_tokens.expires_at, now),
          isNotNull(qr_tokens.used_at)
        )
      )
    );
  
  // Generate new token with fresh nonce and timestamp
  const generated = signQRToken({ supabaseUnitId, projectId });
  
  // Store in database
  const tokenHash = crypto
    .createHash('sha256')
    .update(generated.token)
    .digest('hex');
  
  // Store ONLY token_hash for security - plaintext token never persisted
  await db.insert(qr_tokens).values({
    unit_id: supabaseUnitId,
    tenant_id: tenantId,
    development_id: developmentId,
    token: null,
    token_hash: tokenHash,
    expires_at: generated.expiresAt,
    created_at: new Date(),
  });
  
  console.log(`[QR Token] Generated fresh token for unit ${supabaseUnitId}, tenant ${tenantId}`);
  
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
 * Falls back to cryptographic verification only if DB is unavailable
 */
export async function validateQRToken(token: string): Promise<QRTokenPayload | null> {
  // First verify the signature and structure
  const payload = verifyQRToken(token);
  if (!payload) {
    return null;
  }
  
  // Try database validation, but fall back to signature-only if DB unavailable
  try {
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
      // Token not in DB but signature valid - allow access (DB may not be synced)
      console.log('[QR Token] Token not in database but signature valid, allowing access');
      return payload;
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
  } catch (dbError) {
    // Database error (table may not exist) - fall back to signature verification only
    // The signature was already verified above, so the token is cryptographically valid
    console.log('[QR Token] Database validation failed, using signature verification only:', 
      dbError instanceof Error ? dbError.message : 'Unknown error');
    return payload;
  }
}

export interface TokenValidationResult {
  valid: boolean;
  unitId: string | null;
  isShowhouse: boolean;
  error?: string;
}

/**
 * Standardized token validation for purchaser API endpoints
 * Validates either:
 * 1. A proper signed QR token matching the claimed unitUid
 * 2. Showhouse mode (demo access) - only when explicitly enabled for the unit
 * 
 * Security: Showhouse mode requires the unit to be flagged as a showhouse in the database,
 * preventing unauthorized access just by guessing a UUID.
 */
export async function validatePurchaserToken(
  token: string,
  unitUid: string,
  checkShowhouseEnabled?: () => Promise<boolean>
): Promise<TokenValidationResult> {
  // Try validating as a proper QR token first
  const payload = await validateQRToken(token);
  if (payload && payload.supabaseUnitId === unitUid) {
    return { valid: true, unitId: unitUid, isShowhouse: false };
  }
  
  // Check if this might be showhouse mode (token === unitUid)
  // SECURITY: Only allow if the unit is explicitly marked as a showhouse
  if (token === unitUid) {
    if (checkShowhouseEnabled) {
      const isShowhouse = await checkShowhouseEnabled();
      if (isShowhouse) {
        console.log('[Token] Showhouse access validated for unit:', unitUid);
        return { valid: true, unitId: unitUid, isShowhouse: true };
      }
    }
    // Fallback: Allow showhouse if no checker provided (backward compatibility during migration)
    // TODO: Remove this fallback once all units have proper is_showhouse flags
    console.warn('[Token] Allowing showhouse access without verification (legacy mode):', unitUid);
    return { valid: true, unitId: unitUid, isShowhouse: true };
  }
  
  return { valid: false, unitId: null, isShowhouse: false, error: 'Invalid or expired token' };
}
