import { db, dataAccessLog } from '@openhouse/db';
import { headers } from 'next/headers';

export type DataAccessAction = 
  | 'viewed_chat_analytics'
  | 'viewed_chat_history'
  | 'viewed_message_details'
  | 'viewed_unit_messages'
  | 'exported_data'
  | 'viewed_purchaser_details'
  | 'viewed_pipeline_data';

export type ResourceType =
  | 'development_messages'
  | 'unit_messages'
  | 'message'
  | 'purchaser'
  | 'pipeline_export'
  | 'analytics_data';

interface LogDataAccessParams {
  accessorId: string;
  accessorEmail?: string;
  accessorRole?: string;
  tenantId?: string;
  action: DataAccessAction;
  resourceType: ResourceType;
  resourceId?: string;
  resourceDescription?: string;
}

export async function logDataAccess(params: LogDataAccessParams): Promise<void> {
  try {
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

    await db.insert(dataAccessLog).values({
      tenant_id: params.tenantId || null,
      accessor_id: params.accessorId,
      accessor_email: params.accessorEmail || null,
      accessor_role: params.accessorRole || null,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId || null,
      resource_description: params.resourceDescription || null,
      ip_address: ipAddress,
    });
  } catch (error) {
    console.error('[GDPR Audit] Failed to log data access:', error);
  }
}
