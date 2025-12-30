import { APP_ENV, FEATURE_FLAGS } from '../config/env';
import { nanoid } from 'nanoid';

export type ActorType = 'ai' | 'human' | 'system' | 'unknown';

export interface AuditLogPayload {
  eventName: string;
  actorType: ActorType;
  actorId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  metadata?: Record<string, any>;
  durationMs?: number;
}

export interface AuditLogEntry extends AuditLogPayload {
  timestamp: string;
  env: string;
}

export function generateRequestId(): string {
  return nanoid(12);
}

export function determineActorType(headers: Headers): ActorType {
  const agentRun = headers.get('x-agent-run');
  const aiChange = headers.get('x-ai-change');
  const systemActor = headers.get('x-system-actor');
  
  if (agentRun === 'replit-agent' || aiChange) {
    return 'ai';
  }
  
  if (systemActor === 'true') {
    return 'system';
  }
  
  const userAgent = headers.get('user-agent') || '';
  if (userAgent.includes('curl') || userAgent.includes('script')) {
    return 'unknown';
  }
  
  return 'human';
}

export function logAudit(payload: AuditLogPayload): void {
  if (!FEATURE_FLAGS.ENABLE_AUDIT_LOGS) {
    return;
  }
  
  const entry: AuditLogEntry = {
    ...payload,
    timestamp: new Date().toISOString(),
    env: APP_ENV,
  };
  
  const sanitizedEntry = sanitizeLogEntry(entry);
  
  console.log('[AUDIT]', JSON.stringify(sanitizedEntry));
}

function sanitizeLogEntry(entry: AuditLogEntry): AuditLogEntry {
  const sanitized = { ...entry };
  
  if (sanitized.metadata) {
    sanitized.metadata = sanitizeMetadata(sanitized.metadata);
  }
  
  return sanitized;
}

const SENSITIVE_KEYS = [
  'password', 'secret', 'token', 'key', 'authorization', 'cookie',
  'api_key', 'apikey', 'access_token', 'refresh_token', 'private',
];

function sanitizeMetadata(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

export function createAuditMiddleware() {
  return {
    onRequest: (request: Request, requestId: string): void => {
      const actorType = determineActorType(request.headers);
      
      logAudit({
        eventName: 'api_request_start',
        actorType,
        requestId,
        route: new URL(request.url).pathname,
        method: request.method,
      });
    },
    
    onResponse: (
      request: Request,
      requestId: string,
      status: number,
      durationMs: number
    ): void => {
      const actorType = determineActorType(request.headers);
      
      logAudit({
        eventName: 'api_request_end',
        actorType,
        requestId,
        route: new URL(request.url).pathname,
        method: request.method,
        durationMs,
        metadata: { status },
      });
    },
  };
}

export function logSecurityEvent(
  eventName: string,
  actorType: ActorType,
  metadata: Record<string, any>
): void {
  logAudit({
    eventName: `security_${eventName}`,
    actorType,
    metadata,
  });
}

export function logDbWriteAttempt(
  operation: string,
  allowed: boolean,
  actorType: ActorType,
  metadata?: Record<string, any>
): void {
  logAudit({
    eventName: allowed ? 'db_write_allowed' : 'db_write_blocked',
    actorType,
    metadata: {
      operation: operation.substring(0, 50),
      allowed,
      ...metadata,
    },
  });
}
