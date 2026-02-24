/**
 * Sync Engine
 *
 * Core sync engine for bidirectional data flow between OpenHouse
 * and external systems (spreadsheets, CRMs).
 *
 * Called by:
 *   - Webhook handler (real-time from external changes)
 *   - Cron job (periodic full sync)
 *   - Supabase Realtime subscription (for OH -> external changes)
 */

import { createClient } from '@supabase/supabase-js';
import { logAudit } from './security/audit';
import { decryptCredentials } from './security/token-encryption';
import { MicrosoftGraphAdapter } from './adapters/microsoft-graph-adapter';
import { GoogleSheetsAdapter } from './adapters/google-sheets-adapter';
import { syncEnrichmentColumns } from './enrichment';
import type { CellUpdate } from './adapters/microsoft-graph-adapter';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface Integration {
  id: string;
  tenant_id: string;
  development_id: string | null;
  type: string;
  name: string;
  status: string;
  credentials: any;
  sync_direction: string;
  sync_frequency: string;
  external_ref: string | null;
  last_sync_at: string | null;
}

export interface FieldMapping {
  id: string;
  integration_id: string;
  external_field: string;
  external_field_label: string | null;
  oh_table: string;
  oh_field: string;
  direction: string;
  transform_rule: any;
  is_active: boolean;
}

export interface ExternalRow {
  [key: string]: any;
}

export interface ChangeEvent {
  table: string;
  field: string;
  record_id: string;
  unit_identifier: string;
  old_value: any;
  new_value: any;
}

export interface SyncContext {
  integration: Integration;
  fieldMappings: FieldMapping[];
  direction: 'inbound' | 'outbound';
}

export interface SyncResult {
  syncLogId: string;
  status: 'completed' | 'failed' | 'partial';
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsErrored: number;
  conflictsDetected: number;
}

export async function createSyncLog(
  integrationId: string,
  syncType: 'full' | 'incremental' | 'manual',
  direction: 'inbound' | 'outbound'
) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('integration_sync_log')
    .insert({
      integration_id: integrationId,
      sync_type: syncType,
      direction,
      status: 'started',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeSyncLog(
  syncLogId: string,
  status: 'completed' | 'failed' | 'partial',
  errorMessage?: string,
  stats?: Partial<{
    records_processed: number;
    records_created: number;
    records_updated: number;
    records_skipped: number;
    records_errored: number;
  }>
) {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('integration_sync_log')
    .update({
      status,
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      duration_ms: undefined, // Computed server-side if needed
      ...stats,
    })
    .eq('id', syncLogId);
}

export async function getFieldMappings(integrationId: string): Promise<FieldMapping[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('integration_field_mappings')
    .select('*')
    .eq('integration_id', integrationId)
    .eq('is_active', true);

  if (error) throw error;
  return data || [];
}

/**
 * Transform a value using a mapping's transform rule.
 */
export function transformValue(value: any, transformRule: any): any {
  if (!transformRule || !value) return value;

  switch (transformRule.type) {
    case 'map':
      // Map specific values, e.g., {"Sold": "sale_agreed"}
      return transformRule.values?.[value] ?? value;

    case 'date':
      // Parse date from various formats
      try {
        const date = new Date(value);
        return isNaN(date.getTime()) ? value : date.toISOString();
      } catch {
        return value;
      }

    case 'currency':
      // Strip currency symbols and parse as number
      if (typeof value === 'string') {
        return parseFloat(value.replace(/[^0-9.-]/g, '')) || value;
      }
      return value;

    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;

    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;

    default:
      return value;
  }
}

/**
 * Find a unit in a development by its identifier (address/number).
 */
export async function findUnit(developmentId: string | null, unitIdentifier: string) {
  if (!developmentId || !unitIdentifier) return null;

  const supabase = getSupabaseAdmin();
  const normalized = unitIdentifier.toString().trim();

  // Try exact match on address_line_1 first
  const { data } = await supabase
    .from('units')
    .select('id, address_line_1, unit_number, development_id')
    .eq('development_id', developmentId)
    .eq('address_line_1', normalized)
    .limit(1)
    .maybeSingle();

  if (data) return data;

  // Try unit_number exact match
  const { data: byNumber } = await supabase
    .from('units')
    .select('id, address_line_1, unit_number, development_id')
    .eq('development_id', developmentId)
    .eq('unit_number', normalized)
    .limit(1)
    .maybeSingle();

  if (byNumber) return byNumber;

  // Try case-insensitive / fuzzy match on address
  const { data: fuzzyData } = await supabase
    .from('units')
    .select('id, address_line_1, unit_number, development_id')
    .eq('development_id', developmentId)
    .ilike('address_line_1', `%${normalized}%`)
    .limit(1)
    .maybeSingle();

  return fuzzyData || null;
}

/**
 * Extract the unit identifier from an external row based on field mappings.
 */
export function extractUnitIdentifier(
  row: ExternalRow,
  fieldMappings: FieldMapping[]
): string | null {
  const unitMapping = fieldMappings.find(
    m => m.oh_table === 'units' && (m.oh_field === 'address_line_1' || m.oh_field === 'address' || m.oh_field === 'unit_number')
  );

  if (!unitMapping) return null;
  return row[unitMapping.external_field]?.toString() || null;
}

/**
 * Inbound sync: external data -> OpenHouse.
 */
export async function syncInbound(
  ctx: SyncContext,
  externalData: ExternalRow[]
): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();
  const syncLog = await createSyncLog(ctx.integration.id, 'incremental', 'inbound');

  const stats = {
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    records_errored: 0,
  };
  let conflictsDetected = 0;

  try {
    for (const row of externalData) {
      stats.records_processed++;

      // Find matching OH record by unit address/number
      const unitIdentifier = extractUnitIdentifier(row, ctx.fieldMappings);
      if (!unitIdentifier) {
        stats.records_skipped++;
        continue;
      }

      const unit = await findUnit(ctx.integration.development_id, unitIdentifier);
      if (!unit) {
        stats.records_skipped++;
        continue;
      }

      // For each mapped field, compare and update
      for (const mapping of ctx.fieldMappings) {
        if (mapping.direction === 'outbound') continue;
        if (mapping.oh_table === 'units' && mapping.oh_field === 'address') continue;

        const externalValue = transformValue(
          row[mapping.external_field],
          mapping.transform_rule
        );

        if (externalValue === null || externalValue === undefined) continue;

        // Get current local value
        const { data: localRecord } = await supabase
          .from(mapping.oh_table)
          .select(mapping.oh_field)
          .eq(mapping.oh_table === 'units' ? 'id' : 'unit_id', unit.id)
          .single();

        const localValue = (localRecord as Record<string, any>)?.[mapping.oh_field];

        if (String(externalValue) !== String(localValue)) {
          // Check for conflict (local was also modified since last sync)
          const lastSync = ctx.integration.last_sync_at;
          let hasConflict = false;

          if (lastSync && localValue !== null && localValue !== undefined) {
            // Simple conflict detection: if local value differs from what we'd expect
            hasConflict = true;
          }

          if (hasConflict && localValue) {
            // Create conflict for user resolution
            await supabase.from('integration_conflicts').insert({
              integration_id: ctx.integration.id,
              sync_log_id: syncLog.id,
              oh_table: mapping.oh_table,
              oh_record_id: unit.id,
              oh_field: mapping.oh_field,
              local_value: String(localValue),
              remote_value: String(externalValue),
            });
            conflictsDetected++;
          } else {
            // No conflict — apply the update
            const updateData: Record<string, any> = {
              [mapping.oh_field]: externalValue,
            };

            await supabase
              .from(mapping.oh_table)
              .update(updateData)
              .eq(mapping.oh_table === 'units' ? 'id' : 'unit_id', unit.id);

            stats.records_updated++;

            await logAudit(ctx.integration.tenant_id, 'sync.field_updated', 'system', {
              integration_id: ctx.integration.id,
              table: mapping.oh_table,
              field: mapping.oh_field,
              unit_id: unit.id,
              old_value: localValue,
              new_value: externalValue,
            });
          }
        }
      }
    }

    const finalStatus: 'completed' | 'partial' = conflictsDetected > 0 ? 'partial' : 'completed';
    await completeSyncLog(syncLog.id, finalStatus, undefined, stats);

    // Update integration last_sync_at
    await supabase
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.integration.id);

    // After successful inbound sync, refresh enrichment columns
    // (fire-and-forget — enrichment failure shouldn't block the sync result)
    syncEnrichmentColumns(ctx.integration).catch(err => {
      console.error('[Sync] Enrichment column refresh failed:', err.message);
    });

    return {
      syncLogId: syncLog.id,
      status: finalStatus,
      recordsProcessed: stats.records_processed,
      recordsCreated: stats.records_created,
      recordsUpdated: stats.records_updated,
      recordsSkipped: stats.records_skipped,
      recordsErrored: stats.records_errored,
      conflictsDetected,
    };
  } catch (error: any) {
    await completeSyncLog(syncLog.id, 'failed', error.message, stats);
    throw error;
  }
}

// ─── Outbound Sync ────────────────────────────────────────────────────────

/**
 * Outbound sync: OpenHouse changes -> external system.
 *
 * Called when a record is updated in OpenHouse (via API or dashboard)
 * to push changes back to the connected spreadsheet or CRM.
 */
export async function syncOutbound(
  ctx: SyncContext,
  changes: ChangeEvent[]
): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();
  const syncLog = await createSyncLog(ctx.integration.id, 'incremental', 'outbound');

  const stats = {
    records_processed: 0,
    records_created: 0,
    records_updated: 0,
    records_skipped: 0,
    records_errored: 0,
  };

  try {
    // Group outbound-eligible mappings by table+field
    const outboundMappings = ctx.fieldMappings.filter(
      m => m.direction === 'outbound' || m.direction === 'bidirectional'
    );

    if (outboundMappings.length === 0) {
      await completeSyncLog(syncLog.id, 'completed', undefined, stats);
      return {
        syncLogId: syncLog.id,
        status: 'completed',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        recordsErrored: 0,
        conflictsDetected: 0,
      };
    }

    const isSpreadsheet = ['excel_onedrive', 'excel_sharepoint', 'google_sheets'].includes(ctx.integration.type);

    if (isSpreadsheet) {
      await syncOutboundSpreadsheet(ctx, changes, outboundMappings, stats);
    } else {
      await syncOutboundCRM(ctx, changes, outboundMappings, stats);
    }

    const finalStatus: 'completed' | 'partial' = stats.records_errored > 0 ? 'partial' : 'completed';
    await completeSyncLog(syncLog.id, finalStatus, undefined, stats);

    await supabase
      .from('integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.integration.id);

    return {
      syncLogId: syncLog.id,
      status: finalStatus,
      recordsProcessed: stats.records_processed,
      recordsCreated: stats.records_created,
      recordsUpdated: stats.records_updated,
      recordsSkipped: stats.records_skipped,
      recordsErrored: stats.records_errored,
      conflictsDetected: 0,
    };
  } catch (error: any) {
    await completeSyncLog(syncLog.id, 'failed', error.message, stats);
    throw error;
  }
}

async function syncOutboundSpreadsheet(
  ctx: SyncContext,
  changes: ChangeEvent[],
  outboundMappings: FieldMapping[],
  stats: { records_processed: number; records_updated: number; records_skipped: number; records_errored: number; records_created: number }
) {
  if (!ctx.integration.external_ref) {
    stats.records_skipped += changes.length;
    return;
  }

  let credentials: any;
  try {
    credentials = decryptCredentials(ctx.integration.tenant_id, ctx.integration.credentials);
  } catch {
    throw new Error('Failed to decrypt integration credentials');
  }

  // Get the appropriate adapter
  const isGoogle = ctx.integration.type === 'google_sheets';
  const adapter = isGoogle ? new GoogleSheetsAdapter() : new MicrosoftGraphAdapter();
  adapter.setAccessToken(credentials.access_token);

  // Read current spreadsheet data to find row indices
  const rows = isGoogle
    ? await (adapter as GoogleSheetsAdapter).getRows(ctx.integration.external_ref)
    : await (adapter as MicrosoftGraphAdapter).getRows(ctx.integration.external_ref);

  const headers = isGoogle
    ? await (adapter as GoogleSheetsAdapter).getHeaders(ctx.integration.external_ref)
    : await (adapter as MicrosoftGraphAdapter).getHeaders(ctx.integration.external_ref);

  // Build a map of unit identifier -> row index (0-based data rows, +2 for 1-based + header)
  const addressMapping = outboundMappings.find(
    m => m.oh_table === 'units' && (m.oh_field === 'address_line_1' || m.oh_field === 'address' || m.oh_field === 'unit_number')
  );

  const updates: CellUpdate[] = [];

  for (const change of changes) {
    stats.records_processed++;

    // Find the field mapping for this change
    const mapping = outboundMappings.find(
      m => m.oh_table === change.table && m.oh_field === change.field
    );

    if (!mapping) {
      stats.records_skipped++;
      continue;
    }

    // Find the column index for the external field
    const colIndex = headers.indexOf(mapping.external_field);
    if (colIndex === -1) {
      stats.records_skipped++;
      continue;
    }

    // Find the row by matching unit identifier
    let rowIndex = -1;
    if (addressMapping) {
      const extField = addressMapping.external_field;
      rowIndex = rows.findIndex(r => {
        const val = String(r[extField] || '').trim().toLowerCase();
        return val === change.unit_identifier.trim().toLowerCase();
      });
    }

    if (rowIndex === -1) {
      stats.records_skipped++;
      continue;
    }

    updates.push({
      row: rowIndex + 1, // +1 because row 0 in data = row 2 in sheet (after header)
      col: colIndex,
      value: change.new_value ?? '',
    });
  }

  if (updates.length > 0) {
    const sheetName = 'Sheet1'; // Default sheet name
    if (isGoogle) {
      await (adapter as GoogleSheetsAdapter).batchUpdate(ctx.integration.external_ref, sheetName, updates);
    } else {
      await (adapter as MicrosoftGraphAdapter).batchUpdate(ctx.integration.external_ref, sheetName, updates);
    }
    stats.records_updated += updates.length;
  }

  await logAudit(ctx.integration.tenant_id, 'sync.outbound_completed', 'system', {
    integration_id: ctx.integration.id,
    updates_written: updates.length,
    total_changes: changes.length,
  });
}

async function syncOutboundCRM(
  ctx: SyncContext,
  changes: ChangeEvent[],
  outboundMappings: FieldMapping[],
  stats: { records_processed: number; records_updated: number; records_skipped: number; records_errored: number; records_created: number }
) {
  // CRM outbound sync uses the adapter pattern
  // The caller should instantiate the correct CRM adapter and call updateRecord
  // For now, group changes by table and build update payloads

  const supabase = getSupabaseAdmin();

  for (const change of changes) {
    stats.records_processed++;

    const mapping = outboundMappings.find(
      m => m.oh_table === change.table && m.oh_field === change.field
    );

    if (!mapping) {
      stats.records_skipped++;
      continue;
    }

    try {
      // For CRM sync, we need the external record ID stored in a reference mapping
      // This would typically be stored during inbound sync
      const { data: ref } = await supabase
        .from('integration_field_mappings')
        .select('external_field')
        .eq('integration_id', ctx.integration.id)
        .eq('oh_table', change.table)
        .eq('oh_field', 'id')
        .limit(1)
        .maybeSingle();

      if (!ref) {
        stats.records_skipped++;
        continue;
      }

      // Log that we need to push this change (actual CRM write depends on adapter)
      await logAudit(ctx.integration.tenant_id, 'sync.outbound_pending', 'system', {
        integration_id: ctx.integration.id,
        table: change.table,
        field: change.field,
        external_field: mapping.external_field,
        new_value: change.new_value,
      });

      stats.records_updated++;
    } catch (err: any) {
      stats.records_errored++;
      console.error('[Sync Outbound CRM] Error:', err.message);
    }
  }
}

// ─── Trigger Helper ───────────────────────────────────────────────────────

/**
 * Trigger outbound sync for a record mutation.
 *
 * Call this from any API route that mutates data in OpenHouse
 * to push changes back to connected external systems.
 *
 * This is fire-and-forget — errors are logged but don't block the caller.
 */
export async function triggerOutboundSync(
  developmentId: string,
  table: string,
  recordId: string,
  changedFields: Record<string, { old_value: any; new_value: any }>,
  unitIdentifier?: string
): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    // Find active integrations for this development with outbound/bidirectional sync
    const { data: integrations } = await supabase
      .from('integrations')
      .select('*')
      .eq('development_id', developmentId)
      .in('status', ['connected', 'syncing'])
      .in('sync_direction', ['outbound', 'bidirectional']);

    if (!integrations?.length) return;

    // Resolve the unit identifier if not provided
    let resolvedIdentifier = unitIdentifier || '';
    if (!resolvedIdentifier && table === 'units') {
      const { data: unit } = await supabase
        .from('units')
        .select('address_line_1, unit_number')
        .eq('id', recordId)
        .maybeSingle();
      resolvedIdentifier = unit?.address_line_1 || unit?.unit_number || '';
    }

    // Build change events
    const changes: ChangeEvent[] = Object.entries(changedFields).map(([field, values]) => ({
      table,
      field,
      record_id: recordId,
      unit_identifier: resolvedIdentifier,
      old_value: values.old_value,
      new_value: values.new_value,
    }));

    // Trigger outbound sync for each integration
    for (const integration of integrations) {
      try {
        const fieldMappings = await getFieldMappings(integration.id);

        await syncOutbound(
          { integration, fieldMappings, direction: 'outbound' },
          changes
        );
      } catch (err: any) {
        console.error(`[Outbound Sync] Error for integration ${integration.id}:`, err.message);
        await logAudit(integration.tenant_id, 'sync.outbound_failed', 'system', {
          integration_id: integration.id,
          error: err.message,
        });
      }
    }
  } catch (err: any) {
    // Fire-and-forget: don't throw
    console.error('[Outbound Sync] Trigger error:', err.message);
  }
}
