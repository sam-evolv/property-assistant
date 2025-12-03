type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  route?: string;
  method?: string;
  status?: number;
  duration?: number;
  tenantId?: string;
  developmentId?: string;
  userId?: string;
  error?: string;
  stack?: string;
  [key: string]: any;
}

class StructuredLogger {
  private readonly env: string;

  constructor() {
    this.env = process.env.NODE_ENV || 'development';
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    
    if (this.env === 'production') {
      const logEntry = {
        timestamp,
        level,
        message,
        ...context,
      };
      console.log(JSON.stringify(logEntry));
    } else {
      const emoji = {
        debug: '🔍',
        info: 'ℹ️',
        warn: '⚠️',
        error: '❌',
      }[level];
      
      console.log(`${emoji} [${level.toUpperCase()}] ${message}`, context || '');
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  apiRequest(route: string, method: string, status: number, duration: number, context?: LogContext): void {
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, 'API Request', {
      route,
      method,
      status,
      duration,
      ...context,
    });
  }

  slowQuery(query: string, duration: number, context?: LogContext): void {
    this.warn('Slow Query Detected', {
      query: query.substring(0, 200),
      duration,
      ...context,
    });
  }

  aiCall(operation: string, duration: number, tokens?: number, cost?: number, context?: LogContext): void {
    this.info('AI Operation', {
      operation,
      duration,
      tokens,
      cost,
      ...context,
    });
  }
}

export const logger = new StructuredLogger();

export function withTiming<T>(
  fn: () => Promise<T>,
  onComplete: (duration: number) => void
): Promise<T> {
  const start = Date.now();
  return fn().finally(() => {
    const duration = Date.now() - start;
    onComplete(duration);
  });
}
