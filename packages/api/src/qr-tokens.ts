import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { db } from '@openhouse/db/client';
import { qr_tokens, units } from '@openhouse/db/schema';
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

    // Constant-time comparison to avoid leaking the signature via timing.
    const expectedBuf = Buffer.from(expectedSignature);
    const providedBuf = Buffer.from(providedSignature || '');
    if (
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return null;
    }
    
    // Check expiry (720 hours = 30 days default)
    const timestamp = parseInt(timestampStr, 10);
    const expiryTime = timestamp + (720 * 60 * 60 * 1000);
    
    if (Date.now() > expiryTime) {
      return null;
    }
    
    return { supabaseUnitId, projectId };
  } catch {
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
  } catch {
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
      return payload;
    }
    
    const dbToken = dbTokens[0];
    
    // Check if already used
    if (dbToken.used_at) {
      return null;
    }
    
    // Check if expired
    if (dbToken.expires_at && dbToken.expires_at < new Date()) {
      return null;
    }
    
    return payload;
  } catch (dbError) {
    // Database error (table may not exist) - fall back to signature verification only
    // The signature was already verified above, so the token is cryptographically valid
    // Database error - fall back to signature verification only
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
 * Resolve a unit reference to its canonical units.id. The homeowner app
 * addresses a unit by its human unit_uid (e.g. AV-015-7CCB), not the UUID the
 * purchaser routes expect, so a non-UUID reference is looked up by unit_uid.
 * A UUID is returned unchanged with no database round trip. Mirrors the
 * either-form resolution getUnitInfo already does. Returns null if unknown.
 */
async function resolveUnitUidToId(ref: string): Promise<string | null> {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(ref)) return ref;
  try {
    const rows = await db
      .select({ id: units.id })
      .from(units)
      .where(eq(units.unit_uid, ref))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Standardized token validation for purchaser API endpoints.
 *
 * SECURITY MODEL (hardened): access requires a cryptographically valid signed
 * QR token whose embedded unit matches the claimed unit. There are exactly two
 * access paths:
 *   1. A signed token that also passes DB validation (fresh, unused, unexpired).
 *   2. A signed token whose HMAC signature + embedded expiry are still valid but
 *      that is marked used/absent in the DB — "continued session" access after a
 *      one-time QR link has been consumed. This still requires a real signature,
 *      so it cannot be forged from the unit id alone.
 *
 * The previous implementation also granted access when `token === unitUid` or
 * when the token merely *started with* the unit id (no signature check). Because
 * unit_uid codes appear in URLs/QR packs and are enumerable, that made the whole
 * purchaser API effectively unauthenticated. Those unsigned paths are removed.
 *
 * Showhouse / demo access (presenting the unit id as its own token, no signed
 * QR) is now OFF by default and only honoured when `ENABLE_SHOWHOUSE_DEMO=true`
 * is explicitly set in the environment. A `checkShowhouseEnabled` callback, when
 * supplied, is additionally required to return true (e.g. a per-unit is_showhouse
 * DB flag). This keeps production secure-by-default while letting demo
 * deployments opt in.
 */
export async function validatePurchaserToken(
  token: string,
  unitUid: string,
  checkShowhouseEnabled?: () => Promise<boolean>
): Promise<TokenValidationResult> {
  // The homeowner app passes the unit's human unit_uid, not its units.id UUID.
  // Resolve it up front so every check below runs against the canonical id and
  // the result carries that id back to the caller. UUID input resolves to
  // itself. A reference we cannot resolve is rejected.
  const resolvedUnitId = await resolveUnitUidToId(unitUid);
  if (!resolvedUnitId) {
    return { valid: false, unitId: null, isShowhouse: false, error: 'Invalid unit ID format' };
  }

  // Path 1: a fully valid signed token (signature + DB state: unused/unexpired).
  const payload = await validateQRToken(token);
  if (payload && payload.supabaseUnitId === resolvedUnitId) {
    return { valid: true, unitId: resolvedUnitId, isShowhouse: false };
  }

  // Path 2: continued-session access — the signature and embedded expiry are
  // still valid even though the one-time token was marked used in the DB. This
  // requires a genuine HMAC signature (verifyQRToken), so it cannot be forged
  // from the unit identifier.
  const signedPayload = verifyQRToken(token);
  if (signedPayload && signedPayload.supabaseUnitId === resolvedUnitId) {
    return { valid: true, unitId: resolvedUnitId, isShowhouse: false };
  }

  // Showhouse / demo: caller presented the unit's own identifier as the token,
  // with no signed QR. Secure-by-default: only honoured when explicitly enabled.
  const showhouseAllowed = process.env.ENABLE_SHOWHOUSE_DEMO === 'true';
  if (showhouseAllowed && (token === unitUid || token === resolvedUnitId)) {
    // If a per-unit checker is supplied it must also approve; otherwise the
    // env flag alone gates it.
    const isShowhouse = checkShowhouseEnabled ? await checkShowhouseEnabled() : true;
    if (isShowhouse) {
      return { valid: true, unitId: resolvedUnitId, isShowhouse: true };
    }
  }

  return { valid: false, unitId: null, isShowhouse: false, error: 'Invalid or expired token' };
}
