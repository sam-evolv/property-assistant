/**
 * OAuth Token Encryption
 *
 * All OAuth tokens and API credentials stored in the `integrations.credentials`
 * JSONB column are encrypted at the application level using AES-256-GCM
 * with a per-tenant key derived from a master key in environment variables.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getMasterKey(): string {
  const key = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('INTEGRATION_ENCRYPTION_KEY environment variable is required for credential encryption');
  }
  return key;
}

function deriveKey(tenantId: string): Buffer {
  return scryptSync(getMasterKey(), tenantId, 32);
}

export function encryptCredentials(tenantId: string, credentials: Record<string, any>): string {
  const key = deriveKey(tenantId);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Store iv:authTag:encryptedData
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptCredentials(tenantId: string, encryptedStr: string): Record<string, any> {
  const parts = encryptedStr.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credentials format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const key = deriveKey(tenantId);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

export function isTokenExpiringSoon(expiresAt: string | number | null, thresholdMs = 3600000): boolean {
  if (!expiresAt) return true;
  const expiryTime = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt;
  return expiryTime - Date.now() < thresholdMs;
}
