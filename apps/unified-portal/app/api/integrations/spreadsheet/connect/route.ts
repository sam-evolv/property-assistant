/**
 * Spreadsheet Connection
 *
 * POST /api/integrations/spreadsheet/connect
 *
 * Step 1: User provides spreadsheet info (after OAuth)
 * Step 2: System reads column headers from the spreadsheet
 * Step 3: Smart mapping engine suggests field mappings
 * Step 4: User confirms -> integration is created -> sync begins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { suggestMappings, getAvailableTargetFields } from '@/lib/integrations/column-mapper';
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

interface ConnectRequest {
  integration_id: string;
  spreadsheet_url?: string;
  sheet_name?: string;
}

interface ConfirmMappingsRequest {
  integration_id: string;
  mappings: Array<{
    external_field: string;
    external_field_label: string;
    oh_table: string;
    oh_field: string;
    direction: string;
    transform_rule?: any;
  }>;
  sync_direction: string;
  sync_frequency: string;
}

/**
 * POST — Analyze spreadsheet and suggest mappings, or confirm mappings.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const tenantId = session.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // If mappings are provided, this is a confirmation step
    if (body.mappings) {
      return handleConfirmMappings(supabase, tenantId, session.id, body as ConfirmMappingsRequest);
    }

    // Otherwise, analyze the spreadsheet
    return handleAnalyzeSpreadsheet(supabase, tenantId, body as ConnectRequest);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Spreadsheet Connect] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleAnalyzeSpreadsheet(
  supabase: any,
  tenantId: string,
  body: ConnectRequest
) {
  const { integration_id, spreadsheet_url, sheet_name } = body;

  if (!integration_id) {
    return NextResponse.json({ error: 'integration_id is required' }, { status: 400 });
  }

  // Fetch integration
  const { data: integration } = await supabase
    .from('integrations')
    .select('*')
    .eq('id', integration_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!integration) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
  }

  // Update external ref if provided
  if (spreadsheet_url) {
    await supabase
      .from('integrations')
      .update({ external_ref: spreadsheet_url })
      .eq('id', integration_id);
  }

  // Get credentials
  let credentials;
  try {
    credentials = decryptCredentials(tenantId, integration.credentials);
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials. Please reconnect.' }, { status: 400 });
  }

  // Read headers from the spreadsheet based on type
  let headers: string[] = [];
  let sampleData: string[][] = [];

  try {
    if (integration.type === 'google_sheets') {
      const result = await readGoogleSheetsHeaders(credentials.access_token, spreadsheet_url || integration.external_ref, sheet_name);
      headers = result.headers;
      sampleData = result.sampleData;
    } else {
      // Microsoft Graph (OneDrive/SharePoint)
      const result = await readMicrosoftExcelHeaders(credentials.access_token, integration.external_ref);
      headers = result.headers;
      sampleData = result.sampleData;
    }
  } catch (err: any) {
    return NextResponse.json({
      error: 'Failed to read spreadsheet',
      details: err.message,
    }, { status: 400 });
  }

  // Suggest mappings
  const suggestions = suggestMappings(headers, sampleData);
  const targetFields = getAvailableTargetFields();

  return NextResponse.json({
    integration_id,
    columns_detected: suggestions,
    available_target_fields: targetFields,
  });
}

async function handleConfirmMappings(
  supabase: any,
  tenantId: string,
  userId: string,
  body: ConfirmMappingsRequest
) {
  const { integration_id, mappings, sync_direction, sync_frequency } = body;

  if (!integration_id || !mappings?.length) {
    return NextResponse.json({ error: 'integration_id and mappings are required' }, { status: 400 });
  }

  // Verify ownership
  const { data: integration } = await supabase
    .from('integrations')
    .select('id')
    .eq('id', integration_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!integration) {
    return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
  }

  // Save field mappings
  const mappingRecords = mappings.map(m => ({
    integration_id,
    external_field: m.external_field,
    external_field_label: m.external_field_label,
    oh_table: m.oh_table,
    oh_field: m.oh_field,
    direction: m.direction || 'bidirectional',
    transform_rule: m.transform_rule || null,
    is_active: true,
  }));

  const { error: mappingError } = await supabase
    .from('integration_field_mappings')
    .insert(mappingRecords);

  if (mappingError) {
    console.error('[Spreadsheet Connect] Mapping insert error:', mappingError);
    return NextResponse.json({ error: 'Failed to save mappings' }, { status: 500 });
  }

  // Update integration settings
  await supabase
    .from('integrations')
    .update({
      status: 'connected',
      sync_direction: sync_direction || 'bidirectional',
      sync_frequency: sync_frequency || 'realtime',
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration_id);

  await logAudit(tenantId, 'integration.mappings_confirmed', 'user', {
    actor_id: userId,
    resource_type: 'integration',
    resource_id: integration_id,
    mappings_count: mappings.length,
  });

  return NextResponse.json({
    success: true,
    integration_id,
    mappings_saved: mappings.length,
    message: 'Spreadsheet connected! Sync will begin shortly.',
  });
}

// --- Spreadsheet Reading Helpers ---

async function readGoogleSheetsHeaders(
  accessToken: string,
  spreadsheetUrl: string | null,
  sheetName?: string | null
): Promise<{ headers: string[]; sampleData: string[][] }> {
  if (!spreadsheetUrl) throw new Error('Spreadsheet URL is required');

  // Extract spreadsheet ID from URL
  const match = spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error('Invalid Google Sheets URL');
  const spreadsheetId = match[1];

  const range = sheetName ? `'${sheetName}'!1:5` : 'Sheet1!1:5';

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Google Sheets API error: ${response.status}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  if (rows.length === 0) throw new Error('Spreadsheet appears to be empty');

  const headers = rows[0].map((h: any) => String(h).trim());
  const sampleData: string[][] = headers.map((_: any, colIdx: number) =>
    rows.slice(1).map((row: any[]) => String(row[colIdx] || ''))
  );

  return { headers, sampleData };
}

async function readMicrosoftExcelHeaders(
  accessToken: string,
  externalRef: string | null
): Promise<{ headers: string[]; sampleData: string[][] }> {
  if (!externalRef) throw new Error('Excel file reference is required');

  // Read first 5 rows from the first worksheet
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${externalRef}/workbook/worksheets/Sheet1/range(address='A1:Z5')`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Microsoft Graph API error: ${response.status}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  if (rows.length === 0) throw new Error('Spreadsheet appears to be empty');

  // Filter out empty columns
  const headers: string[] = [];
  const validCols: number[] = [];

  (rows[0] as any[]).forEach((h: any, idx: number) => {
    const val = String(h || '').trim();
    if (val) {
      headers.push(val);
      validCols.push(idx);
    }
  });

  const sampleData: string[][] = validCols.map(colIdx =>
    rows.slice(1).map((row: any[]) => String(row[colIdx] || ''))
  );

  return { headers, sampleData };
}

/**
 * GET — List available target fields for mapping UI.
 */
export async function GET() {
  try {
    await requireRole(['developer', 'admin', 'super_admin']);
    return NextResponse.json({ target_fields: getAvailableTargetFields() });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
