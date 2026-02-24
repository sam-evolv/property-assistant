type EnvVar = {
  key: string;
  required: boolean;
  description: string;
};

const CRITICAL_ENV_VARS: EnvVar[] = [
  {
    key: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL database connection URL',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    key: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key for server-side operations',
  },
  {
    key: 'NEXT_PUBLIC_APP_URL',
    required: true,
    description: 'Public URL of the deployed app (required for QR codes)',
  },
];

const OPTIONAL_ENV_VARS: EnvVar[] = [
  {
    key: 'OPENAI_API_KEY',
    required: false,
    description: 'OpenAI API key for AI features (optional)',
  },
  {
    key: 'GOOGLE_MAPS_API_KEY',
    required: false,
    description: 'Google Maps API key for map features (optional)',
  },
  {
    key: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key for email features (optional)',
  },
  {
    key: 'INTEGRATION_ENCRYPTION_KEY',
    required: false,
    description: 'AES-256 encryption key for integration credentials (optional)',
  },
  {
    key: 'MICROSOFT_CLIENT_ID',
    required: false,
    description: 'Microsoft OAuth client ID for Excel/SharePoint/Dynamics integrations (optional)',
  },
  {
    key: 'GOOGLE_CLIENT_ID',
    required: false,
    description: 'Google OAuth client ID for Google Sheets integration (optional)',
  },
];

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of CRITICAL_ENV_VARS) {
    if (!process.env[envVar.key]) {
      missing.push(`${envVar.key}: ${envVar.description}`);
    }
  }

  for (const envVar of OPTIONAL_ENV_VARS) {
    if (!process.env[envVar.key]) {
      warnings.push(`${envVar.key}: ${envVar.description}`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function logEnvironmentStatus(options?: { failOnMissing?: boolean }): void {
  const result = validateEnvironment();
  const isDev = process.env.NODE_ENV === 'development';
  const shouldFail = options?.failOnMissing ?? !isDev;

  if (!result.valid) {
    console.error('\n========================================');
    console.error('[ENV] MISSING REQUIRED ENVIRONMENT VARIABLES:');
    console.error('========================================');
    result.missing.forEach((msg) => console.error(`  ✗ ${msg}`));
    console.error('========================================\n');

    if (shouldFail) {
      throw new Error(
        `Missing required environment variables: ${result.missing.map(m => m.split(':')[0]).join(', ')}`
      );
    } else {
      console.error('[ENV] Continuing in development mode - some features will not work.\n');
    }
  }

  if (result.warnings.length > 0 && isDev) {
    console.warn('\n[ENV] Optional environment variables not set:');
    result.warnings.forEach((msg) => console.warn(`  - ${msg}`));
    console.warn('[ENV] Some features may be unavailable.\n');
  }

  if (result.valid) {
    console.log('[ENV] All required environment variables are set');
  }
}

export function requireEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

const ALLOWED_DEV_SUPABASE_REFS = [
  'ljodxvfbgukrbchpibxa', // Development/staging project
];

export class DevOnlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DevOnlyError';
  }
}

export function assertDevOnly(context?: string): void {
  const nodeEnv = process.env.NODE_ENV;
  const allowSeeding = process.env.ALLOW_SEEDING;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  
  const supabaseRef = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase/)?.[1] || '';
  const isAllowedProject = ALLOWED_DEV_SUPABASE_REFS.includes(supabaseRef);
  
  const isDevMode = nodeEnv === 'development';
  const isSeedingAllowed = allowSeeding === 'YES';
  
  if (!isDevMode || !isSeedingAllowed || !isAllowedProject) {
    const reason = !isDevMode 
      ? 'NODE_ENV is not development' 
      : !isSeedingAllowed 
        ? 'ALLOW_SEEDING is not YES' 
        : `Supabase project ${supabaseRef} is not in allowlist`;
    
    console.error(`[SECURITY] Dev-only access denied: ${reason}. Context: ${context || 'unknown'}`);
    throw new DevOnlyError(`Dev-only operation blocked: ${reason}`);
  }
  
  console.log(`[DEV] Dev-only access granted. Context: ${context || 'unknown'}`);
}

export function isDevEnvironment(): boolean {
  try {
    assertDevOnly('environment-check');
    return true;
  } catch {
    return false;
  }
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}
