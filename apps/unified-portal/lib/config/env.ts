import { z } from 'zod';

export type AppEnv = 'dev' | 'staging' | 'prod';

const envSchema = z.object({
  APP_ENV: z.enum(['dev', 'staging', 'prod']).default('dev'),
  DB_WRITE_ENABLED: z.string().optional(),
  ALLOW_DESTRUCTIVE_DB: z.string().optional(),
  ENABLE_RATE_LIMITS: z.string().optional(),
  ENABLE_AUDIT_LOGS: z.string().optional(),
  DB_WRITE_OVERRIDE_TOKEN: z.string().optional(),
});

function parseEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('[ENV CONFIG] Invalid environment configuration:', result.error.format());
    return {
      APP_ENV: 'dev' as AppEnv,
      DB_WRITE_ENABLED: undefined,
      ALLOW_DESTRUCTIVE_DB: undefined,
      ENABLE_RATE_LIMITS: undefined,
      ENABLE_AUDIT_LOGS: undefined,
      DB_WRITE_OVERRIDE_TOKEN: undefined,
    };
  }
  return result.data;
}

const parsedEnv = parseEnv();

export const APP_ENV: AppEnv = parsedEnv.APP_ENV;
export const IS_DEV = APP_ENV === 'dev';
export const IS_STAGING = APP_ENV === 'staging';
export const IS_PROD = APP_ENV === 'prod';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

export const FEATURE_FLAGS = {
  DB_WRITE_ENABLED: parseBoolean(
    parsedEnv.DB_WRITE_ENABLED,
    IS_DEV ? true : false
  ),
  
  ALLOW_DESTRUCTIVE_DB: parseBoolean(
    parsedEnv.ALLOW_DESTRUCTIVE_DB,
    IS_DEV ? true : false
  ),
  
  ENABLE_RATE_LIMITS: parseBoolean(
    parsedEnv.ENABLE_RATE_LIMITS,
    IS_STAGING || IS_PROD ? true : false
  ),
  
  ENABLE_AUDIT_LOGS: parseBoolean(
    parsedEnv.ENABLE_AUDIT_LOGS,
    true
  ),
};

export const DB_WRITE_OVERRIDE_TOKEN = parsedEnv.DB_WRITE_OVERRIDE_TOKEN;

export function validateStagingProdConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (IS_STAGING || IS_PROD) {
    if (!process.env.SUPABASE_DB_URL && !process.env.DATABASE_URL) {
      errors.push('SUPABASE_DB_URL or DATABASE_URL is required in staging/prod');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('SUPABASE_SERVICE_ROLE_KEY is required in staging/prod');
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required in staging/prod');
    }
  }
  
  return { valid: errors.length === 0, errors };
}

export function logEnvConfig(): void {
  console.log('[ENV CONFIG] Environment:', APP_ENV);
  console.log('[ENV CONFIG] Feature Flags:', {
    DB_WRITE_ENABLED: FEATURE_FLAGS.DB_WRITE_ENABLED,
    ALLOW_DESTRUCTIVE_DB: FEATURE_FLAGS.ALLOW_DESTRUCTIVE_DB,
    ENABLE_RATE_LIMITS: FEATURE_FLAGS.ENABLE_RATE_LIMITS,
    ENABLE_AUDIT_LOGS: FEATURE_FLAGS.ENABLE_AUDIT_LOGS,
  });
  
  if (IS_STAGING || IS_PROD) {
    const validation = validateStagingProdConfig();
    if (!validation.valid) {
      console.error('[ENV CONFIG] Validation errors:', validation.errors);
    }
  }
}

export function getEnvSummary(): {
  env: AppEnv;
  isDev: boolean;
  isStaging: boolean;
  isProd: boolean;
  features: typeof FEATURE_FLAGS;
} {
  return {
    env: APP_ENV,
    isDev: IS_DEV,
    isStaging: IS_STAGING,
    isProd: IS_PROD,
    features: FEATURE_FLAGS,
  };
}
