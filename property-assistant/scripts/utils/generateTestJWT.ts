import { signHomeownerJWT } from '../../apps/tenant-portal/server/lib/jwt';

/**
 * PHASE 17.2: Test JWT Generator
 * Generate valid homeowner JWTs for load testing
 */

export interface TestJWTPayload {
  tenant_id: string;
  development_id: string;
  house_id: string;
  house_type: string | null;
}

/**
 * Generate a test JWT for a homeowner
 * Uses the same signing logic as production
 * 
 * @param payload - Homeowner context
 * @returns JWT token valid for 24 hours
 */
export async function generateTestJWT(payload: TestJWTPayload): Promise<string> {
  return signHomeownerJWT(payload);
}

/**
 * Generate multiple test JWTs for load testing
 * 
 * @param houses - Array of house data
 * @returns Map of house_id -> JWT token
 */
export async function generateTestJWTBatch(
  houses: Array<TestJWTPayload>
): Promise<Map<string, string>> {
  const jwtMap = new Map<string, string>();

  for (const house of houses) {
    const token = await generateTestJWT(house);
    jwtMap.set(house.house_id, token);
  }

  return jwtMap;
}
