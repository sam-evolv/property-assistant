import { execSync } from 'child_process';

let cachedVersion: string | null = null;

export function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    cachedVersion = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    cachedVersion = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 
                    process.env.COMMIT_SHA?.substring(0, 7) || 
                    'unknown';
  }

  return cachedVersion;
}

export function getBuildInfo(): { version: string; nodeVersion: string; buildTime: string } {
  return {
    version: getVersion(),
    nodeVersion: process.version,
    buildTime: new Date().toISOString(),
  };
}
