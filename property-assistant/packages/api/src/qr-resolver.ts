import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateQRToken, markTokenAsUsed } from './qr-tokens';

export interface ResolvedHouse {
  unit_id: string;
  house_type: string;
  house_address: string;
  development_id: string;
  tenant_id: string;
  unit_number: string;
  unit_uid: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  development: {
    id: string;
    name: string;
    address: string | null;
    tenant_id: string;
  } | null;
}

/**
 * Resolve a QR code token to house/unit information
 * This replaces the old resolveQRToHouse function with the new secure token system
 */
export async function resolveQRTokenToHouse(token: string): Promise<ResolvedHouse | null> {
  try {
    // Validate the token (checks signature, expiry, and database)
    const payload = await validateQRToken(token);
    
    if (!payload) {
      console.error('[QR Resolver] Invalid or expired token');
      return null;
    }
    
    // Look up the unit
    const unit = await db.query.units.findFirst({
      where: and(
        eq(units.id, payload.unitId),
        eq(units.tenant_id, payload.tenantId),
        eq(units.development_id, payload.developmentId)
      ),
    });
    
    if (!unit) {
      console.error('[QR Resolver] Unit not found for token payload');
      return null;
    }
    
    // Look up the development
    const development = await db.query.developments.findFirst({
      where: and(
        eq(developments.id, payload.developmentId),
        eq(developments.tenant_id, payload.tenantId)
      ),
    });
    
    if (!development) {
      console.error('[QR Resolver] Development not found for token payload');
      return null;
    }
    
    const result = {
      unit_id: unit.id,
      house_type: unit.house_type_code,
      house_address: unit.address_line_1,
      development_id: unit.development_id,
      tenant_id: unit.tenant_id,
      unit_number: unit.unit_number,
      unit_uid: unit.unit_uid,
      purchaser_name: unit.purchaser_name,
      purchaser_email: unit.purchaser_email,
      purchaser_phone: unit.purchaser_phone,
      development: {
        id: development.id,
        name: development.name,
        address: development.address,
        tenant_id: development.tenant_id,
      },
    };
    
    console.log(`[QR Resolver] Successfully resolved token for unit ${unit.unit_number} at ${development.name}`);
    
    return result;
  } catch (error) {
    console.error('[QR Resolver] Error resolving QR token:', error);
    return null;
  }
}

/**
 * Mark a token as used - MUST be called AFTER successful JWT generation and cookie setting
 * This should be called from the onboarding page after all auth steps complete
 */
export async function completeTokenUsage(token: string): Promise<boolean> {
  try {
    return await markTokenAsUsed(token);
  } catch (error) {
    console.error('[QR Resolver] Failed to mark token as used:', error);
    return false;
  }
}
