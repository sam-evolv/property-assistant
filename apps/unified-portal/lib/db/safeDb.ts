import { APP_ENV, IS_DEV, IS_STAGING, IS_PROD, FEATURE_FLAGS, DB_WRITE_OVERRIDE_TOKEN } from '../config/env';

export class DbWriteBlockedError extends Error {
  constructor(operation: string, env: string) {
    super(`DB write blocked in ${env.toUpperCase()} by safety policy. Operation: ${operation}`);
    this.name = 'DbWriteBlockedError';
  }
}

const WRITE_PATTERNS = [
  /^\s*INSERT\s+/i,
  /^\s*UPDATE\s+/i,
  /^\s*DELETE\s+/i,
  /^\s*ALTER\s+/i,
  /^\s*DROP\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*CREATE\s+/i,
];

const DESTRUCTIVE_PATTERNS = [
  /^\s*DROP\s+/i,
  /^\s*TRUNCATE\s+/i,
  /^\s*DELETE\s+FROM\s+\w+\s*$/i,
  /^\s*ALTER\s+TABLE\s+\w+\s+DROP\s+/i,
];

export function isWriteQuery(sql: string): boolean {
  const trimmed = sql.trim();
  return WRITE_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function isDestructiveQuery(sql: string): boolean {
  const trimmed = sql.trim();
  return DESTRUCTIVE_PATTERNS.some(pattern => pattern.test(trimmed));
}

export function validateDbOperation(
  sql: string,
  options?: { overrideToken?: string }
): { allowed: boolean; reason?: string } {
  if (IS_DEV) {
    return { allowed: true };
  }
  
  if (options?.overrideToken && DB_WRITE_OVERRIDE_TOKEN) {
    if (options.overrideToken === DB_WRITE_OVERRIDE_TOKEN) {
      console.log('[SAFE_DB] Write override token matched, allowing operation');
      return { allowed: true };
    }
  }
  
  const isWrite = isWriteQuery(sql);
  const isDestructive = isDestructiveQuery(sql);
  
  if (isDestructive && !FEATURE_FLAGS.ALLOW_DESTRUCTIVE_DB) {
    return {
      allowed: false,
      reason: `Destructive DB operation blocked in ${APP_ENV.toUpperCase()}. Use override token for manual operations.`,
    };
  }
  
  if (isWrite && !FEATURE_FLAGS.DB_WRITE_ENABLED) {
    return {
      allowed: false,
      reason: `DB write blocked in ${APP_ENV.toUpperCase()} by safety policy.`,
    };
  }
  
  return { allowed: true };
}

export function guardDbWrite(sql: string, options?: { overrideToken?: string }): void {
  const validation = validateDbOperation(sql, options);
  if (!validation.allowed) {
    throw new DbWriteBlockedError(sql.substring(0, 50), APP_ENV);
  }
}

export function createSafeQueryWrapper<T extends (...args: any[]) => Promise<any>>(
  originalQuery: T,
  extractSql: (...args: Parameters<T>) => string
): T {
  return (async (...args: Parameters<T>) => {
    const sql = extractSql(...args);
    guardDbWrite(sql);
    return originalQuery(...args);
  }) as T;
}

export function checkWriteOverrideHeader(headers: Headers): string | undefined {
  return headers.get('x-db-write-override') || undefined;
}

export function getDbSafetyStatus(): {
  env: string;
  writeEnabled: boolean;
  destructiveEnabled: boolean;
  overrideConfigured: boolean;
} {
  return {
    env: APP_ENV,
    writeEnabled: FEATURE_FLAGS.DB_WRITE_ENABLED,
    destructiveEnabled: FEATURE_FLAGS.ALLOW_DESTRUCTIVE_DB,
    overrideConfigured: !!DB_WRITE_OVERRIDE_TOKEN,
  };
}
