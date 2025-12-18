import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';

export type ErrorType = 'supabase' | 'llm' | 'timeout' | 'validation' | 'database' | 'auth' | 'purchaser' | 'unknown';
export type Severity = 'warning' | 'error' | 'critical';

interface LogErrorParams {
  tenantId?: string;
  developmentId?: string;
  errorType: ErrorType;
  errorCode?: string;
  errorMessage: string;
  stackTrace?: string;
  endpoint?: string;
  requestContext?: Record<string, any>;
  severity?: Severity;
}

export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const {
      tenantId,
      developmentId,
      errorType,
      errorCode,
      errorMessage,
      stackTrace,
      endpoint,
      requestContext = {},
      severity = 'error'
    } = params;

    // Strip any PII from request context
    const sanitisedContext = sanitiseContext(requestContext);

    await db.execute(sql`
      INSERT INTO error_logs (
        tenant_id, development_id, error_type, error_code, 
        error_message, stack_trace, endpoint, request_context, severity
      ) VALUES (
        ${tenantId ? sql`${tenantId}::uuid` : sql`NULL`},
        ${developmentId ? sql`${developmentId}::uuid` : sql`NULL`},
        ${errorType},
        ${errorCode || null},
        ${errorMessage},
        ${stackTrace || null},
        ${endpoint || null},
        ${JSON.stringify(sanitisedContext)}::jsonb,
        ${severity}
      )
    `);

    // Also log to console for immediate visibility
    console.error(`[ErrorLog] ${severity.toUpperCase()} - ${errorType}: ${errorMessage}`);
  } catch (e) {
    // Don't throw if logging fails - just console log
    console.error('[ErrorLog] Failed to log error to database:', e);
    console.error('[ErrorLog] Original error:', params.errorMessage);
  }
}

// Helper to create error loggers for specific endpoints
export function createErrorLogger(endpoint: string, tenantId?: string, developmentId?: string) {
  return {
    supabase: (message: string, code?: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType: 'supabase', errorCode: code, errorMessage: message, requestContext: context }),
    
    llm: (message: string, code?: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType: 'llm', errorCode: code, errorMessage: message, requestContext: context }),
    
    timeout: (message: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType: 'timeout', errorMessage: message, requestContext: context }),
    
    validation: (message: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType: 'validation', errorMessage: message, requestContext: context, severity: 'warning' }),
    
    database: (message: string, code?: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType: 'database', errorCode: code, errorMessage: message, requestContext: context }),
    
    auth: (message: string, code?: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType: 'auth', errorCode: code, errorMessage: message, requestContext: context, severity: 'warning' }),
    
    purchaser: (message: string, code?: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType: 'purchaser', errorCode: code, errorMessage: message, requestContext: context }),
    
    critical: (message: string, errorType: ErrorType, stackTrace?: string, context?: Record<string, any>) =>
      logError({ tenantId, developmentId, endpoint, errorType, errorMessage: message, stackTrace, requestContext: context, severity: 'critical' }),
  };
}

// Strip PII from context before logging
function sanitiseContext(context: Record<string, any>): Record<string, any> {
  const piiFields = ['email', 'name', 'address', 'phone', 'ip', 'user_agent', 'password', 'token', 'authorization'];
  const sanitised: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (piiFields.some(pii => lowerKey.includes(pii))) {
      sanitised[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitised[key] = sanitiseContext(value);
    } else {
      sanitised[key] = value;
    }
  }
  
  return sanitised;
}

// Get recent errors for dashboard
export async function getRecentErrors(options: {
  tenantId?: string;
  developmentId?: string;
  limit?: number;
  unresolvedOnly?: boolean;
  errorType?: ErrorType;
}) {
  const { tenantId, developmentId, limit = 50, unresolvedOnly = false, errorType } = options;
  
  let whereClause = sql`1=1`;
  
  if (tenantId) {
    whereClause = sql`${whereClause} AND tenant_id = ${tenantId}::uuid`;
  }
  if (developmentId) {
    whereClause = sql`${whereClause} AND development_id = ${developmentId}::uuid`;
  }
  if (unresolvedOnly) {
    whereClause = sql`${whereClause} AND resolved = false`;
  }
  if (errorType) {
    whereClause = sql`${whereClause} AND error_type = ${errorType}`;
  }
  
  const { rows } = await db.execute(sql`
    SELECT id, tenant_id, development_id, error_type, error_code, error_message,
           endpoint, severity, resolved, created_at
    FROM error_logs
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);
  
  return rows;
}

// Get error statistics
export async function getErrorStats(tenantId: string, days: number = 7) {
  const { rows } = await db.execute(sql`
    SELECT 
      error_type,
      severity,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE resolved = false) as unresolved_count,
      MAX(created_at) as last_occurrence
    FROM error_logs
    WHERE tenant_id = ${tenantId}::uuid
      AND created_at > now() - interval '${sql.raw(days.toString())} days'
    GROUP BY error_type, severity
    ORDER BY count DESC
  `);
  
  return rows;
}
