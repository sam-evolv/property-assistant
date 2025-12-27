let criticalErrorCount = 0;
let lastResetTime = Date.now();

const BUILD_HASH = process.env.REPL_ID?.slice(0, 8) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || 'dev';
const DEPLOYED_AT = process.env.REPL_SLUG ? new Date().toISOString() : (process.env.VERCEL_GIT_COMMIT_DATE || new Date().toISOString());
const APP_VERSION = process.env.npm_package_version || '0.1.0';

let deployedAtTimestamp: string | null = null;

export function getDeployedAt(): string {
  if (!deployedAtTimestamp) {
    deployedAtTimestamp = new Date().toISOString();
  }
  return deployedAtTimestamp;
}

export function getBuildInfo() {
  return {
    version: APP_VERSION,
    buildHash: BUILD_HASH,
    deployedAt: getDeployedAt(),
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

export function incrementCriticalError(): void {
  criticalErrorCount++;
  console.error(`[CRITICAL ERROR] Count incremented to ${criticalErrorCount}`);
}

export function getCriticalErrorCount(): number {
  return criticalErrorCount;
}

export function getErrorCountSinceReset(): { count: number; resetTime: string } {
  return {
    count: criticalErrorCount,
    resetTime: new Date(lastResetTime).toISOString(),
  };
}

export function resetCriticalErrorCount(): void {
  criticalErrorCount = 0;
  lastResetTime = Date.now();
}

export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - lastResetTime) / 1000);
}
