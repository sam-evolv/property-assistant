/**
 * Microsoft Graph Webhook Listener
 *
 * POST /api/integrations/webhooks/microsoft
 *
 * Receives change notifications from Microsoft Graph when
 * connected Excel/SharePoint files are modified.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncInbound, getFieldMappings } from '@/lib/integrations/sync-engine';
import { decryptCredentials } from '@/lib/integrations/security/token-encryption';
import { logAudit } from '@/lib/integrations/security/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Microsoft Graph validation handshake
    if (body.validationToken) {
      return new Response(body.validationToken, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const supabase = getSupabaseAdmin();

    // Process change notifications
    for (const notification of body.value || []) {
      try {
        // Find integration by subscription ID stored in external_ref metadata
        const { data: integrations } = await supabase
          .from('integrations')
          .select('*')
          .in('type', ['excel_onedrive', 'excel_sharepoint'])
          .eq('status', 'connected');

        // Match by decrypting credentials to find matching subscription ID
        const integration = integrations?.find(i => {
          try {
            if (!i.credentials || i.credentials === '{}') return false;
            const creds = decryptCredentials(i.tenant_id, i.credentials);
            return creds.subscription_id === notification.subscriptionId;
          } catch {
            return false;
          }
        });

        if (!integration) {
          console.warn('[MS Webhook] No integration found for subscription:', notification.subscriptionId);
          continue;
        }

        // Decrypt credentials
        const credentials = decryptCredentials(integration.tenant_id, integration.credentials);

        // Read changed data from spreadsheet
        const response = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${integration.external_ref}/workbook/worksheets/Sheet1/usedRange`,
          {
            headers: { Authorization: `Bearer ${credentials.access_token}` },
          }
        );

        if (!response.ok) {
          console.error('[MS Webhook] Failed to read spreadsheet:', response.status);
          continue;
        }

        const rangeData = await response.json();
        const rows = rangeData.values || [];

        if (rows.length < 2) continue;

        // Convert to row objects using headers
        const headers = rows[0] as string[];
        const dataRows = rows.slice(1).map((row: any[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });

        // Get field mappings and trigger sync
        const fieldMappings = await getFieldMappings(integration.id);

        await syncInbound(
          {
            integration,
            fieldMappings,
            direction: 'inbound',
          },
          dataRows
        );

        await logAudit(integration.tenant_id, 'sync.webhook_triggered', 'system', {
          integration_id: integration.id,
          notification_type: notification.changeType,
          rows_received: dataRows.length,
        });
      } catch (err: any) {
        console.error('[MS Webhook] Error processing notification:', err);
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('[MS Webhook] Error:', error);
    return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
