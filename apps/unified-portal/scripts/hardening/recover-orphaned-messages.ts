/**
 * Orphaned Message Recovery Script v2
 * 
 * This script finds chat messages with missing unit_id and attempts to recover
 * them using metadata fields (unitUid, schemeId, userId, etc.)
 * 
 * IMPORTANT: This version validates tenant consistency before applying fixes.
 * All proposed fixes are written to recovery_map table for audit before applying.
 * 
 * Usage:
 *   npx tsx scripts/hardening/recover-orphaned-messages.ts [--dry-run] [--apply]
 * 
 * Options:
 *   --dry-run  Only analyze and report, don't write to recovery_map
 *   --apply    Apply fixes from recovery_map that are in 'pending' status
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface OrphanedMessage {
  id: string;
  tenant_id: string;
  development_id: string | null;
  unit_id: string | null;
  house_id: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

interface RecoveryProposal {
  tenant_id: string;
  entity_id: string;
  original_data: OrphanedMessage;
  proposed_fix: {
    unit_id?: string;
    development_id?: string;
  };
  match_method: string;
  match_confidence: number;
}

interface RecoveryReport {
  total_orphaned: number;
  total_fixed: number;
  total_unknown: number;
  proposals: RecoveryProposal[];
  unknown_reasons: { id: string; reason: string }[];
}

async function findOrphanedMessages(): Promise<OrphanedMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, tenant_id, development_id, unit_id, house_id, metadata, created_at')
    .is('unit_id', null)
    .is('house_id', null);

  if (error) {
    throw new Error(`Failed to fetch orphaned messages: ${error.message}`);
  }

  return data || [];
}

async function findUnitByUid(unitUid: string): Promise<{ id: string; project_id: string; tenant_id: string } | null> {
  const { data, error } = await supabase
    .from('units')
    .select('id, project_id, tenant_id')
    .eq('unit_uid', unitUid)
    .single();

  if (error || !data) return null;
  return data;
}

async function findUnitByAddress(address: string, developmentId?: string): Promise<{ id: string; project_id: string; tenant_id: string } | null> {
  let query = supabase
    .from('units')
    .select('id, project_id, tenant_id')
    .ilike('address', `%${address}%`);

  if (developmentId) {
    query = query.eq('project_id', developmentId);
  }

  const { data, error } = await query.limit(1).single();
  if (error || !data) return null;
  return data;
}

async function validateDevelopmentTenant(developmentId: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('developments')
    .select('tenant_id')
    .eq('id', developmentId)
    .single();

  if (error || !data) return false;
  return data.tenant_id === tenantId;
}

async function proposeRecovery(message: OrphanedMessage): Promise<RecoveryProposal | null> {
  const metadata = message.metadata || {};
  
  // Method 1: Check for unitUid in metadata
  if (metadata.unitUid) {
    const unit = await findUnitByUid(metadata.unitUid);
    if (unit) {
      // STRICT: Validate tenant consistency
      if (unit.tenant_id !== message.tenant_id) {
        console.warn(`[SKIP] Unit ${unit.id} belongs to different tenant than message ${message.id}`);
        return null;
      }
      
      return {
        tenant_id: message.tenant_id,
        entity_id: message.id,
        original_data: message,
        proposed_fix: {
          unit_id: unit.id,
          development_id: unit.project_id,
        },
        match_method: 'metadata.unitUid lookup',
        match_confidence: 100,
      };
    }
  }

  // Method 2: Check for unit_uid directly in metadata
  if (metadata.unit_uid) {
    const unit = await findUnitByUid(metadata.unit_uid);
    if (unit) {
      // STRICT: Validate tenant consistency
      if (unit.tenant_id !== message.tenant_id) {
        console.warn(`[SKIP] Unit ${unit.id} belongs to different tenant than message ${message.id}`);
        return null;
      }
      
      return {
        tenant_id: message.tenant_id,
        entity_id: message.id,
        original_data: message,
        proposed_fix: {
          unit_id: unit.id,
          development_id: unit.project_id,
        },
        match_method: 'metadata.unit_uid lookup',
        match_confidence: 100,
      };
    }
  }

  // Method 3: Check for schemeId/projectId in metadata
  // IMPORTANT: Only use if the development belongs to the same tenant
  if (metadata.schemeId || metadata.projectId) {
    const projectId = metadata.schemeId || metadata.projectId;
    
    // Validate tenant consistency before proposing
    const isValid = await validateDevelopmentTenant(projectId, message.tenant_id);
    
    if (isValid) {
      return {
        tenant_id: message.tenant_id,
        entity_id: message.id,
        original_data: message,
        proposed_fix: {
          development_id: projectId,
        },
        match_method: 'metadata.schemeId/projectId (tenant-validated, no unit)',
        match_confidence: 50,
      };
    } else {
      console.warn(`[SKIP] Development ${projectId} does not belong to message tenant ${message.tenant_id}`);
    }
  }

  // Method 4: Check for address in metadata
  if (metadata.address) {
    const unit = await findUnitByAddress(metadata.address, message.development_id || undefined);
    if (unit) {
      // STRICT: Validate tenant consistency
      if (unit.tenant_id !== message.tenant_id) {
        console.warn(`[SKIP] Unit ${unit.id} belongs to different tenant than message ${message.id}`);
        return null;
      }
      
      return {
        tenant_id: message.tenant_id,
        entity_id: message.id,
        original_data: message,
        proposed_fix: {
          unit_id: unit.id,
          development_id: unit.project_id,
        },
        match_method: 'metadata.address lookup',
        match_confidence: 80,
      };
    }
  }

  // No match found
  return null;
}

async function writeRecoveryMap(proposals: RecoveryProposal[]): Promise<number> {
  let written = 0;

  for (const proposal of proposals) {
    const { error } = await supabase
      .from('recovery_map')
      .upsert({
        tenant_id: proposal.tenant_id,
        entity_type: 'message',
        entity_id: proposal.entity_id,
        original_data: proposal.original_data,
        proposed_fix: proposal.proposed_fix,
        match_method: proposal.match_method,
        match_confidence: proposal.match_confidence,
        status: 'pending',
      }, {
        onConflict: 'entity_type,entity_id',
      });

    if (!error) {
      written++;
    } else {
      console.error(`Failed to write recovery for ${proposal.entity_id}:`, error.message);
    }
  }

  return written;
}

async function applyPendingRecoveries(): Promise<{ applied: number; failed: number; skipped: number }> {
  const { data: pending, error } = await supabase
    .from('recovery_map')
    .select('id')
    .eq('entity_type', 'message')
    .eq('status', 'pending');

  if (error || !pending) {
    console.error('Failed to fetch pending recoveries:', error?.message);
    return { applied: 0, failed: 0, skipped: 0 };
  }

  let applied = 0;
  let failed = 0;
  let skipped = 0;

  // Use the atomic SQL function for each recovery
  // This ensures each recovery is applied transactionally with consistent audit trail
  for (const recovery of pending) {
    try {
      const { data: result, error: rpcError } = await supabase.rpc('apply_message_recovery', {
        p_recovery_id: recovery.id,
        p_applied_by: 'recovery-script-v3'
      });

      if (rpcError) {
        console.error(`RPC error for ${recovery.id}:`, rpcError.message);
        failed++;
        continue;
      }

      const status = result?.status;
      if (status === 'applied') {
        applied++;
        console.log(`  Applied: ${recovery.id}`);
      } else if (status === 'rejected' || status === 'skipped') {
        skipped++;
        console.log(`  Skipped: ${recovery.id} - ${result?.reason || 'unknown'}`);
      } else if (status === 'failed') {
        failed++;
        console.log(`  Failed: ${recovery.id} - ${result?.error || 'unknown'}`);
      } else {
        // Unknown status
        skipped++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Exception for ${recovery.id}:`, msg);
      failed++;
    }
  }

  return { applied, failed, skipped };
}

async function generateReport(): Promise<RecoveryReport> {
  const orphaned = await findOrphanedMessages();
  const proposals: RecoveryProposal[] = [];
  const unknownReasons: { id: string; reason: string }[] = [];

  console.log(`Found ${orphaned.length} orphaned messages...`);

  for (const message of orphaned) {
    const proposal = await proposeRecovery(message);
    if (proposal) {
      proposals.push(proposal);
    } else {
      // Determine why we couldn't match
      const metadata = message.metadata || {};
      let reason = 'No identifying metadata';
      
      if (metadata.unitUid) {
        reason = `unitUid '${metadata.unitUid}' not found or tenant mismatch`;
      } else if (metadata.unit_uid) {
        reason = `unit_uid '${metadata.unit_uid}' not found or tenant mismatch`;
      } else if (metadata.schemeId || metadata.projectId) {
        reason = `schemeId/projectId found but tenant mismatch`;
      } else if (metadata.address) {
        reason = `Address '${metadata.address}' not matched or tenant mismatch`;
      }
      
      unknownReasons.push({ id: message.id, reason });
    }
  }

  return {
    total_orphaned: orphaned.length,
    total_fixed: proposals.length,
    total_unknown: unknownReasons.length,
    proposals,
    unknown_reasons: unknownReasons,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const shouldApply = args.includes('--apply');

  console.log('='.repeat(60));
  console.log('ORPHANED MESSAGE RECOVERY SCRIPT v2');
  console.log('='.repeat(60));

  if (shouldApply) {
    console.log('\n[MODE: APPLY] Applying pending recoveries from recovery_map...\n');
    const { applied, failed, skipped } = await applyPendingRecoveries();
    console.log(`\nResults:`);
    console.log(`  Applied: ${applied}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Skipped (tenant mismatch): ${skipped}`);
    return;
  }

  console.log(`\n[MODE: ${isDryRun ? 'DRY RUN' : 'ANALYZE'}] Analyzing orphaned messages...\n`);

  const report = await generateReport();

  console.log('\n' + '-'.repeat(60));
  console.log('RECOVERY REPORT');
  console.log('-'.repeat(60));
  console.log(`Total orphaned messages: ${report.total_orphaned}`);
  console.log(`Can be recovered:        ${report.total_fixed}`);
  console.log(`Unknown (unrecoverable): ${report.total_unknown}`);

  if (report.proposals.length > 0) {
    console.log('\nProposed Fixes (tenant-validated):');
    for (const p of report.proposals) {
      console.log(`  [${p.entity_id.slice(0, 8)}...] ${p.match_method} (${p.match_confidence}% confidence)`);
      console.log(`    -> tenant: ${p.tenant_id.slice(0, 8)}...`);
      console.log(`    -> unit_id: ${p.proposed_fix.unit_id || 'N/A'}`);
      console.log(`    -> development_id: ${p.proposed_fix.development_id || 'N/A'}`);
    }
  }

  if (report.unknown_reasons.length > 0) {
    console.log('\nUnrecoverable Messages:');
    for (const u of report.unknown_reasons) {
      console.log(`  [${u.id.slice(0, 8)}...] ${u.reason}`);
    }
  }

  if (!isDryRun && report.proposals.length > 0) {
    console.log('\nWriting proposals to recovery_map table...');
    const written = await writeRecoveryMap(report.proposals);
    console.log(`Wrote ${written} recovery proposals.`);
    console.log('\nTo apply these fixes, run:');
    console.log('  npx tsx scripts/hardening/recover-orphaned-messages.ts --apply');
  } else if (isDryRun) {
    console.log('\n[DRY RUN] No changes made. Remove --dry-run to write to recovery_map.');
  }

  console.log('\n' + '='.repeat(60));
}

main().catch(console.error);
