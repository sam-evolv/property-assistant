export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeApiInfrastructure } = await import('@openhouse/api/init');
    initializeApiInfrastructure();
  }
}
