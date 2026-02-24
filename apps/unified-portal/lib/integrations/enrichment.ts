/**
 * Enrichment Column Writer
 *
 * Writes OpenHouse-specific data back to developer spreadsheets
 * as new "OH:" prefixed columns. This gives developers data they've
 * never had before — app engagement, compliance status, AI insights.
 *
 * Called after every successful inbound sync to keep enrichment fresh.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logAudit } from './security/audit';
import { decryptCredentials } from './security/token-encryption';
import { MicrosoftGraphAdapter } from './adapters/microsoft-graph-adapter';
import { GoogleSheetsAdapter } from './adapters/google-sheets-adapter';
import type { CellUpdate } from './adapters/microsoft-graph-adapter';

function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface Integration {
  id: string;
  tenant_id: string;
  development_id: string | null;
  type: string;
  credentials: any;
  external_ref: string | null;
}

interface EnrichmentColumn {
  header: string;
  description: string;
  compute: (unitId: string, supabase: SupabaseClient) => Promise<string>;
}

const ENRICHMENT_COLUMNS: EnrichmentColumn[] = [
  {
    header: 'OH: App Active',
    description: 'Has the purchaser used the OpenHouse app?',
    compute: async (unitId: string, supabase: SupabaseClient) => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', unitId);
      return (count && count > 0) ? 'Yes' : 'No';
    },
  },
  {
    header: 'OH: Questions Asked',
    description: 'Number of AI assistant questions from this unit',
    compute: async (unitId: string, supabase: SupabaseClient) => {
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .eq('sender', 'user');
      return String(count || 0);
    },
  },
  {
    header: 'OH: Last Active',
    description: 'When the purchaser last used the portal',
    compute: async (unitId: string, supabase: SupabaseClient) => {
      const { data } = await supabase
        .from('messages')
        .select('created_at')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return 'Never';
      return new Date(data.created_at).toLocaleDateString('en-IE');
    },
  },
  {
    header: 'OH: Compliance %',
    description: 'Unit compliance document completion percentage',
    compute: async (unitId: string, supabase: SupabaseClient) => {
      // Get the development_id for this unit to find required document types
      const { data: unit } = await supabase
        .from('units')
        .select('development_id')
        .eq('id', unitId)
        .maybeSingle();

      if (!unit?.development_id) return 'N/A';

      const { count: total } = await supabase
        .from('compliance_document_types')
        .select('*', { count: 'exact', head: true })
        .eq('development_id', unit.development_id);

      const { count: uploaded } = await supabase
        .from('compliance_documents')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .in('status', ['uploaded', 'verified']);

      if (!total || total === 0) return 'N/A';
      return `${Math.round(((uploaded || 0) / total) * 100)}%`;
    },
  },
  {
    header: 'OH: Handover Ready',
    description: 'Whether all compliance items are complete',
    compute: async (unitId: string, supabase: SupabaseClient) => {
      const { data: unit } = await supabase
        .from('units')
        .select('development_id')
        .eq('id', unitId)
        .maybeSingle();

      if (!unit?.development_id) return 'N/A';

      const { count: total } = await supabase
        .from('compliance_document_types')
        .select('*', { count: 'exact', head: true })
        .eq('development_id', unit.development_id);

      const { count: uploaded } = await supabase
        .from('compliance_documents')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .in('status', ['uploaded', 'verified']);

      if (!total || total === 0) return 'N/A';
      return (uploaded || 0) >= total ? 'Yes' : 'No';
    },
  },
];

/**
 * Sync enrichment columns back to the connected spreadsheet.
 *
 * 1. Read current headers from the spreadsheet
 * 2. Add any missing OH: columns
 * 3. For each unit, compute enrichment values
 * 4. Batch-write all updates
 */
export async function syncEnrichmentColumns(integration: Integration): Promise<void> {
  if (!integration.external_ref || !integration.development_id) return;

  const isGoogle = integration.type === 'google_sheets';
  const isExcel = integration.type === 'excel_onedrive' || integration.type === 'excel_sharepoint';

  if (!isGoogle && !isExcel) return;

  const supabase = getSupabaseAdmin();

  let credentials: any;
  try {
    credentials = decryptCredentials(integration.tenant_id, integration.credentials);
  } catch {
    console.error('[Enrichment] Failed to decrypt credentials for integration:', integration.id);
    return;
  }

  // Get adapter
  const adapter = isGoogle ? new GoogleSheetsAdapter() : new MicrosoftGraphAdapter();
  adapter.setAccessToken(credentials.access_token);

  const sheetName = 'Sheet1';
  const fileId = integration.external_ref;

  try {
    // 1. Read current headers
    let headers: string[];
    if (isGoogle) {
      headers = await (adapter as GoogleSheetsAdapter).getHeaders(fileId, sheetName);
    } else {
      headers = await (adapter as MicrosoftGraphAdapter).getHeaders(fileId, sheetName);
    }

    // 2. Add any missing OH: columns
    for (const enrichment of ENRICHMENT_COLUMNS) {
      if (!headers.includes(enrichment.header)) {
        if (isGoogle) {
          await (adapter as GoogleSheetsAdapter).addColumn(fileId, sheetName, enrichment.header);
        } else {
          await (adapter as MicrosoftGraphAdapter).addColumn(fileId, sheetName, enrichment.header);
        }
        headers.push(enrichment.header);
      }
    }

    // 3. Get all units for this development
    const { data: units } = await supabase
      .from('units')
      .select('id, address_line_1, unit_number')
      .eq('development_id', integration.development_id)
      .order('address_line_1');

    if (!units?.length) return;

    // Read all spreadsheet rows to find unit → row mapping
    let rows: Record<string, any>[];
    if (isGoogle) {
      rows = await (adapter as GoogleSheetsAdapter).getRows(fileId, sheetName);
    } else {
      rows = await (adapter as MicrosoftGraphAdapter).getRows(fileId, sheetName);
    }

    // Find the address/unit number column to match rows to units
    const addressColumns = headers.filter(h =>
      /address|unit|plot|house|property/i.test(h) && !h.startsWith('OH:')
    );

    // 4. Compute and collect updates
    const updates: CellUpdate[] = [];
    let unitsEnriched = 0;

    for (const unit of units) {
      // Find row index matching this unit
      let rowIndex = -1;
      const unitMatch = unit.address_line_1?.toLowerCase() || unit.unit_number?.toLowerCase() || '';

      for (let i = 0; i < rows.length; i++) {
        for (const addrCol of addressColumns) {
          const cellVal = String(rows[i][addrCol] || '').toLowerCase().trim();
          if (cellVal && (cellVal === unitMatch || cellVal.includes(unitMatch) || unitMatch.includes(cellVal))) {
            rowIndex = i;
            break;
          }
        }
        if (rowIndex >= 0) break;
      }

      if (rowIndex === -1) continue;

      // Compute each enrichment value
      for (const enrichment of ENRICHMENT_COLUMNS) {
        const colIndex = headers.indexOf(enrichment.header);
        if (colIndex === -1) continue;

        try {
          const value = await enrichment.compute(unit.id, supabase);
          updates.push({
            row: rowIndex + 1, // +1 because row data is 0-based but sheet rows start at 2
            col: colIndex,
            value,
          });
        } catch (err: any) {
          console.error(`[Enrichment] Error computing ${enrichment.header} for unit ${unit.id}:`, err.message);
        }
      }

      unitsEnriched++;
    }

    // 5. Batch write all updates
    if (updates.length > 0) {
      if (isGoogle) {
        await (adapter as GoogleSheetsAdapter).batchUpdate(fileId, sheetName, updates);
      } else {
        await (adapter as MicrosoftGraphAdapter).batchUpdate(fileId, sheetName, updates);
      }
    }

    // 6. Log
    await logAudit(integration.tenant_id, 'enrichment.synced', 'system', {
      integration_id: integration.id,
      columns_updated: ENRICHMENT_COLUMNS.length,
      units_enriched: unitsEnriched,
      total_cell_updates: updates.length,
    });
  } catch (err: any) {
    console.error('[Enrichment] Error syncing enrichment columns:', err.message);
    await logAudit(integration.tenant_id, 'enrichment.failed', 'system', {
      integration_id: integration.id,
      error: err.message,
    });
  }
}

export { ENRICHMENT_COLUMNS };
