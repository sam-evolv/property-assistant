import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  PGHOST: z.string(),
  PGPORT: z.coerce.number().int().positive(),
  PGUSER: z.string(),
  PGPASSWORD: z.string().min(1),
  PGDATABASE: z.string(),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWT_SECRET: z.string().min(32),
  
  // OpenAI
  OPENAI_API_KEY: z.string().regex(/^sk-/, 'OpenAI API key must start with sk-'),
  
  // Session
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Optional: External Services
  RESEND_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export class EnvironmentError extends Error {
  constructor(
    public issues: z.ZodIssue[],
    message: string = 'Environment validation failed'
  ) {
    super(message);
    this.name = 'EnvironmentError';
  }
}

let validatedEnv: Env | null = null;

export function validateEnvironment(): Env {
  if (validatedEnv) {
    return validatedEnv;
  }

  try {
    validatedEnv = envSchema.parse(process.env);
    console.log('[ENV] ✓ Environment variables validated successfully');
    return validatedEnv;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[ENV] ❌ Environment validation failed:');
      error.issues.forEach((issue) => {
        console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      throw new EnvironmentError(error.issues);
    }
    throw error;
  }
}

export function getEnv(): Env {
  if (!validatedEnv) {
    return validateEnvironment();
  }
  return validatedEnv;
}

export function detectMissingSecrets(): string[] {
  const missing: string[] = [];
  
  const requiredSecrets = [
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET',
    'SESSION_SECRET',
  ];

  for (const secret of requiredSecrets) {
    if (!process.env[secret]) {
      missing.push(secret);
    }
  }

  return missing;
}

export function auditSecretUsage(secretName: string, context: string): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  console.log(`[SECRET_AUDIT] ${secretName} accessed in ${context}`);
}

export function isSecretLogged(value: string): boolean {
  const secretPatterns = [
    /sk-[a-zA-Z0-9-]+/,
    /ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
    /postgres:\/\/[^@]+:[^@]+@/,
    /key-[a-zA-Z0-9]+/,
  ];

  return secretPatterns.some((pattern) => pattern.test(value));
}

export function sanitizeLogMessage(message: string): string {
  return message
    .replace(/sk-[a-zA-Z0-9-]+/g, 'sk-***REDACTED***')
    .replace(/ey[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '***JWT_REDACTED***')
    .replace(/postgres:\/\/([^@]+):([^@]+)@/g, 'postgres://***:***@')
    .replace(/key-[a-zA-Z0-9]+/g, 'key-***REDACTED***')
    .replace(/Bearer\s+[a-zA-Z0-9_-]+/g, 'Bearer ***REDACTED***');
}
