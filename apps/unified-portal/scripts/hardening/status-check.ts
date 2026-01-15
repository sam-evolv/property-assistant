#!/usr/bin/env npx tsx
/**
 * Status Check Wrapper
 * 
 * This file is a wrapper that executes the canonical status check script.
 * The canonical implementation is at: scripts/hardening/status-check.ts
 * 
 * Usage:
 *   npx tsx scripts/hardening/status-check.ts
 *   (or from this directory: npx tsx status-check.ts)
 */

import { execSync } from 'child_process';
import * as path from 'path';

const canonicalPath = path.join(__dirname, '..', '..', '..', '..', 'scripts', 'hardening', 'status-check.ts');

console.log('Redirecting to canonical status check...');
console.log(`Path: ${canonicalPath}\n`);

try {
  execSync(`npx tsx "${canonicalPath}"`, { 
    stdio: 'inherit',
    env: process.env,
  });
} catch (error: any) {
  process.exit(error.status || 1);
}
