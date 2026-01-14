export class ProductionWriteBlockedError extends Error {
  constructor(operation: string) {
    super(`PRODUCTION WRITE BLOCKED: ${operation} is not allowed in production without ALLOW_PROD_SEED=true`);
    this.name = 'ProductionWriteBlockedError';
  }
}

export function requireProductionWriteAccess(operation: string): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const allowProdSeed = process.env.ALLOW_PROD_SEED === 'true';

  if (isProduction && !allowProdSeed) {
    console.error(`[PRODUCTION GUARD] BLOCKED: ${operation}`);
    console.error(`[PRODUCTION GUARD] To allow this operation, set ALLOW_PROD_SEED=true`);
    throw new ProductionWriteBlockedError(operation);
  }

  if (isProduction && allowProdSeed) {
    console.warn(`[PRODUCTION GUARD] WARNING: ${operation} allowed via ALLOW_PROD_SEED=true`);
  }
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function canWriteToProduction(): boolean {
  return !isProductionEnvironment() || process.env.ALLOW_PROD_SEED === 'true';
}
