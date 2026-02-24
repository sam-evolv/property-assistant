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

  // Try exact match first
  const { data } = await supabase
    .from('units')
    .select('id, address, development_id')
    .eq('development_id', developmentId)
    .eq('address', normalized)
    .single();

  if (data) return data;

  // Try case-insensitive / fuzzy match
  const { data: fuzzyData } = await supabase
    .from('units')
    .select('id, address, development_id')
    .eq('development_id', developmentId)
    .ilike('address', `%${normalized}%`)
    .limit(1)
    .single();

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
    m => m.oh_table === 'units' && m.oh_field === 'address'
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
