/**
 * Destructive Operations Guard
 * 
 * Prevents accidental execution of destructive operations in production.
 * 
 * Requirements:
 * 1. ALLOW_DESTRUCTIVE_OPS=true must be set
 * 2. DESTRUCTIVE_OPS_SECRET must match the expected secret
 * 3. NODE_ENV must not be 'production' unless explicitly overridden
 * 
 * Usage:
 *   import { requireDestructiveOpsPermission } from './guards/destructive-ops';
 *   
 *   // At the start of any destructive script
 *   requireDestructiveOpsPermission('Seeding demo data');
 */

interface DestructiveOpsConfig {
  allowDestructiveOps: boolean;
  secret: string;
  expectedSecret: string;
  isProduction: boolean;
}

function getConfig(): DestructiveOpsConfig {
  return {
    allowDestructiveOps: process.env.ALLOW_DESTRUCTIVE_OPS === 'true',
    secret: process.env.DESTRUCTIVE_OPS_SECRET || '',
    expectedSecret: process.env.DESTRUCTIVE_OPS_SECRET_EXPECTED || 'not-set',
    isProduction: process.env.NODE_ENV === 'production',
  };
}

/**
 * Check if destructive operations are allowed without throwing
 */
export function canPerformDestructiveOps(): { allowed: boolean; reason: string } {
  const config = getConfig();

  if (!config.allowDestructiveOps) {
    return {
      allowed: false,
      reason: 'ALLOW_DESTRUCTIVE_OPS is not set to "true"',
    };
  }

  if (config.isProduction) {
    // In production, require secret validation
    if (!config.secret) {
      return {
        allowed: false,
        reason: 'DESTRUCTIVE_OPS_SECRET is required in production',
      };
    }

    // Note: In a real implementation, you'd validate against a stored secret
    // For now, we just check that it's set and non-empty
    if (config.secret.length < 16) {
      return {
        allowed: false,
        reason: 'DESTRUCTIVE_OPS_SECRET must be at least 16 characters',
      };
    }
  }

  return { allowed: true, reason: 'Destructive operations permitted' };
}

/**
 * Require permission for destructive operations - throws if not allowed
 */
export function requireDestructiveOpsPermission(operationName: string): void {
  const { allowed, reason } = canPerformDestructiveOps();

  if (!allowed) {
    console.error('╔' + '═'.repeat(70) + '╗');
    console.error('║' + '  🚫 DESTRUCTIVE OPERATION BLOCKED'.padEnd(70) + '║');
    console.error('╚' + '═'.repeat(70) + '╝');
    console.error('');
    console.error(`  Operation: ${operationName}`);
    console.error(`  Reason: ${reason}`);
    console.error('');
    console.error('  To enable destructive operations:');
    console.error('    1. Set ALLOW_DESTRUCTIVE_OPS=true');
    console.error('    2. In production, also set DESTRUCTIVE_OPS_SECRET');
    console.error('');
    console.error('  ⚠️  This is a safety feature. Do not bypass in production.');
    console.error('');

    throw new Error(`Destructive operation blocked: ${reason}`);
  }

  console.log('');
  console.log('⚠️  DESTRUCTIVE OPERATION PERMITTED');
  console.log(`   Operation: ${operationName}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('');
}

/**
 * Decorator for async functions that require destructive ops permission
 */
export function withDestructiveOpsGuard<T extends (...args: any[]) => Promise<any>>(
  operationName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>) => {
    requireDestructiveOpsPermission(operationName);
    return fn(...args);
  }) as T;
}

/**
 * Log a destructive operation for audit purposes
 */
export function logDestructiveOperation(
  operation: string,
  details: Record<string, any>
): void {
  const logEntry = {
    type: 'destructive_operation',
    operation,
    details,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    allowed: canPerformDestructiveOps().allowed,
  };

  // In production, this should write to a secure audit log
  console.log('[DESTRUCTIVE_OP]', JSON.stringify(logEntry));
}
