#!/usr/bin/env tsx
/**
 * Local entry point for the atomic OpenHouse migration runner.
 * Loads the unified portal's .env.local, then delegates to the canonical
 * PostgreSQL runner at the repository root.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { runMigrations } from '../../../scripts/run-migrations';

config({ path: resolve(__dirname, '../.env.local') });

runMigrations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
