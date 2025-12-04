import { db } from '@openhouse/db/client';
import { developments, units, homeowners, documents } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export class OwnershipError extends Error {
  constructor(message: string, public code: 'FORBIDDEN' | 'NOT_FOUND' = 'FORBIDDEN') {
    super(message);
    this.name = 'OwnershipError';
  }
}

export async function validateDevelopmentOwnership(
  developmentId: string,
  tenantId: string
): Promise<void> {
  const development = await db.query.developments.findFirst({
    where: and(
      eq(developments.id, developmentId),
      eq(developments.tenant_id, tenantId)
    ),
    columns: { id: true },
  });

  if (!development) {
    throw new OwnershipError(
      `Development ${developmentId} does not belong to tenant ${tenantId}`,
      'NOT_FOUND'
    );
  }
}

export async function validateUnitOwnership(
  unitId: string,
  tenantId: string
): Promise<void> {
  const unit = await db.query.units.findFirst({
    where: and(
      eq(units.id, unitId),
      eq(units.tenant_id, tenantId)
    ),
    columns: { id: true },
  });

  if (!unit) {
    throw new OwnershipError(
      `Unit ${unitId} does not belong to tenant ${tenantId}`,
      'NOT_FOUND'
    );
  }
}

export async function validateHomeownerOwnership(
  homeownerId: string,
  tenantId: string
): Promise<void> {
  const homeowner = await db.query.homeowners.findFirst({
    where: and(
      eq(homeowners.id, homeownerId),
      eq(homeowners.tenant_id, tenantId)
    ),
    columns: { id: true },
  });

  if (!homeowner) {
    throw new OwnershipError(
      `Homeowner ${homeownerId} does not belong to tenant ${tenantId}`,
      'NOT_FOUND'
    );
  }
}

export async function validateDocumentOwnership(
  documentId: string,
  tenantId: string
): Promise<void> {
  const document = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, documentId),
      eq(documents.tenant_id, tenantId)
    ),
    columns: { id: true },
  });

  if (!document) {
    throw new OwnershipError(
      `Document ${documentId} does not belong to tenant ${tenantId}`,
      'NOT_FOUND'
    );
  }
}

export async function validateMultipleOwnership(
  resources: Array<{ type: 'development' | 'unit' | 'homeowner' | 'document'; id: string }>,
  tenantId: string
): Promise<void> {
  const validators = {
    development: validateDevelopmentOwnership,
    unit: validateUnitOwnership,
    homeowner: validateHomeownerOwnership,
    document: validateDocumentOwnership,
  };

  await Promise.all(
    resources.map((resource) => validators[resource.type](resource.id, tenantId))
  );
}
