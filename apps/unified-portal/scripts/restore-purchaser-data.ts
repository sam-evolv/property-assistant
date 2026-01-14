#!/usr/bin/env npx tsx
/**
 * SEV-1 Data Restoration Script
 * 
 * Attempts to restore purchaser names to units using message history mapping.
 * 
 * LIMITATION: Only 1 unit (Showhouse at 8 Longview Park) has message history
 * that links old IDs to current IDs. The remaining 173 units need manual
 * data entry or re-import from external source.
 */

import { createClient } from '@supabase/supabase-js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function main() {
  const dryRun = !process.argv.includes('--execute');
  
  console.log('\n===========================================');
  console.log('  SEV-1 DATA RESTORATION');
  console.log('  Longview Estates - Purchaser Name Recovery');
  console.log('===========================================\n');
  
  if (dryRun) {
    console.log(`${YELLOW}DRY RUN MODE - No changes will be made${RESET}`);
    console.log(`Run with --execute to apply changes\n`);
  } else {
    console.log(`${RED}EXECUTE MODE - Changes WILL be applied${RESET}\n`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`${RED}Missing SUPABASE credentials${RESET}`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Get messages to build the mapping (only unique current unit_id -> first user_id seen)
  console.log(`${CYAN}1. Building ID mapping from messages...${RESET}`);
  const { data: messages } = await supabase
    .from('messages')
    .select('user_id, unit_id')
    .not('user_id', 'is', null)
    .not('unit_id', 'is', null);
  
  // Group messages by current unit_id, picking the most common user_id
  const unitToOldIdMap = new Map<string, string>();
  const oldIdCounts = new Map<string, Map<string, number>>();
  
  for (const msg of messages || []) {
    if (!oldIdCounts.has(msg.unit_id)) {
      oldIdCounts.set(msg.unit_id, new Map());
    }
    const counts = oldIdCounts.get(msg.unit_id)!;
    counts.set(msg.user_id, (counts.get(msg.user_id) || 0) + 1);
  }
  
  // For each current unit, pick the most frequent old ID
  for (const [unitId, counts] of oldIdCounts) {
    let maxCount = 0;
    let bestOldId = '';
    for (const [oldId, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        bestOldId = oldId;
      }
    }
    if (bestOldId) {
      unitToOldIdMap.set(unitId, bestOldId);
    }
  }
  
  console.log(`   Found ${unitToOldIdMap.size} current units with message history`);

  // Get purchaser agreements for these old IDs
  console.log(`${CYAN}2. Looking up purchaser names...${RESET}`);
  const oldIds = Array.from(unitToOldIdMap.values());
  const { data: agreements } = await supabase
    .from('purchaser_agreements')
    .select('unit_id, purchaser_name, purchaser_email')
    .in('unit_id', oldIds)
    .not('purchaser_name', 'is', null)
    .order('created_at', { ascending: false });

  // Map old ID to best purchaser name (most recent)
  const oldIdToName = new Map<string, { name: string; email: string | null }>();
  for (const a of agreements || []) {
    if (!oldIdToName.has(a.unit_id)) {
      oldIdToName.set(a.unit_id, { name: a.purchaser_name, email: a.purchaser_email });
    }
  }

  // Build restoration list
  const restorations: Array<{
    currentUnitId: string;
    purchaserName: string;
    purchaserEmail: string | null;
  }> = [];

  for (const [currentId, oldId] of unitToOldIdMap) {
    const nameData = oldIdToName.get(oldId);
    if (nameData) {
      restorations.push({
        currentUnitId: currentId,
        purchaserName: nameData.name,
        purchaserEmail: nameData.email,
      });
    }
  }

  console.log(`   ${GREEN}${restorations.length}${RESET} purchaser names can be restored`);

  // Show what will be restored
  console.log(`\n${CYAN}3. Restoration plan:${RESET}\n`);
  for (const r of restorations) {
    // Look up the unit address
    const { data: unit } = await supabase
      .from('units')
      .select('address_line_1')
      .eq('id', r.currentUnitId)
      .single();
    
    console.log(`   ${unit?.address_line_1 || r.currentUnitId} -> "${r.purchaserName}"`);
  }

  // Report on what cannot be restored
  const { count: totalUnits } = await supabase
    .from('units')
    .select('id', { count: 'exact' });
  
  const unrestorableCount = (totalUnits || 0) - restorations.length;
  
  console.log(`\n${YELLOW}LIMITATION:${RESET}`);
  console.log(`   ${unrestorableCount} units cannot be restored from database`);
  console.log(`   (No message history linking old IDs to current IDs)`);
  console.log(`   These require manual data entry or re-import from external source`);

  // Execute or report
  if (dryRun) {
    console.log(`\n${YELLOW}DRY RUN COMPLETE${RESET}`);
    console.log(`Run with --execute to apply ${restorations.length} updates\n`);
  } else {
    console.log(`\n${CYAN}4. Applying updates...${RESET}`);
    
    for (const r of restorations) {
      const { error } = await supabase
        .from('units')
        .update({ purchaser_name: r.purchaserName })
        .eq('id', r.currentUnitId);
      
      if (error) {
        console.error(`   ${RED}Error: ${error.message}${RESET}`);
      } else {
        console.log(`   ${GREEN}Updated${RESET} -> ${r.purchaserName}`);
      }
    }
  }

  // Final state
  console.log(`\n${CYAN}5. Current data state:${RESET}`);
  const { data: unitsWithName } = await supabase
    .from('units')
    .select('purchaser_name')
    .not('purchaser_name', 'is', null);
  
  console.log(`   Units with purchaser_name: ${unitsWithName?.length || 0} / ${totalUnits}`);
  
  console.log('\n===========================================\n');
}

main().catch(console.error);
