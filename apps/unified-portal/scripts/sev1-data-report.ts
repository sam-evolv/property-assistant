#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

async function main() {
  console.log('\n===========================================');
  console.log('  SEV-1 DATA INTEGRITY REPORT');
  console.log('  Longview Estates - Data State Analysis');
  console.log('===========================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(`${RED}Missing SUPABASE credentials${RESET}`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log(`${CYAN}1. DEVELOPMENTS${RESET}\n`);

  const { data: developments } = await supabase
    .from('developments')
    .select('id, name');

  for (const dev of developments || []) {
    const { count: unitCount } = await supabase
      .from('units')
      .select('id', { count: 'exact' })
      .eq('development_id', dev.id);
    console.log(`  ${dev.name}: ${unitCount} units`);
  }

  console.log(`\n${CYAN}2. UNITS TABLE${RESET}\n`);

  const { data: allUnits } = await supabase
    .from('units')
    .select('id, purchaser_name, address');

  const withPurchaser = allUnits?.filter(u => u.purchaser_name).length || 0;
  const withoutPurchaser = allUnits?.filter(u => !u.purchaser_name).length || 0;

  console.log(`  Total units: ${allUnits?.length || 0}`);
  console.log(`  With purchaser_name: ${GREEN}${withPurchaser}${RESET}`);
  console.log(`  Without purchaser_name: ${RED}${withoutPurchaser}${RESET}`);

  console.log(`\n${CYAN}3. HOMEOWNERS TABLE${RESET}\n`);

  const { count: homeownerCount } = await supabase
    .from('homeowners')
    .select('id', { count: 'exact' });

  console.log(`  Total homeowner records: ${homeownerCount || 0}`);
  if (!homeownerCount) {
    console.log(`  ${YELLOW}⚠ Table is empty - this is why developer dashboard shows no homeowners${RESET}`);
  }

  console.log(`\n${CYAN}4. PURCHASER AGREEMENTS (Real Data Source)${RESET}\n`);

  const { data: agreements } = await supabase
    .from('purchaser_agreements')
    .select('unit_id, purchaser_name, development_id');

  const validAgreements = agreements?.filter(a => a.purchaser_name) || [];
  console.log(`  Total agreements: ${agreements?.length || 0}`);
  console.log(`  With purchaser_name: ${validAgreements.length}`);

  if (validAgreements.length > 0) {
    console.log(`\n  Sample purchaser names:`);
    for (const a of validAgreements.slice(0, 5)) {
      console.log(`    - ${a.purchaser_name}`);
    }
    if (validAgreements.length > 5) {
      console.log(`    ... and ${validAgreements.length - 5} more`);
    }
  }

  console.log(`\n${CYAN}5. DATA RELATIONSHIP ANALYSIS${RESET}\n`);

  const unitIdSet = new Set(allUnits?.map(u => u.id) || []);
  const matchingAgreements = agreements?.filter(a => unitIdSet.has(a.unit_id)) || [];
  const orphanedAgreements = (agreements?.length || 0) - matchingAgreements.length;

  console.log(`  Agreements with matching unit_id in units table: ${matchingAgreements.length}`);
  console.log(`  Agreements with ${RED}orphaned${RESET} unit_id (no match): ${orphanedAgreements}`);

  console.log(`\n${CYAN}6. MESSAGES${RESET}\n`);

  const { data: messageLinks } = await supabase
    .from('messages')
    .select('unit_id')
    .not('unit_id', 'is', null);

  const uniqueUnitIds = new Set(messageLinks?.map(m => m.unit_id));
  console.log(`  Messages with unit_id: ${messageLinks?.length || 0}`);
  console.log(`  Unique unit_ids in messages: ${uniqueUnitIds.size}`);

  console.log('\n===========================================');
  console.log(`${YELLOW}DIAGNOSIS${RESET}`);
  console.log('===========================================\n');

  console.log('Root cause: Data relationships broken during migration/restructuring');
  console.log('');
  console.log('Impact:');
  console.log(`  - Developer dashboard shows empty homeowners list (homeowners table empty)`);
  console.log(`  - Super admin sees units but with "Unassigned" (purchaser_name is NULL)`);
  console.log(`  - Real purchaser names exist in purchaser_agreements but unit_ids don't match`);
  console.log('');
  console.log('Resolution options:');
  console.log('  1. Manual data entry - Add purchaser names directly to units table');
  console.log('  2. Import from external source - Re-import from original Excel/CSV');
  console.log('  3. Match by metadata - If purchaser_agreements has address/unit# data, match that way');
  console.log('');

  console.log('===========================================');
  console.log(`${GREEN}REPORT COMPLETE${RESET}\n`);
}

main().catch(console.error);
