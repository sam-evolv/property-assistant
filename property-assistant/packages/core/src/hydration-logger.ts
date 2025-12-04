/**
 * HYDRATION DIAGNOSTIC LOGGER
 * 
 * Logs all hydration events for debugging:
 * - Provider initialization
 * - JWT refresh attempts
 * - Safe client fallbacks
 * - Server-to-client bridging
 */

import { logger } from '@openhouse/api/logger';
import { writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';

const HYDRATION_LOG_PATH = join(process.cwd(), 'logs', 'HYDRATION_REPORT.md');

export interface HydrationEvent {
  timestamp: string;
  type: 'provider_init' | 'jwt_refresh' | 'safe_client_fallback' | 'server_client_bridge' | 'error';
  context: string;
  details: Record<string, any>;
}

class HydrationLogger {
  private events: HydrationEvent[] = [];
  private initialized = false;

  constructor() {
    if (typeof window === 'undefined') {
      this.initializeLogFile();
    }
  }

  private initializeLogFile() {
    try {
      if (!existsSync(join(process.cwd(), 'logs'))) {
        return; // Skip if logs directory doesn't exist
      }

      const header = `# HYDRATION DIAGNOSTIC REPORT
Generated: ${new Date().toISOString()}

This report tracks all hydration events across the application to help debug:
- Undefined contexts
- SSR/Client race conditions
- JWT refresh issues
- Provider initialization order

---

## Events

`;

      writeFileSync(HYDRATION_LOG_PATH, header);
      this.initialized = true;
      logger.info('[HydrationLogger] Initialized log file', { path: HYDRATION_LOG_PATH });
    } catch (error) {
      logger.error('[HydrationLogger] Failed to initialize log file', { error });
    }
  }

  logEvent(event: Omit<HydrationEvent, 'timestamp'>) {
    const fullEvent: HydrationEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);

    // Log to console
    logger.info(`[Hydration ${event.type}]`, {
      context: event.context,
      ...event.details,
    });

    // Append to file if server-side
    if (typeof window === 'undefined' && this.initialized) {
      try {
        const logEntry = `
### ${fullEvent.type.toUpperCase().replace(/_/g, ' ')}
**Time:** ${fullEvent.timestamp}  
**Context:** ${fullEvent.context}  
**Details:**
\`\`\`json
${JSON.stringify(fullEvent.details, null, 2)}
\`\`\`

---

`;
        appendFileSync(HYDRATION_LOG_PATH, logEntry);
      } catch (error) {
        logger.error('[HydrationLogger] Failed to append to log file', { error });
      }
    }
  }

  logProviderInit(context: string, details: Record<string, any>) {
    this.logEvent({
      type: 'provider_init',
      context,
      details,
    });
  }

  logJWTRefresh(success: boolean, details: Record<string, any>) {
    this.logEvent({
      type: 'jwt_refresh',
      context: success ? 'JWT refresh succeeded' : 'JWT refresh failed',
      details,
    });
  }

  logSafeClientFallback(endpoint: string, reason: string, details: Record<string, any>) {
    this.logEvent({
      type: 'safe_client_fallback',
      context: `Safe client fallback: ${endpoint}`,
      details: {
        endpoint,
        reason,
        ...details,
      },
    });
  }

  logServerClientBridge(page: string, data: Record<string, any>) {
    this.logEvent({
      type: 'server_client_bridge',
      context: `Server-to-client bridge: ${page}`,
      details: data,
    });
  }

  logError(context: string, error: unknown) {
    this.logEvent({
      type: 'error',
      context,
      details: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
  }

  getEvents(): HydrationEvent[] {
    return [...this.events];
  }

  clearEvents() {
    this.events = [];
    logger.info('[HydrationLogger] Events cleared');
  }
}

export const hydrationLogger = new HydrationLogger();
