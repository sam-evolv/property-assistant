import { startCleanupWorker } from './cleanup-worker';
import { initializeJobQueue } from './job-queue';

let initialized = false;

export function initializeApiInfrastructure(): void {
  if (initialized) {
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME) {
    startCleanupWorker(5);
    initializeJobQueue();
    initialized = true;
  }
}

initializeApiInfrastructure();
