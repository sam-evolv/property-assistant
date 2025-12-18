export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { logEnvironmentStatus } = await import('./lib/env-validation');
    logEnvironmentStatus();

    const { initializeApiInfrastructure } = await import('@openhouse/api/init');
    initializeApiInfrastructure();
  }
}
