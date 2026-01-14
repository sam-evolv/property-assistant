#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

async function main() {
  const dryRun = !process.argv.includes('--apply');
  
  console.log('\n===========================================');
  console.log('  PURCHASER NAME RESTORATION SCRIPT');
  console.log(`  Mode: ${dryRun ? 'DRY RUN (add --apply to execute)' : 'APPLYING CHANGES'}`);
  console.log('===========================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`${RED}Missing SUPABASE credentials${RESET}`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('1. Checking current units state...\n');

  const { data: unitsBefore, error: unitsError } = await supabase
    .from('units')
    .select('id, purchaser_name, address');

  if (unitsError) {
    console.error(`${RED}Error fetching units:${RESET}`, unitsError);
    process.exit(1);
  }

  const allUnits = unitsBefore || [];
  const unitsWithName = allUnits.filter(u => u.purchaser_name);
  const unitsWithoutName = allUnits.filter(u => !u.purchaser_name);

  console.log(`  Total units: ${allUnits.length}`);
  console.log(`  With purchaser_name: ${unitsWithName.length}`);
  console.log(`  Without purchaser_name: ${unitsWithoutName.length}`);

  console.log('\n2. Fetching purchaser_agreements data...\n');

  const { data: agreements, error: agError } = await supabase
    .from('purchaser_agreements')
    .select('unit_id, purchaser_name, purchaser_email');

  if (agError) {
    console.error(`${RED}Error fetching agreements:${RESET}`, agError);
    process.exit(1);
  }

  console.log(`  Found ${agreements?.length || 0} purchaser agreements`);

  const agreementMap = new Map<string, { name: string; email: string | null }>();
  for (const ag of agreements || []) {
    if (ag.unit_id && ag.purchaser_name) {
      agreementMap.set(ag.unit_id, { 
        name: ag.purchaser_name, 
        email: ag.purchaser_email || null 
      });
    }
  }
  console.log(`  Valid agreements (with unit_id + name): ${agreementMap.size}`);

  console.log('\n3. Finding user_id → unit_id mappings from messages...\n');

  const { data: messageLinks } = await supabase
    .from('messages')
    .select('user_id, unit_id')
    .not('user_id', 'is', null)
    .not('unit_id', 'is', null);

  const userToUnitMap = new Map<string, string>();
  for (const msg of messageLinks || []) {
    if (msg.user_id && msg.unit_id && !userToUnitMap.has(msg.user_id)) {
      userToUnitMap.set(msg.user_id, msg.unit_id);
    }
  }
  console.log(`  Found ${userToUnitMap.size} unique user_id → unit_id mappings`);

  console.log('\n4. Building restoration plan...\n');

  const updatePlan: Array<{
    unitId: string;
    address: string;
    currentName: string | null;
    newName: string;
    email: string | null;
    source: string;
  }> = [];

  for (const [userId, unitId] of userToUnitMap) {
    const agreement = agreementMap.get(userId);
    if (!agreement) continue;

    const unit = allUnits.find(u => u.id === unitId);
    if (!unit) continue;
    if (unit.purchaser_name) continue;

    updatePlan.push({
      unitId: unitId,
      address: unit.address || 'Unknown',
      currentName: unit.purchaser_name,
      newName: agreement.name,
      email: agreement.email,
      source: `agreement for user ${userId.substring(0, 8)}`,
    });
  }

  for (const ag of agreements || []) {
    if (!ag.unit_id || !ag.purchaser_name) continue;
    
    const unit = allUnits.find(u => u.id === ag.unit_id);
    if (!unit) continue;
    if (unit.purchaser_name) continue;
    if (updatePlan.find(p => p.unitId === unit.id)) continue;

    updatePlan.push({
      unitId: unit.id,
      address: unit.address || 'Unknown',
      currentName: unit.purchaser_name,
      newName: ag.purchaser_name,
      email: ag.purchaser_email || null,
      source: 'direct unit_id match',
    });
  }

  console.log(`  Units to restore: ${updatePlan.length}`);

  if (updatePlan.length === 0) {
    console.log(`\n${YELLOW}No purchaser names to restore.${RESET}`);
    console.log('This could mean:');
    console.log('  - All units already have purchaser_name');
    console.log('  - No matching data in purchaser_agreements');
    console.log('  - No messages linking user_id to unit_id');
    console.log(`  - Total units checked: ${allUnits.length}`);
    console.log(`  - Agreement mappings: ${agreementMap.size}`);
    console.log(`  - Message mappings: ${userToUnitMap.size}\n`);
    process.exit(0);
  }

  console.log('\n5. Restoration plan:\n');

  for (const plan of updatePlan.slice(0, 15)) {
    console.log(`  ${GREEN}+${RESET} ${plan.address.substring(0, 35).padEnd(35)} → ${plan.newName}`);
  }

  if (updatePlan.length > 15) {
    console.log(`  ... and ${updatePlan.length - 15} more`);
  }

  if (dryRun) {
    console.log(`\n${YELLOW}DRY RUN - No changes made${RESET}`);
    console.log(`Run with --apply to execute updates\n`);
    
    console.log('Summary:');
    console.log(`  - ${updatePlan.length} units will have purchaser_name restored`);
    console.log(`  - ${allUnits.length - updatePlan.length} units will remain unchanged`);
    process.exit(0);
  }

  console.log('\n6. Applying updates...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const plan of updatePlan) {
    const updateData: { purchaser_name: string; purchaser_email?: string } = {
      purchaser_name: plan.newName,
    };
    
    if (plan.email) {
      updateData.purchaser_email = plan.email;
    }

    const { error } = await supabase
      .from('units')
      .update(updateData)
      .eq('id', plan.unitId);

    if (error) {
      console.error(`  ${RED}✗${RESET} ${plan.address.substring(0, 35)}: ${error.message}`);
      errorCount++;
    } else {
      console.log(`  ${GREEN}✓${RESET} ${plan.address.substring(0, 35)} → ${plan.newName}`);
      successCount++;
    }
  }

  console.log('\n===========================================');
  console.log('  RESTORATION COMPLETE');
  console.log('===========================================');
  console.log(`  ${GREEN}Success: ${successCount}${RESET}`);
  if (errorCount > 0) console.log(`  ${RED}Errors: ${errorCount}${RESET}`);

  console.log('\n7. Verifying final state...\n');

  const { data: unitsAfter } = await supabase
    .from('units')
    .select('id, purchaser_name', { count: 'exact' });

  const withNameAfter = unitsAfter?.filter(u => u.purchaser_name).length || 0;
  const withoutNameAfter = unitsAfter?.filter(u => !u.purchaser_name).length || 0;

  console.log(`  With purchaser_name: ${withNameAfter} (was: ${unitsWithName.length})`);
  console.log(`  Without purchaser_name: ${withoutNameAfter} (was: ${unitsWithoutName.length})`);
  console.log('');
}

main().catch(console.error);
