/**
 * Structured Logger for OpenHouse API
 *
 * In production (NODE_ENV === 'production'), outputs JSON with timestamp, level, message, meta.
 * In development, outputs a readable format.
 *
 * Automatically strips sensitive fields from meta objects before logging:
 * email, password, token, key, secret, phone, authorization, cookie.
 */

const SENSITIVE_KEYS = new Set([
  'email', 'password', 'token', 'key', 'secret', 'phone',
  'authorization', 'cookie', 'accesstoken', 'refreshtoken',
  'apikey', 'api_key', 'service_role_key',
]);

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_KEYS.has(lower);
}

function stripSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  if (obj instanceof Error) {
    return { message: obj.message, name: obj.name, stack: obj.stack };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => stripSensitive(item, depth + 1));
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = stripSensitive(value, depth + 1);
    }
  }
  return cleaned;
}

const isProduction = process.env.NODE_ENV === 'production';

function formatLog(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
): string {
  const cleaned = meta ? stripSensitive(meta) : undefined;

  if (isProduction) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(cleaned && typeof cleaned === 'object' ? cleaned as Record<string, unknown> : {}),
    });
  }

  // Development: readable format
  const prefix = `[${level.toUpperCase()}]`;
  const metaStr = cleaned ? ' ' + JSON.stringify(cleaned) : '';
  return `${prefix} ${message}${metaStr}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(formatLog('info', message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(formatLog('warn', message, meta));
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorMeta: Record<string, unknown> = { ...meta };
    if (error instanceof Error) {
      errorMeta.error = error.message;
      errorMeta.stack = error.stack;
    } else if (error !== undefined && error !== null) {
      errorMeta.error = error;
    }
    console.error(formatLog('error', message, errorMeta));
  },
};
