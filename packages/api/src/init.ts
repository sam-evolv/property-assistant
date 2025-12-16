let initialized = false;

export async function initializeApiInfrastructure(): Promise<void> {
  if (initialized) {
    return;
  }

  // Only start background workers when explicitly opted in via RUN_INFRA=1
  // This prevents crashes during Next.js dev/build phases
  const shouldRunInfra = process.env.RUN_INFRA === '1' || process.env.RUN_INFRA === 'true';
  const isNodeRuntime = process.env.NEXT_RUNTIME === 'nodejs' || !process.env.NEXT_RUNTIME;
  
  if (shouldRunInfra && isNodeRuntime) {
    try {
      // Use dynamic imports to avoid loading db client until needed
      const { startCleanupWorker } = await import('./cleanup-worker');
      const { initializeJobQueue } = await import('./job-queue');
      startCleanupWorker(5);
      initializeJobQueue();
      initialized = true;
    } catch (error) {
      console.error('[API Init] Failed to start infrastructure:', error);
      // Don't throw - allow the app to continue without background workers
    }
  }
}

// Auto-initialize only when RUN_INFRA is explicitly set
if (process.env.RUN_INFRA === '1' || process.env.RUN_INFRA === 'true') {
  initializeApiInfrastructure();
}
