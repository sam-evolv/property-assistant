/**
 * Build Info - Phase 0 Deployment Verification
 * Provides commit hash and build time for debugging deployments
 */

export const BUILD_INFO = {
  commitHash: process.env.REPLIT_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  buildTime: process.env.BUILD_TIME || new Date().toISOString(),
  nodeEnv: process.env.NODE_ENV || 'development',
  version: '2.0.0-branding-fix',
};

export function getBuildInfoString(): string {
  return `OpenHouse v${BUILD_INFO.version} | ${BUILD_INFO.commitHash.substring(0, 7)} | ${BUILD_INFO.buildTime}`;
}
